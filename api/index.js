import { GoogleGenAI } from "@google/genai";

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
          // Инициализируем официальный клиент Google с вашим ключом AQ.
          const ai = new GoogleGenAI({ apiKey: apiKey });
          
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash-lite',
            contents: text,
          });

          if (response && response.text) {
            answer = response.text;
          }
        } catch (aiError) {
          console.error("Ошибка от Gemini:", aiError);
          answer = "Ошибка при обращении к нейросети: " + aiError.message;
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
    console.error("Общая ошибка:", error);
    return res.status(200).send("OK");
  }
}
