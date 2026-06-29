import { LegalEvent } from "./legal-event";

export class CalendarMapper {

  toDatabase(
    event: LegalEvent
  ) {

    return {

      id: event.id,

      title: event.title,

      description:
        event.description ?? null,

      event_type:
        event.type,

      priority:
        event.priority,

      status:
        event.status,

      source:
        event.source,

      source_mail_id:
        event.mailId ?? null,

      court:
        event.court ?? null,

      file_number:
        event.fileNumber ?? null,

      client:
        event.client ?? null,

      location:
        event.location ?? null,

      start_date:
        event.startDate,

      end_date:
        event.endDate ?? null,

      all_day:
        event.allDay,

      metadata:
        event.metadata ?? {},

      created_at:
        event.createdAt,

      updated_at:
        event.updatedAt,

    };

  }

  fromDatabase(
    row: any
  ): LegalEvent {

    return {

      id: row.id,

      title: row.title,

      description:
        row.description ?? undefined,

      type:
        row.event_type,

      priority:
        row.priority,

      status:
        row.status,

      source:
        row.source,

      mailId:
        row.source_mail_id ?? undefined,

      court:
        row.court ?? undefined,

      fileNumber:
        row.file_number ?? undefined,

      client:
        row.client ?? undefined,

      location:
        row.location ?? undefined,

      startDate:
        new Date(row.start_date),

      endDate:
        row.end_date
          ? new Date(row.end_date)
          : undefined,

      allDay:
        row.all_day ?? false,

      reminderPlan: {

        enabled: true,

        offsets: [10080,4320,1440,360,60,15],

      },

      metadata:
        row.metadata ?? {},

      createdAt:
        new Date(row.created_at),

      updatedAt:
        new Date(row.updated_at),

    };

  }

}

export const calendarMapper =
  new CalendarMapper();
