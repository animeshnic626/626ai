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
    const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!telegramToken || !geminiApiKey) {
      return res.status(500).json({
        ok: false,
        error: 'Missing TELEGRAM_BOT_TOKEN or GEMINI_API_KEY in environment'
      });
    }

    const reply = await generateGeminiReply({
      apiKey: geminiApiKey,
      model: geminiModel,
      prompt: userText
    });

    await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply,
        reply_to_message_id: message.message_id
      })
    });

    return res.status(200).json({ ok: true, reply });
  } catch (error) {
    console.error('Bot error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Unknown error'
    });
  }
}

async function generateGeminiReply({ apiKey, model, prompt }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Gemini API error');
  }

  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim() || 'Не удалось получить ответ от модели.'
  );
}
