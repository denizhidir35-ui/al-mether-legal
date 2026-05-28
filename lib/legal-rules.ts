export function analyzeLegalCase(
  title: string
) {

  const lower =
    title.toLowerCase();

  let risk =
    "Orta Risk";

  let duration =
    "14 gün";

  let strategy =
    "Standart savunma hazırlanmalı.";

  let evidence =
    "Yazılı belgeler güçlendirilmeli.";

  let level =
    "Normal";

  // İCRA

  if (
    lower.includes("icra")
  ) {

    risk =
      "Yüksek Risk";

    duration =
      "7 gün";

    level =
      "Kritik";

    strategy =
      "İtiraz süreci hızlandırılmalı.";

    evidence =
      "Ödeme kayıtları ve tebligatlar incelenmeli.";
  }

  // CEZA

  if (
    lower.includes("ceza")
  ) {

    risk =
      "Kritik Risk";

    duration =
      "7 gün";

    level =
      "Çok Kritik";

    strategy =
      "Savunma delilleri hızla hazırlanmalı.";

    evidence =
      "Tanık, kamera ve HTS kayıtları değerlendirilmeli.";
  }

  // HACİZ

  if (
    lower.includes("haciz")
  ) {

    risk =
      "Yüksek Risk";

    duration =
      "3 gün";

    level =
      "Acil";

    strategy =
      "Haciz işlemlerine hızlı itiraz edilmeli.";

    evidence =
      "Borç belgeleri detaylı incelenmeli.";
  }

  // İŞ

  if (
    lower.includes("iş")
  ) {

    risk =
      "Orta Risk";

    duration =
      "14 gün";

    level =
      "Normal";

    strategy =
      "İşçi alacak hesapları kontrol edilmeli.";

    evidence =
      "SGK kayıtları ve maaş bordroları incelenmeli.";
  }

  return {
    risk,
    duration,
    strategy,
    evidence,
    level,
  };
}