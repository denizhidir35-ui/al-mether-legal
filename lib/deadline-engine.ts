export function calculateDeadline(
  days: number
) {

  let level =
    "Normal";

  if (days <= 3) {
    level = "Kritik";
  }

  else if (days <= 7) {
    level = "Yaklaşıyor";
  }

  return {
    days,
    level,
  };
}