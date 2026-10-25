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

    const chatId = message.chat?.id;
    const text = message.text || message.caption;

    if (!chatId || !text) {
      return res.status(200).json({ ok: true, status: 'Empty message' });
    }

    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!telegramToken) {
      return res.status(500).json({
        ok: false,
        error: 'Missing TELEGRAM_BOT_TOKEN in environment'
      });
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: 'привет'
      })
    });

    const telegramData = await telegramResponse.json();

    if (!telegramResponse.ok || !telegramData.ok) {
      throw new Error(telegramData?.description || 'Telegram sendMessage failed');
    }

    return res.status(200).json({ ok: true, text: 'привет' });
  } catch (error) {
    console.error('Telegram bot error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Unknown error'
    });
  }
}
