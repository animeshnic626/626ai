import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализируем клиент (берет ключ из переменной GEMINI_API_KEY)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running!');
  }

  try {
    const update = req.body;

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const userText = update.message.text;

      // Используем модель gemini-2.0-flash (или gemini-1.5-flash)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(userText);
      const botReply = result.response.text();

      // Отправка в Telegram
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const telegramUrl = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: botReply,
        }),
      });
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error handling update:', error);
    return res.status(500).json({ error: error.message });
  }
}
