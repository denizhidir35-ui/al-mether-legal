export async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(
      response.ok
        ? "Sunucu boş bir yanıt döndürdü."
        : `Sunucu ${response.status} hatasıyla boş bir yanıt döndürdü.`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      response.ok
        ? "Sunucudan JSON olmayan bir yanıt alındı."
        : `Sunucu ${response.status} hatasıyla JSON olmayan bir yanıt döndürdü.`
    );
  }
}
