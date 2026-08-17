import type {
  SupabaseClient,
} from "@supabase/supabase-js";

const ATTACHMENT_BUCKET =
  "legal-attachments";

type RelatedAttachment = {
  id: string;
  storage_path?: string | null;
};

type DatabaseError = {
  message: string;
};

type DatabaseResult<T> = {
  data: T;
  error: DatabaseError | null;
};

export type CaseDeletionStore = {
  findOwnedCase(
    userId: string,
    caseId: string
  ): Promise<boolean>;
  listCalendarEventIds(
    userId: string,
    caseId: string
  ): Promise<string[]>;
  listDeadlineIds(
    userId: string,
    caseId: string
  ): Promise<string[]>;
  listAttachments(
    userId: string,
    caseId: string,
    calendarEventIds: string[]
  ): Promise<RelatedAttachment[]>;
  removeAttachmentFiles(
    storagePaths: string[]
  ): Promise<void>;
  deleteAlarms(
    userId: string,
    caseId: string,
    calendarEventIds: string[],
    deadlineIds: string[]
  ): Promise<void>;
  deleteAttachments(
    userId: string,
    caseId: string,
    calendarEventIds: string[]
  ): Promise<void>;
  deleteDeadlines(
    userId: string,
    caseId: string
  ): Promise<void>;
  deleteCalendarEvents(
    userId: string,
    caseId: string
  ): Promise<void>;
  deleteCaseMails(
    userId: string,
    caseId: string
  ): Promise<void>;
  deleteCaseNotes(
    userId: string,
    caseId: string
  ): Promise<void>;
  deleteCase(
    userId: string,
    caseId: string
  ): Promise<boolean>;
};

export type CaseDeletionResult =
  | {
      deleted: false;
      reason: "not_found";
    }
  | {
      deleted: true;
      removedAttachmentCount: number;
    };

function uniqueValues(
  values: Array<string | null | undefined>
) {
  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          typeof value === "string" &&
          value.length > 0
      )
    )
  );
}

function requireResult<T>(
  result: DatabaseResult<T>
) {
  if (result.error) {
    throw new Error(
      result.error.message
    );
  }

  return result.data;
}

export async function deleteOwnedCase(
  store: CaseDeletionStore,
  userId: string,
  caseId: string
): Promise<CaseDeletionResult> {
  const owned =
    await store.findOwnedCase(
      userId,
      caseId
    );

  if (!owned) {
    return {
      deleted: false,
      reason: "not_found",
    };
  }

  const [
    calendarEventIds,
    deadlineIds,
  ] = await Promise.all([
    store.listCalendarEventIds(
      userId,
      caseId
    ),
    store.listDeadlineIds(
      userId,
      caseId
    ),
  ]);

  const attachments =
    await store.listAttachments(
      userId,
      caseId,
      calendarEventIds
    );

  const storagePaths =
    uniqueValues(
      attachments.map(
        (attachment) =>
          attachment.storage_path
      )
    );

  if (storagePaths.length > 0) {
    await store.removeAttachmentFiles(
      storagePaths
    );
  }

  await store.deleteAlarms(
    userId,
    caseId,
    calendarEventIds,
    deadlineIds
  );
  await store.deleteAttachments(
    userId,
    caseId,
    calendarEventIds
  );
  await store.deleteDeadlines(
    userId,
    caseId
  );
  await store.deleteCalendarEvents(
    userId,
    caseId
  );
  await store.deleteCaseMails(
    userId,
    caseId
  );
  await store.deleteCaseNotes(
    userId,
    caseId
  );

  const deleted =
    await store.deleteCase(
      userId,
      caseId
    );

  if (!deleted) {
    throw new Error(
      "Dava kaydı silinemedi."
    );
  }

  return {
    deleted: true,
    removedAttachmentCount:
      attachments.length,
  };
}

