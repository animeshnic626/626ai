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

    // Защита: игнорируем чужие группы, но разрешаем ЛС (private) и нашу группу
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
      const getTopicsUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getForumTopics?chat_id=${ALLOWED_GROUP_ID}`;
      const topicsRes = await fetch(getTopicsUrl);
      const topicsData = await topicsRes.json();
      
      console.log("Topics response:", JSON.stringify(topicsData));

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
        console.log("Create topic response:", JSON.stringify(createData));

        if (createData.ok && createData.result) {
          targetThreadId = createData.result.message_thread_id;
        } else {
          console.error("Failed to create topic:", createData);
        }
      }

      // Дублируем сообщение пользователя в его персональный топик в группе
      if (targetThreadId) {
        const forwardToGroupUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(forwardToGroupUrl, {
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
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
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

      const errorUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(errorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.(`chatId`));
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

    // 4.1. Отвечаем туда, откуда пришло сообщение
    const replyUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(replyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        message_thread_id: message.message_thread_id
      })
    });

    // 4.2. Если сообщение было из ЛС, дублируем ответ бота в топик группы
    if (message.chat.type === 'private' && targetThreadId) {
      const duplicateToGroupUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(duplicateToGroupUrl, {
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
