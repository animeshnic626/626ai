export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, status: 'Bot is running' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const update = req.body || {};
    const message = update.message || update.edited_message || update.channel_post;

    if (!message) {
      return res.status(200).json({ ok: true, status: 'No Telegram update' });
    }

    const text = String(message.text || message.caption || '').trim();
    const chatId = message.chat?.id;
    const messageId = message.message_id;

    if (!chatId || !text) {
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text }] }]
        }),
        signal: controller.signal
      }
    );

    clearTimeout(timeout);

    let geminiData;
    try {
      geminiData = await geminiResponse.json();
    } catch (error) {
      throw new Error('Invalid JSON response from Gemini API');
    }

    if (!geminiResponse.ok) {
      throw new Error(geminiData?.error?.message || 'Gemini API error');
    }

    const reply =
      geminiData?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim() || 'Не удалось получить ответ от модели.';

    const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: reply,
        reply_to_message_id: messageId,
        disable_web_page_preview: true
      })
    });

    let telegramData;
    try {
      telegramData = await telegramResponse.json();
    } catch (error) {
      throw new Error('Invalid JSON response from Telegram API');
    }

    if (!telegramResponse.ok || !telegramData.ok) {
      throw new Error(telegramData?.description || 'Telegram sendMessage failed');
    }

    return res.status(200).json({ ok: true, reply });
  } catch (error) {
    console.error('Telegram bot error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Unknown error'
    });
  }
}
