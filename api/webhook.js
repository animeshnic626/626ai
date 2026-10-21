// Кэш для мгновенного поиска топиков без лишних запросов к Telegram API
const userTopics = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'Bot is running!' });
  }

  try {
    const update = req.body;

    const message = update.message || update.channel_post;
    if (!message || !message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const messageId = message.message_id;
    const userText = message.text.trim();
    
    const userId = message.from.id;
    const userName = message.from.first_name || `User ${userId}`;

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    const ALLOWED_GROUP_ID = -1004357166374; 

    if (chatId !== ALLOWED_GROUP_ID && message.chat.type !== 'private') {
      return res.status(200).json({ ok: true });
    }

    // --- 1. ТУМБЛЕР ПИНГА (по 🔥) ---
    if (userText === '🔥') {
      const reactionUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMessageReaction`;
      await fetch(reactionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reaction: [{ type: 'emoji', emoji: '🔥' }]
        })
      });

      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🔥 Пинг-тест успешен!",
          message_thread_id: message.message_thread_id
        })
      });

      return res.status(200).json({ ok: true });
    }

    // --- 2. ЛОГИКА ТОПИКОВ (если пишут в ЛС) ---
    let targetThreadId = message.message_thread_id;

    if (message.chat.type === 'private') {
      // Сразу показываем статус "печатает...", чтобы убрать ощущение задержки
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' })
      });

      // Сначала проверяем локальный кэш
      if (userTopics.has(userId)) {
        targetThreadId = userTopics.get(userId);
      } else {
        // Если в кэше нет — запрашиваем список топиков у Telegram
        const getTopicsUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getForumTopics?chat_id=${ALLOWED_GROUP_ID}`;
        const topicsRes = await fetch(getTopicsUrl);
        const topicsData = await topicsRes.json();

        let topicsList = [];
        if (topicsData.ok && topicsData.result) {
          if (Array.isArray(topicsData.result)) {
            topicsList = topicsData.result;
          } else if (topicsData.result.topics && Array.isArray(topicsData.result.topics)) {
            topicsList = topicsData.result.topics;
          }
        }

        let foundTopic = topicsList.find(topic => topic.name && topic.name.includes(`[${userId}]`));

        if (foundTopic) {
          targetThreadId = foundTopic.message_thread_id;
        } else {
          // Создаем новый топик только если его реально нет
          const createTopicUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createForumTopic`;
          const createRes = await fetch(createTopicUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: ALLOWED_GROUP_ID,
              name: `${userName} [${userId}]`
            })
          });
          const createData = await createRes.json();

          if (createData.ok && createData.result) {
            targetThreadId = createData.result.message_thread_id;
          }
        }

        // Сохраняем в кэш
        if (targetThreadId) {
          userTopics.set(userId, targetThreadId);
        }
      }

      // Дублируем сообщение пользователя в его персональный топик
      if (targetThreadId) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ALLOWED_GROUP_ID,
            text: `👤 **${userName}** (из ЛС):\n> ${userText}`,
            message_thread_id: targetThreadId,
            parse_mode: "Markdown"
          })
        });
      }
    }

    // --- 3. ЗАПРОС К GEMINI ---
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    
    const googleResponse = await fetch(googleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userText }] }],
        safety_settings: [
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "OFF" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "OFF" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "OFF" }
        ]
      })
    });

    const googleData = await googleResponse.json();
    
    if (!googleResponse.ok) {
      console.error("Google API Error:", googleData);
      const errorMsg = googleData.error?.message || JSON.stringify(googleData);

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ Google API Error: ${errorMsg}`,
          message_thread_id: message.message_thread_id
        })
      });
      return res.status(200).json({ ok: true });
    }
    
    let replyText = "Извини, не удалось обработать ответ от Google.";
    try {
      replyText = googleData.candidates[0].content.parts[0].text;
    } catch (e) {
      console.error("Parse error:", googleData);
    }

    // --- 4. ОТПРАВКА ОТВЕТА И ДУБЛИРОВАНИЕ ---

    // 4.1. Отвечаем пользователю
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        message_thread_id: message.message_thread_id
      })
    });

    // 4.2. Дублируем ответ бота в топик группы
    if (message.chat.type === 'private' && targetThreadId) {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ALLOWED_GROUP_ID,
          text: `🤖 **Ответ бота:**\n${replyText}`,
          message_thread_id: targetThreadId,
          parse_mode: "Markdown"
        })
      });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
