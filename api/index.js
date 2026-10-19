export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const TOKEN = "8658163234:AAHbbS8Y0PP-puPlGNpiM5AxAjsrIZJ_BrA";

  try {
    const update = req.body;
    if (update && update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text || message.caption || "";

      // Простой ответ для проверки связи: если написали "626", пришлем "626"
      let answer = text === "626" ? "626" : "Сервер работает! Вы написали: " + text;

      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: answer })
      });
    }

    return res.status(200).send("OK");
  } catch (error) {
    return res.status(200).send("OK");
  }
}
