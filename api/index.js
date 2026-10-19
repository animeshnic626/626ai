export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const TOKEN = "8658163234:AAHbbS8Y0PP-puPlGNpiM5AxAjsrIZJ_BrA";
  const apiKey = process.env.GEMINI_API_KEYS;

  try {
    const update = req.body;
    if (update && update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text || message.caption || "";

      if (text) {
        let answer = "Извините, не удалось получить ответ.";

        try {
          const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: text }] }]
            })
          });

          const geminiData = await geminiRes.json();

          if (geminiData.candidates && geminiData.candidates[0].content.parts[0].text) {
            answer = geminiData.candidates[0].content.parts[0].text;
          } else if (geminiData.error) {
            answer = "Ошибка от Google: " + geminiData.error.message;
          }
        } catch (aiError) {
          answer = "Сбой запроса: " + aiError.message;
        }

        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: answer })
        });
      }
    }

    return res.status(200).send("OK");
  } catch (error) {
    return res.status(200).send("OK");
  }
}
