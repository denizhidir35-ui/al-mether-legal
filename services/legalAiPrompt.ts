export function buildLegalPrompt(
  data: any
) {
  return `
Sen profesyonel bir Türk hukuk AI sistemisin.

Dava Türü:
${data.title}

Müvekkil:
${data.client}

Mahkeme:
${data.court}

Görevlerin:

1. Hukuki risk analizi yap

2. Eksik belge var mı söyle

3. Süre risklerini belirt

4. Kritik noktaları belirt

5. Avukata strateji öner

6. Davanın zorluk seviyesini belirt

7. Delil önerileri sun

8. Kısa profesyonel özet oluştur

Cevabı profesyonel hukuk diliyle ver.
`;
}