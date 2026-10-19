export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running!');
  }

  try {
    const update = req.body;
    
    if (update && update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const userText = update.message.text;

      // Ключи берутся из настроек Vercel (Environment Variables)
      const geminiApiKey = process.env.GEMINI_API_KEY;
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const modelName = 'gemini-3.5-flash-lite';

      const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userText }] }]
        })
      });

      const geminiData = await geminiResponse.json();
      
      let botReply = "Извини, не удалось получить ответ от ИИ.";
      if (
        geminiData &&
        geminiData.candidates &&
        geminiData.candidates[0] &&
        geminiData.candidates[0].content &&
        geminiData.candidates[0].content.parts[0]
      ) {
        botReply = geminiData.candidates[0].content.parts[0].text;
      } else if (geminiData.error) {
        botReply = `Ошибка Gemini: ${geminiData.error.message}`;
      }

      await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: botReply
        })
      });
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
