export default async function handler(req, res) {
  // Telegram присылает данные методом POST
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'Bot is running!' });
  }

  try {
    const update = req.body;

    // Проверяем, есть ли текстовое сообщение от пользователя
    if (!update.message || !update.message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = update.message.chat.id;
    const userText = update.message.text;

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // Запрос к Google Gemini API (используем модель gemini-3.1-flash-lite)
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    
    const googleResponse = await fetch(googleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userText }] }]
      })
    });

    const googleData = await googleResponse.json();
    
    // Достаем текст ответа от Google
    let replyText = "Извини, не удалось получить ответ от Google.";
    try {
      replyText = googleData.candidates[0].content.parts[0].text;
    } catch (e) {
      console.error("Parse error:", googleData);
    }

    // Отправляем ответ обратно в Telegram
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
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
