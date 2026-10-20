import { GoogleGenAI } from '@google/genai';

// Инициализируем клиент (ключ автоматически берется из переменной GEMINI_API_KEY)
const ai = new GoogleGenAI();

export default async function handler(req, res) {
  // Telegram присылает данные методом POST
  if (req.method !== 'POST') {
    return res.status(200).send('Bot is running!');
  }

  try {
    const update = req.body;

    // Проверяем, есть ли текстовое сообщение от пользователя
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const userText = update.message.text;

      // Делаем запрос к модели gemini-3.1-flash-lite через новый SDK
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: userText,
      });

      const botReply = response.text;

      // Отправляем ответ обратно в Telegram
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
