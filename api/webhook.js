// Глобальная переменная для хранения статуса пинга по ID чатов
const pingModes = {};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'Bot is running!' });
  }

  try {
    const update = req.body;

    if (!update.message || !update.message.text) {
      return res.status(200).json({ ok: true });
    }

    const chatId = update.message.chat.id;
    const messageId = update.message.message_id;
    const userText = update.message.text.trim();

    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // --- 1. ТУМБЛЕР ПИНГА (по 🔥) ---
    if (userText === '🔥') {
      pingModes[chatId] = !pingModes[chatId];
      const isEnabled = pingModes[chatId];

      const reactionUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMessageReaction`;
      await fetch(reactionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reaction: [{ type: 'emoji', emoji: '🔥' }]
        })
      });

      const statusText = isEnabled 
        ? "🟢 Режим пинга ВКЛЮЧЕН." 
        : "🔴 Режим пинга ВЫКЛЮЧЕН.";

      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: statusText })
      });

      return res.status(200).json({ ok: true });
    }

    // --- 2. ОБРАБОТКА КОМАНДЫ ДЛЯ КАРТИНОК (/image или /картинка) ---
    if (userText.startsWith('/image') || userText.startsWith('/картинка')) {
      // Достаем текст промпта (все, что идет после команды)
      const promptText = userText.replace(/^\/(image|картинка)\s*/i, '').trim();

      if (!promptText) {
        // Если написали просто /image без описания
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: '⚠️ Напиши описание картинки после команды, например: /image кот в шляпе' })
        });
        return res.status(200).json({ ok: true });
      }

      // Отправляем запрос к Imagen API (используем модель imagen-3.0-generate-002)
      const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`;
      
      const imagenResponse = await fetch(imagenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: promptText }],
          parameters: { sampleCount: 1, aspectRatio: "1:1" }
        })
      });

      const imagenData = await imagenResponse.json();

      if (!imagenResponse.ok) {
        console.error("Imagen API Error:", imagenData);
        const errorMsg = imagenData.error?.message || "Ошибка генерации изображения";
        
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: `⚠️ Ошибка картинки: ${errorMsg}` })
        });
        return res.status(200).json({ ok: true });
      }

      try {
        // Google возвращает картинку в формате base64
        const base64Image = imagenData.predictions[0].bytesBase64Encoded;
        const imageBuffer = Buffer.from(base64Image, 'base64');

        // Отправляем фото в Telegram с помощью FormData / отправки файла
        // В Node.js на серверless-функциях проще отправить через Telegram метод sendPhoto с buffer, 
        // но так как стандартный fetch требует FormData для файлов, сформируем его:
        const formData = new FormData();
        formData.append('chat_id', chatId);
        // Создаем виртуальный файл из Buffer для отправки
        const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
        formData.append('photo', blob, 'image.jpg');
        formData.append('caption', `🎨 Промпт: ${promptText}`);

        const telegramPhotoUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
        await fetch(telegramPhotoUrl, {
          method: 'POST',
          body: formData // передаем без заголовка Content-Type, fetch сам проставит границы мультиварта
        });

      } catch (err) {
        console.error("Image parse/send error:", err);
        const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: '💥 Не удалось отправить сгенерированную картинку.' })
        });
      }

      return res.status(200).json({ ok: true });
    }

    // --- 3. РЕЖИМ ПИНГА ДЛЯ ОБЫЧНЫХ СООБЩЕНИЙ ---
    if (pingModes[chatId]) {
      const reactionUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setMessageReaction`;
      await fetch(reactionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reaction: [{ type: 'emoji', emoji: '🔥' }]
        })
      });
    }

    // --- 4. ОБЫЧНЫЙ ТЕКСТОВЫЙ ЗАПРОС К GEMINI ---
    const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
    
    const googleResponse = await fetch(googleUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userText }] }]
      })
    });

    const googleData = await googleResponse.json();
    
    if (!googleResponse.ok) {
      console.error("Google API Error:", googleData);
      const errorMsg = googleData.error?.message || JSON.stringify(googleData);

      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `⚠️ Google API Error: ${errorMsg}` })
      });
      return res.status(200).json({ ok: true });
    }
    
    let replyText = "Извини, не удалось обработать ответ от Google.";
    try {
      replyText = googleData.candidates[0].content.parts[0].text;
    } catch (e) {
      console.error("Parse error:", googleData);
    }

    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: replyText })
    });

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Server Error:", error);
    
    const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (TELEGRAM_BOT_TOKEN && req.body?.message?.chat?.id) {
      const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: req.body.message.chat.id,
          text: `💥 Server Error: ${error.message}`
        })
      });
    }

    return res.status(500).json({ error: error.message });
  }
}
