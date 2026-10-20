const { Telegraf, Markup } = require('telegraf');

// Бот сам подхватит BOT_TOKEN из настроек окружения Vercel
const bot = new Telegraf(process.env.BOT_TOKEN);

// Ловим АБСОЛЮТНО любое текстовое сообщение (или нажатие старой кнопки)
bot.on('text', async (ctx) => {
  // Отправляем текст и полностью убираем кнопки с экрана
  return ctx.reply('Кнопки успешно удалены!', Markup.removeKeyboard());
});

// Настройка моста, чтобы Vercel передавал сообщения в Telegraf
module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body, res);
    } else {
      res.status(200).send('Бот-пустышка успешно запущен!');
    }
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).send('Внутренняя ошибка');
  }
};
