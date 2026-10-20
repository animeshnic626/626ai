const { Telegraf, Markup } = require('telegraf');

// Бот подхватывает токен из переменных Vercel
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);


// Ловим абсолютно любое текстовое сообщение или нажатие кнопки
bot.on('text', async (ctx) => {
  // Отправляем сообщение чат и принудительно уничтожаем клавиатуру
  await ctx.reply('Меню кнопок полностью удалено из этого чата!', Markup.removeKeyboard());
});

// Настройка вебхука, адаптированная под архитектуру Vercel
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      // Говорим Vercel, что мы возвращаем именно JSON-данные для Telegram
      res.setHeader('Content-Type', 'application/json');
      
      // Обрабатываем входящее сообщение от пользователя
      await bot.handleUpdate(req.body, res);
      
      // Если Telegraf не закрыл соединение сам, закрываем его со статусом 200
      if (!res.writableEnded) {
        res.status(200).json({ ok: true });
      }
    } else {
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send('Бот-очиститель запущен!');
    }
  } catch (error) {
    console.error('Критическая ошибка на Vercel:', error);
    if (!res.writableEnded) {
      res.status(500).send('Внутренняя ошибка сервера');
    }
  }
};
