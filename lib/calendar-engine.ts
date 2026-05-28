export function createCalendarEvent(
  title: string,
  days: number
) {

  const now =
    new Date();

  const deadlineDate =
    new Date();

  deadlineDate.setDate(
    now.getDate() + days
  );

  const notifyThreeDays =
    new Date(
      deadlineDate
    );

  notifyThreeDays.setDate(
    deadlineDate.getDate() - 3
  );

  const notifyOneDay =
    new Date(
      deadlineDate
    );

  notifyOneDay.setDate(
    deadlineDate.getDate() - 1
  );

  return {

    title,

    deadline:
      deadlineDate,

    notifications: [

      {
        type:
          "3_days_before",

        date:
          notifyThreeDays,
      },

      {
        type:
          "1_day_before",

        date:
          notifyOneDay,
      },
    ],
  };
}