import test from "node:test";
import assert from "node:assert/strict";

import {
  groupBatchDocuments,
} from "../lib/legal/batchDocuments.ts";
import {
  analyzeLegalBatchFiles,
} from "../lib/legal/batchAnalyzeClient.ts";
import {
  saveLegalBatch,
} from "../lib/legal/batchSaveClient.ts";
import {
  matchesCaseStatusFilter,
} from "../lib/legal/caseStatus.ts";

function identity(index) {
  return index
    .toString(16)
    .padStart(64, "0");
}

function candidate(index, overrides = {}) {
  return {
    id: `document-${index}`,
    fileName: `document-${index}.pdf`,
    documentIdentity:
      identity(index + 1),
    court: `Ankara ${index + 1}. Asliye Hukuk Mahkemesi`,
    fileNo: `2026/${100 + index}`,
    subject: `Dava konusu ${index + 1}`,
    caseType: "Alacak",
    ...overrides,
  };
}

test("10 farklı belge 10 ayrı davaya gruplanır", () => {
  const grouped =
    groupBatchDocuments(
      Array.from(
        { length: 10 },
        (_, index) =>
          candidate(index)
      )
    );

  assert.equal(grouped.totalDocuments, 10);
  assert.equal(grouped.groups.length, 10);
  assert.equal(grouped.totalCases, 10);
});

test("aynı mahkeme ve esas numaralı 4 belge tek davada kalır", () => {
  const grouped =
    groupBatchDocuments(
      Array.from(
        { length: 4 },
        (_, index) =>
          candidate(index, {
            court:
              "İzmir 7. İş Mahkemesi",
            fileNo: "2024/318",
          })
      )
    );

  assert.equal(grouped.groups.length, 1);
  assert.equal(grouped.groups[0].documents.length, 4);
});

test("bir bozuk dosya diğer dört analizi durdurmaz", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (
    _url,
    options
  ) => {
    const file =
      options.body.get("file");

    if (file.name === "bozuk.pdf") {
      return Response.json(
        { error: "PDF bozuk." },
        { status: 422 }
      );
    }

    const index =
      Number(
        file.name.match(/(\d+)/)?.[1]
      );

    return Response.json({
      ok: true,
      source: {
        sourceDocument: file.name,
        documentIdentity:
          identity(index + 20),
      },
      document: {
        court:
          `İstanbul ${index}. Asliye Hukuk Mahkemesi`,
        fileNo: `2025/${index}`,
        subject: `Konu ${index}`,
        caseType: "Tazminat",
      },
    });
  };

  const files = [
    1, 2, 3, 4,
  ].map(
    (index) =>
      new File(
        ["geçerli"],
        `belge-${index}.pdf`,
        {
          type: "application/pdf",
        }
      )
  );
  files.splice(
    2,
    0,
    new File(
      ["bozuk"],
      "bozuk.pdf",
      {
        type: "application/pdf",
      }
    )
  );

  const result =
    await analyzeLegalBatchFiles(
      files
    );

  assert.equal(result.candidates.length, 4);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].error, "PDF bozuk.");
});

test("tekrar yükleme yeni dava veya belge üretmez", async (t) => {
  const documents =
    Array.from(
      { length: 4 },
      (_, index) =>
        candidate(index, {
          court:
            "Bursa 3. Aile Mahkemesi",
          fileNo: "2023/44",
        })
    );
  const grouped =
    groupBatchDocuments(documents);
  const filesById =
    new Map(
      documents.map(
        (document) => [
          document.id,
          new File(
            [document.fileName],
            document.fileName,
            {
              type: "application/pdf",
            }
          ),
        ]
      )
    );
  const batch = {
    candidates: documents,
    failures: [],
    filesById,
    grouped,
  };
  const originalFetch = globalThis.fetch;
  const storedDocuments = new Set();
  let caseCreated = false;
  let requestedStatus = "";

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (
    url,
    options = {}
  ) => {
    const target = String(url);

    if (target === "/api/cases") {
      const body =
        JSON.parse(options.body);
      requestedStatus = body.status;
      const duplicate = caseCreated;
      caseCreated = true;
      return Response.json({
        case: { id: "case-1" },
        duplicate,
      });
    }

    if (target.endsWith("/parties")) {
      return Response.json({
        ok: true,
        parties: [],
      });
    }

    if (target.includes("/document-records")) {
      const body =
        JSON.parse(options.body);
      const duplicate =
        storedDocuments.has(
          body.documentIdentity
        );
      storedDocuments.add(
        body.documentIdentity
      );
      return Response.json({
        ok: true,
        duplicate,
      });
    }

    if (target === "/api/attachments") {
      const documentIdentity =
        options.body.get(
          "documentIdentity"
        );
      return Response.json({
        ok: true,
        duplicate:
          storedDocuments.has(
            documentIdentity
          ) && caseCreated,
      });
    }

    throw new Error(
      `Beklenmeyen istek: ${target}`
    );
  };

  const first =
    await saveLegalBatch(
      batch,
      undefined,
      { status: "archived" }
    );
  const second =
    await saveLegalBatch(
      batch,
      undefined,
      { status: "archived" }
    );

  assert.equal(first.createdCases, 1);
  assert.equal(second.createdCases, 0);
  assert.equal(second.matchedCases, 1);
  assert.equal(second.duplicateDocuments, 4);
  assert.equal(requestedStatus, "archived");
});

