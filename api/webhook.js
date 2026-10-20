export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Бот с кнопками работает!');
  }

  try {
    const update = req.body;

    if (update && update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const token = process.env.TELEGRAM_BOT_TOKEN;

      // Создаем визуальные кнопки, которые появятся внизу экрана
      const replyKeyboard = {
        keyboard: [
          [
            { text: "🚀 Кнопка 1" }, 
            { text: "⭐ Кнопка 2" }
          ],
          [
            { text: "💡 Помощь" }, 
            { text: "🔄 Сброс" }
          ]
        ],
        resize_keyboard: true, // Делает кнопки компактными
        one_time_keyboard: false // Оставляет кнопки на экране постоянно
      };

      // Отправляем пользователю сообщение + наши кнопки
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Ты написал: "${text}". А вот твои новые кнопки снизу 👇`,
          reply_markup: replyKeyboard
        }),
      });
    }
  } catch (error) {
    console.error('Ошибка:', error);
  }

  return res.status(200).json({ status: 'ok' });
}
