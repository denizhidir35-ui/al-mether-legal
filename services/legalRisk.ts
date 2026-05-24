export function calculateRisk(
  title: string
) {
  const lower =
    title.toLowerCase();

  // DEFAULT

  let risk = 20;

  let level = "Düşük";

  let color = "#22c55e";

  let warnings: string[] =
    [];

  // İCRA

  if (
    lower.includes("icra")
  ) {
    risk = 75;

    level = "Yüksek";

    color = "#ef4444";

    warnings.push(
      "Süre kaçırma riski yüksek."
    );
  }

  // CEZA

  if (
    lower.includes("ceza")
  ) {
    risk = 85;

    level = "Kritik";

    color = "#dc2626";

    warnings.push(
      "Ceza dosyalarında hızlı işlem gerekir."
    );
  }

  // İŞE İADE

  if (
    lower.includes(
      "işe iade"
    )
  ) {
    risk = 60;

    level = "Orta";

    color = "#eab308";

    warnings.push(
      "Tanık ve SGK kayıtları kritik olabilir."
    );
  }

  // TAHLİYE

  if (
    lower.includes(
      "tahliye"
    )
  ) {
    risk = 55;

    level = "Orta";

    color = "#f59e0b";

    warnings.push(
      "Kira sözleşmesi kontrol edilmeli."
    );
  }

  return {
    risk,

    level,

    color,

    warnings,
  };
}