export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('Bot is running!');
    }

    try {
        const update = req.body;

        // Проверяем, есть ли текстовое сообщение
        if (update.message && update.message.text) {
            const chatId = update.message.chat.id;
            const userText = update.message.text;

            // 1. СРАЗУ отвечаем Telegram статусом 200 OK, чтобы он не дублировал запросы
            res.status(200).json({ status: 'ok' });

            // 2. Делаем запрос к Gemini через чистый fetch
            const apiKey = process.env.GEMINI_API_KEY;
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

            const aiResponse = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: userText }]
                    }]
                })
            });

            const aiData = await aiResponse.json();
            const botReply = aiData.candidates?.[0]?.content?.parts?.[0]?.text || 'Извините, не удалось получить ответ от модели.';

            // 3. Отправляем итоговый ответ обратно в Telegram
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
            
            return; // Завершаем выполнение после успешной отправки
        }

        // Если пришло что-то другое (не текстовое сообщение)
        return res.status(200).json({ status: 'ignored' });

    } catch (error) {
        console.error('Error handling update:', error);
        // Если ответ еще не отправлялся, возвращаем ошибку
        if (!res.headersSent) {
            return res.status(500).json({ error: error.message });
        }
    }
}
