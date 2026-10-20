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

            // 2. Делаем запрос к Gemini с моделью gemini-3.1-flash-lite через чистый fetch
            const apiKey = process.env.GEMINI_API_KEY;
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

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
            
            // Безопасно достаем текст ответа
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
            
            return;
        }

        return res.status(200).json({ status: 'ignored' });

    } catch (error) {
        console.error('Error handling update:', error);
        if (!res.headersSent) {
            return res.status(500).json({ error: error.message });
        }
    }
}
