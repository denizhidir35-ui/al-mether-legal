import OpenAI from "openai";

const openai = new OpenAI({
  baseURL:
    "https://openrouter.ai/api/v1",

  apiKey:
    process.env.OPENROUTER_API_KEY,
});

export async function POST(
  req: Request
) {
  try {
    const formData =
      await req.formData();

    const file = formData.get(
      "file"
    ) as File;

    if (!file) {
      return Response.json({
        result:
          "Dosya bulunamadı.",
      });
    }

    const text =
      await file.text();

    const completion =
      await openai.chat.completions.create(
        {
          model:
            "deepseek/deepseek-chat",

          messages: [
            {
              role: "system",

              content: `
Sen Türkiye'de çalışan
uzman hukuk AI sistemisin.

Görevlerin:

- hukuki özet çıkar
- risk analizi yap
- eksik noktaları bul
- strateji öner
- hukuk alanını tespit et

Asla Amerikan hukuku kullanma.
Sadece Türk hukuku mantığıyla cevap ver.
`,
            },

            {
              role: "user",

              content: `
Aşağıdaki dava metnini analiz et:

${text}
`,
            },
          ],
        }
      );

    return Response.json({
      result:
        completion.choices[0]
          .message.content,
    });
  } catch (error: any) {
    console.log(error);

    return Response.json({
      result:
        String(error),
    });
  }
}