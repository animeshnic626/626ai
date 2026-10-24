export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, status: 'Bot is running' });
  }

  try {
    const update = req.body || {};
    const message = update.message || update.edited_message || update.channel_post;

    if (!message || !message.text) {
      return res.status(200).json({ ok: true, status: 'No text message' });
    }

    const chatId = message.chat?.id;
    const userText = String(message.text || '').trim();

    if (!chatId || !userText) {
      return res.status(200).json({ ok: true, status: 'Empty message' });
    }

    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    if (!telegramToken || !geminiApiKey) {
      return res.status(500).json({
        ok: false,
        error: 'Missing TELEGRAM_BOT_TOKEN or GEMINI_API_KEY in environment'
      });
    }

    const lowerText = userText.toLowerCase();
    if (lowerText === '/ping' || lowerText === 'ping') {
      const pong = await sendTelegramMessage(telegramToken, chatId, 'pong', message.message_id);
      return res.status(200).json({ ok: true, result: pong });
    }

    const reply = await generateGeminiReply({
      apiKey: geminiApiKey,
      model: geminiModel,
      prompt: userText
    });

    await sendTelegramMessage(telegramToken, chatId, reply, message.message_id);

    return res.status(200).json({ ok: true, reply });
  } catch (error) {
    console.error('Bot error:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Unknown error' });
  }
}

async function sendTelegramMessage(token, chatId, text, replyToMessageId) {
  const body = {
    chat_id: chatId,
    text
  };

  if (replyToMessageId) {
    body.reply_to_message_id = replyToMessageId;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error(data.description || 'Telegram API error');
  }

  return data.result;
}

async function generateGeminiReply({ apiKey, model, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'Gemini API error';
    throw new Error(message);
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim();

  return text || 'Не удалось получить ответ от модели.';
}
