// Нам НЕ нужны require('telegraf') или require('@google/genai')! Используем только встроенный fetch.

module.exports = async (req, res) => {
  // Проверяем, что пришел POST-запрос от Telegram
  if (req.method === 'POST') {
    try {
      const { message } = req.body;

      // Если нам прислали текстовое сообщение
      if (message && message.text) {
        const chatId = message.chat.id;
        const userText = message.text;

        // 1. Запрашиваем ответ у Google Gemini 3.1 Flash-Lite через прямой HTTP-запрос (fetch)
        const geminiResponse = await fetch(
          `https://googleapis.com{process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: userText }] }]
            })
          }
        );

        const geminiData = await geminiResponse.json();
        
        // Достаем чистый текст ответа от ИИ
        let aiAnswer = "Извини, не удалось получить ответ от ИИ.";
        if (geminiData.candidates && geminiData.candidates[0].content.parts[0].text) {
          aiAnswer = geminiData.candidates[0].content.parts[0].text;
        }

        // 2. Отправляем ответ обратно в Telegram и НАВСЕГДА УДАЛЯЕМ КНОПКИ (remove_keyboard)
        await fetch(
          `https://telegram.org{process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: aiAnswer,
              reply_markup: {
                remove_keyboard: true // Этот параметр намертво стирает меню с экрана!
              }
            })
          }
        );
      }

      // Возвращаем Vercel статус 200 OK
      res.status(200).json({ ok: true });
    } catch (error) {
      console.error('Ошибка в коде бота:', error);
      res.status(500).send('Внутренняя ошибка');
    }
  } else {
    res.status(200).send('Бот на чистом fetch запущен!');
  }
};
