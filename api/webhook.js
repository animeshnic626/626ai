await fetch(telegramUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        chat_id: chatId,
        text: botReply,
        reply_markup: {
            remove_keyboard: true // Эта команда заставит Telegram убрать кнопки
        }
    }),
});
