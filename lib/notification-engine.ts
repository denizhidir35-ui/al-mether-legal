export function getNotifications(
  days: number
) {

  const notifications = [];

  if (days <= 7) {

    notifications.push(
      "⏰ 7 gün kaldı"
    );
  }

  if (days <= 3) {

    notifications.push(
      "🚨 3 gün kaldı"
    );
  }

  if (days <= 1) {

    notifications.push(
      "🔥 Son gün"
    );
  }

  return notifications;
}