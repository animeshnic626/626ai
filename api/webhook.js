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
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMessageReaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reaction: [{ type: 'emoji', emoji: '🔥' }]
        })
      });

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
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

    // --- 2. ПОИСК ИЛИ СОЗДАНИЕ ТОПИКА ---
    let targetThreadId = message.message_thread_id;

    if (message.chat.type === 'private') {
      // Запрашиваем список топиков у Telegram
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

      // Ищем топик, содержащий ID пользователя в скобках
      let foundTopic = topicsList.find(topic => topic.name && topic.name.includes(`[${userId}]`));

      if (foundTopic) {
        targetThreadId = foundTopic.message_thread_id;
      } else {
        // Создаем топик только если его на 100% нет в полученном списке
        const createRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createForumTopic`, {
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

      // Отправляем сообщение пользователя в его топик (параллельно, без ожидания блокировки)
      if (targetThreadId) {
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ALLOWED_GROUP_ID,
            text: `👤 **${userName}** (из ЛС):\n> ${userText}`,
            message_thread_id: targetThreadId,
            parse_mode: "Markdown"
          })
        }).catch(err => console.error("Error forwarding user msg:", err));
      }
    }

    // --- 3. ЗАПРОС К GEMINI И ОТПРАВКА ОТВЕТА ---
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    
    // Запускаем запрос к Gemini
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
    let replyText = "Извини, не удалось обработать ответ от Google.";
    
    if (googleResponse.ok) {
      try {
        replyText = googleData.candidates[0].content.parts[0].text;
      } catch (e) {
        console.error("Parse error:", googleData);
      }
    } else {
      replyText = `⚠️ Google API Error: ${googleData.error?.message || 'Unknown error'}`;
    }

    // --- 4. ОТПРАВКА ОТВЕТА ПОЛЬЗОВАТЕЛЮ И В ГРУППУ ---
    
    // Отправляем пользователю в ЛС
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        message_thread_id: message.message_thread_id
      })
    });

    // Дублируем ответ бота в топик группы
    if (message.chat.type === 'private' && targetThreadId) {
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: ALLOWED_GROUP_ID,
          text: `🤖 **Ответ бота:**\n${replyText}`,
          message_thread_id: targetThreadId,
          parse_mode: "Markdown"
        })
      }).catch(err => console.error("Error duplicating bot reply:", err));
    }

    return res.status(200).json({ ok: true });

  }к(error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
