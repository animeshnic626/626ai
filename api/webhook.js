// Глобальная переменная для хранения статуса пинга по ID чатов
const pingModes = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'Bot is running!' });
  }

  try {
    const update = req.body;

    if (!update.message || !update.message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = update.message.chat.id;
    const messageId = update.message.message_id;
    const userText = update.message.text.trim();

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

    // --- ТУМБЛЕР ПИНГА (включение / выключение по 🔥) ---
    if (userText === '🔥') {
      pingModes[chatId] = !pingModes[chatId];
      const isEnabled = pingModes[chatId];

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

      const statusText = isEnabled 
        ? "🟢 Режим пинга ВКЛЮЧЕН. Теперь на каждое сообщение будет ставиться реакция 🔥." 
        : "🔴 Режим пинга ВЫКЛЮЧЕН.";

      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: statusText
        })
      });

      return res.status(200).json({ ok: true });
    }

    // --- ЕСЛИ РЕЖИМ ПИНГА ВКЛЮЧЕН ДЛЯ ЭТОГО ЧАТА ---
    if (pingModes[chatId]) {
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
    }

    // --- ЗАПРОС К GEMINI С ОТКЛЮЧЕННЫМИ ФИЛЬТРАМИ БЕЗОПАСНОСТИ ---
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
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

      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `⚠️ Google API Error: ${errorMsg}`
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

    // Отправляем ответ от ИИ обратно в Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText
      })
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Server Error:", error);
    
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (TELEGRAM_BOT_TOKEN && req.body?.message?.chat?.id) {
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: req.body.message.chat.id,
          text: `💥 Server Error: ${error.message}`
        })
      });
    }

    return res.status(500).json({ error: error.message });
  }
}