export function createSupabaseCaseDeletionStore(
  supabase: SupabaseClient
): CaseDeletionStore {
  async function deleteByCase(
    table: string,
    userId: string,
    caseId: string
  ) {
    const result =
      await supabase
        .from(table)
        .delete()
        .eq("user_id", userId)
        .eq("case_id", caseId);

    requireResult(result);
  }

  return {
    async findOwnedCase(
      userId,
      caseId
    ) {
      const result =
        await supabase
          .from("legal_cases")
          .select("id")
          .eq("id", caseId)
          .eq("user_id", userId)
          .maybeSingle();

      return Boolean(
        requireResult(result)
      );
    },

    async listCalendarEventIds(
      userId,
      caseId
    ) {
      const result =
        await supabase
          .from("calendar_events")
          .select("id")
          .eq("user_id", userId)
          .eq("case_id", caseId);

      return uniqueValues(
        (requireResult(result) || []).map(
          (row: { id?: string | null }) =>
            row.id
        )
      );
    },

    async listDeadlineIds(
      userId,
      caseId
    ) {
      const result =
        await supabase
          .from("legal_deadlines")
          .select("id")
          .eq("user_id", userId)
          .eq("case_id", caseId);

      return uniqueValues(
        (requireResult(result) || []).map(
          (row: { id?: string | null }) =>
            row.id
        )
      );
    },

    async listAttachments(
      userId,
      caseId,
      calendarEventIds
    ) {
      const caseResult =
        await supabase
          .from("calendar_attachments")
          .select("id,storage_path")
          .eq("user_id", userId)
          .eq("case_id", caseId);

      const caseAttachments =
        (requireResult(caseResult) || []) as
          RelatedAttachment[];

      if (
        calendarEventIds.length === 0
      ) {
        return caseAttachments;
      }

      const eventResult =
        await supabase
          .from("calendar_attachments")
          .select("id,storage_path")
          .eq("user_id", userId)
          .in(
            "calendar_event_id",
            calendarEventIds
          );

      const byId = new Map(
        [
          ...caseAttachments,
          ...((requireResult(
            eventResult
          ) || []) as RelatedAttachment[]),
        ].map((attachment) => [
          attachment.id,
          attachment,
        ])
      );

      return Array.from(
        byId.values()
      );
    },

    async removeAttachmentFiles(
      storagePaths
    ) {
      const result =
        await supabase.storage
          .from(ATTACHMENT_BUCKET)
          .remove(storagePaths);

      requireResult(result);
    },

    async deleteAlarms(
      userId,
      caseId,
      calendarEventIds,
      deadlineIds
    ) {
      await deleteByCase(
        "alarms",
        userId,
        caseId
      );

      if (
        calendarEventIds.length > 0
      ) {
        const eventResult =
          await supabase
            .from("alarms")
            .delete()
            .eq("user_id", userId)
            .in(
              "calendar_event_id",
              calendarEventIds
            );

        requireResult(eventResult);
      }

      if (deadlineIds.length > 0) {
        const deadlineResult =
          await supabase
            .from("alarms")
            .delete()
            .eq("user_id", userId)
            .in(
              "legal_deadline_id",
              deadlineIds
            );

        requireResult(
          deadlineResult
        );
      }
    },

    async deleteAttachments(
      userId,
      caseId,
      calendarEventIds
    ) {
      await deleteByCase(
        "calendar_attachments",
        userId,
        caseId
      );

      if (
        calendarEventIds.length > 0
      ) {
        const result =
          await supabase
            .from(
              "calendar_attachments"
            )
            .delete()
            .eq("user_id", userId)
            .in(
              "calendar_event_id",
              calendarEventIds
            );

        requireResult(result);
      }
    },

    async deleteDeadlines(
      userId,
      caseId
    ) {
      await deleteByCase(
        "legal_deadlines",
        userId,
        caseId
      );
    },

    async deleteCalendarEvents(
      userId,
      caseId
    ) {
      await deleteByCase(
        "calendar_events",
        userId,
        caseId
      );
    },

    async deleteCaseMails(
      userId,
      caseId
    ) {
      await deleteByCase(
        "case_mails",
        userId,
        caseId
      );
    },

    async deleteCaseNotes(
      userId,
      caseId
    ) {
      await deleteByCase(
        "case_notes",
        userId,
        caseId
      );
    },

    async deleteCase(
      userId,
      caseId
    ) {
      const result =
        await supabase
          .from("legal_cases")
          .delete()
          .eq("id", caseId)
          .eq("user_id", userId)
          .select("id")
          .maybeSingle();

      return Boolean(
        requireResult(result)
      );
    },
  };
}
