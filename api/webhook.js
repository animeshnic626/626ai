export default async function handler(req, res) {
  // Telegram присылает данные методом POST
  if (req.method !== 'POST') {
    return res.status(200).send('Бот работает!');
  }

  try {
    const update = req.body;

    // Проверяем, что пришло именно текстовое сообщение
    if (update && update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;
      const token = process.env.TELEGRAM_BOT_TOKEN;

      // Отправляем тот же текст обратно (эхо)
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text
        }),
      });
    }
  } catch (error) {
    console.error('Ошибка:', error);
  }

  // Обязательно подтверждаем получение для Telegram
  return res.status(200).json({ status: 'ok' });
}
