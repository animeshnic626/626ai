import fs from 'fs/promises';
import path from 'path';

const TOPICS_FILE = path.join(process.cwd(), 'topics.json');

async function readTopics() {
  try {
    const data = await fs.readFile(TOPICS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeTopics(data) {
  await fs.writeFile(TOPICS_FILE, JSON.stringify(data, null, 2));
}

async function getOrCreateTopic(chatId, topicName) {
  const topics = await readTopics();
  const key = `${chatId}:${topicName}`;

  if (topics[key]) {
    return topics[key];
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;

  const createResp = await fetch(`https://api.telegram.org/bot${token}/createForumTopic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      name: topicName,
      icon_color: 0x00FF00
    })
  });

  const createData = await createResp.json();

  if (!createResp.ok || !createData.ok) {
    throw new Error(createData?.description || `Failed to create topic: ${topicName}`);
  }

  const topicId = createData.result.message_thread_id;
  topics[key] = topicId;
  await writeTopics(topics);

  return topicId;
}

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

    if (/626/i.test(text)) {
      const topicName = '626';
      const topicId = await getOrCreateTopic(chatId, topicName);

      const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_thread_id: topicId,
          text: `Топик "${topicName}" создан.`
        })
      });

      const telegramData = await telegramResponse.json();

      if (!telegramResponse.ok || !telegramData.ok) {
        throw new Error(telegramData?.description || 'Telegram sendMessage failed');
      }

      return res.status(200).json({ ok: true, topicName, topicId });
    }

    return res.status(200).json({ ok: true, status: 'No trigger keyword found' });
  } catch (error) {
    console.error('Telegram bot error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Unknown error'
    });
  }
}