test("kapalı ve arşiv dava filtrelenir; konu yoksa dosya no başlık olmaz", () => {
  assert.equal(
    matchesCaseStatusFilter(
      "active",
      "active"
    ),
    true
  );
  assert.equal(
    matchesCaseStatusFilter(
      "closed",
      "archive"
    ),
    true
  );
  assert.equal(
    matchesCaseStatusFilter(
      "archived",
      "archive"
    ),
    true
  );

  const grouped =
    groupBatchDocuments([
      candidate(0, {
        subject: "",
        caseType: "",
      }),
    ]);

  assert.equal(
    grouped.groups[0].summary.subject,
    ""
  );
  assert.equal(
    grouped.groups[0].summary.caseType,
    ""
  );
});

test("belgede bulunan konu, tür, taraf, duruşma ve son tarih kayda taşınır", async (t) => {
  const document = candidate(7, {
    subject: "İşçilik alacağı",
    caseType: "İş davası",
    plaintiff: "Ayşe Yılmaz",
    defendant: "Örnek A.Ş.",
    parties:
      "Müvekkil: Mehmet Kaya; Davacı: Ayşe Yılmaz; Davalı: Örnek A.Ş.",
    lawyers: ["Av. Ali Demir"],
    hearingDate: "2026-11-05",
    hearingTime: "10:30",
    explicitDeadline: "2026-10-20",
  });
  const grouped =
    groupBatchDocuments([document]);
  const batch = {
    candidates: [document],
    failures: [],
    filesById: new Map([
      [
        document.id,
        new File(
          ["belge"],
          document.fileName,
          { type: "application/pdf" }
        ),
      ],
    ]),
    grouped,
  };
  const originalFetch = globalThis.fetch;
  const partyPosts = [];
  let casePayload;
  let calendarPayload;

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (
    url,
    options = {}
  ) => {
    const target = String(url);

    if (target === "/api/cases") {
      casePayload =
        JSON.parse(options.body);
      return Response.json({
        case: { id: "case-autofill" },
        duplicate: false,
      });
    }

    if (target.endsWith("/parties")) {
      if (options.method === "POST") {
        partyPosts.push(
          JSON.parse(options.body)
        );
        return Response.json({ ok: true });
      }

      return Response.json({
        ok: true,
        parties: [],
      });
    }

    if (target === "/api/cases/manual-calendar") {
      calendarPayload =
        JSON.parse(options.body);
      return Response.json({ ok: true });
    }

    if (target.includes("/document-records")) {
      return Response.json({
        ok: true,
        duplicate: false,
      });
    }

    if (target === "/api/attachments") {
      return Response.json({
        ok: true,
        duplicate: false,
      });
    }

    throw new Error(
      `Beklenmeyen istek: ${target}`
    );
  };

  const result =
    await saveLegalBatch(batch);

  assert.equal(result.failures.length, 0);
  assert.equal(
    casePayload.case_title,
    "İşçilik alacağı"
  );
  assert.equal(
    casePayload.case_type,
    "İş davası"
  );
  assert.deepEqual(
    partyPosts.map(
      ({ role, name }) =>
        [role, name]
    ),
    [
      ["muvekkil", "Mehmet Kaya"],
      ["davaci", "Ayşe Yılmaz"],
      ["davali", "Örnek A.Ş."],
      ["vekil", "Av. Ali Demir"],
    ]
  );
  assert.equal(
    partyPosts[0].is_client,
    true
  );
  assert.equal(
    calendarPayload.hearingAt,
    "2026-11-05T10:30"
  );
  assert.equal(
    calendarPayload.manualDeadline,
    "2026-10-20"
  );
});
