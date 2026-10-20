module.exports = async (req, res) => {
  try {
    // Получаем текст сообщения от Telegram или из параметров
    const incomingText = req.body?.message?.text || req.query?.text || "";

    let userText = incomingText;

    // Если пользователь нажал «Старт» (/start), даем ИИ специальную инструкцию
    if (incomingText === "/start") {
      userText = "Поприветствуй нового пользователя коротко и дружелюбно от имени ИИ-помощника.";
    } else if (!incomingText) {
      userText = "Привет! Расскажи коротко, кто ты.";
    }

    // Запрос к Gemini 3.1 Flash-Lite
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userText }] }]
        })
      }
    );

    const data = await geminiResponse.json();

    let aiAnswer = "Не удалось получить ответ от модели.";
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      aiAnswer = data.candidates[0].content.parts[0].text;
    } else {
      aiAnswer = JSON.stringify(data);
    }

    res.status(200).send(aiAnswer);

  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).send(`Ошибка сервера: ${error.message}`);
  }
};
