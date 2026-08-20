"use client";

import LegalBrand from "@/components/LegalBrand";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  degrees,
  PDFDocument,
} from "pdf-lib";

import LegalDock from "@/components/LegalDock";
import LegalSessionControl from "@/components/LegalSessionControl";

type Tool =
  | "word_pdf"
  | "pdf_word"
  | "scanned_pdf_word"
  | "image_word"
  | "pdf_text"
  | "image_text"
  | "image_pdf"
  | "merge_pdf"
  | "extract_pdf"
  | "delete_pages"
  | "rotate_pdf";

type ResultFile = {
  url: string;
  name: string;
};

type ConversionHistoryItem = {
  id: string;
  source_name: string;
  output_name: string;
  conversion_type: string;
  storage_path: string;
  file_size?: number | null;
  created_at: string;
  url?: string | null;
};

const TOOLS: Array<{
  id: Tool;
  title: string;
  short: string;
}> = [
  {
    id: "word_pdf",
    title: "Word → PDF",
    short: "DOC ve DOCX belgeleri gerçek PDF'e çevir",
  },
  {
    id: "pdf_word",
    title: "PDF → Word",
    short: "Metin tabanlı PDF belgelerini düzenlenebilir Word'e çevir",
  },
  {
    id: "scanned_pdf_word",
    title: "Taranmış PDF → Word",
    short: "Taranmış PDF belgelerini OCR ile okuyup Word'e çevir",
  },
  {
    id: "image_word",
    title: "Görsel → Word",
    short: "JPG, PNG ve WEBP belgelerdeki yazıları Word'e aktar",
  },
  {
    id: "pdf_text",
    title: "PDF → Metin",
    short: "PDF içerisindeki metni çıkar, kopyala veya TXT olarak indir",
  },
  {
    id: "image_text",
    title: "Görsel → Metin",
    short: "JPG, PNG ve WEBP belgelerdeki yazıyı OCR ile çıkar",
  },
  {
    id: "image_pdf",
    title: "Görsel → PDF",
    short: "JPG ve PNG belgeleri PDF'e çevir",
  },
  {
    id: "merge_pdf",
    title: "PDF Birleştir",
    short: "Birden fazla PDF'i tek dosyada birleştir",
  },
  {
    id: "extract_pdf",
    title: "Sayfa Çıkar",
    short: "PDF içerisinden seçili sayfaları yeni PDF yap",
  },
  {
    id: "delete_pages",
    title: "Sayfa Sil",
    short: "PDF içerisinden gereksiz sayfaları kaldır",
  },
  {
    id: "rotate_pdf",
    title: "PDF Döndür",
    short: "Tüm PDF sayfalarını 90° / 180° / 270° döndür",
  },
];

function formatSize(
  bytes: number
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(1)} MB`;
}

function parsePageExpression(
  value: string,
  pageCount: number
): number[] {
  const cleaned =
    value
      .replace(/\s+/g, "")
      .trim();

  if (!cleaned) {
    throw new Error(
      "Sayfa numarası girin. Örnek: 1-3,5,8"
    );
  }

  const selected =
    new Set<number>();

  const chunks =
    cleaned.split(",");

  for (
    const chunk
    of chunks
  ) {
    if (!chunk) {
      continue;
    }

    if (
      chunk.includes("-")
    ) {
      const [
        startText,
        endText,
      ] =
        chunk.split("-");

      const start =
        Number(startText);

      const end =
        Number(endText);

      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < 1 ||
        start > end
      ) {
        throw new Error(
          `Geçersiz sayfa aralığı: ${chunk}`
        );
      }

      for (
        let page = start;
        page <= end;
        page += 1
      ) {
        if (
          page > pageCount
        ) {
          throw new Error(
            `PDF ${pageCount} sayfa. ${page}. sayfa mevcut değil.`
          );
        }

        selected.add(
          page - 1
        );
      }

      continue;
    }

    const page =
      Number(chunk);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > pageCount
    ) {
      throw new Error(
        `Geçersiz sayfa: ${chunk}`
      );
    }

    selected.add(
      page - 1
    );
  }

  const result =
    Array.from(
      selected
    ).sort(
      (left, right) =>
        left - right
    );

  if (
    result.length === 0
  ) {
    throw new Error(
      "Geçerli sayfa seçilmedi."
    );
  }

  return result;
}

type PreparedConversionRequest = {
  body:
    BodyInit;

  headers?:
    HeadersInit;
};

async function preparePdfConversionRequest(
  file: File
): Promise<PreparedConversionRequest> {
  /*
   * Vercel Function payload limitine
   * yaklaşmamak için 3.5 MB üzerini
   * doğrudan Storage'a gönder.
   */
  const directLimit =
    3.5 *
    1024 *
    1024;

  if (
    file.size <=
    directLimit
  ) {
    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    return {
      body:
        formData,
    };
  }

  const prepareResponse =
    await fetch(
      "/api/conversion-upload-url",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            fileName:
              file.name,

            fileType:
              file.type ||
              "application/pdf",

            fileSize:
              file.size,
          }),
      }
    );

  const prepareRaw =
    await prepareResponse
      .text();

  let prepared:
    {
      ok?: boolean;
      error?: string;
      signedUrl?: string;
      storagePath?: string;
    } = {};

  try {
    prepared =
      prepareRaw
        ? JSON.parse(
            prepareRaw
          )
        : {};
  } catch {
    throw new Error(
      "Büyük PDF yükleme servisi geçersiz cevap verdi."
    );
  }

  if (
    !prepareResponse.ok ||
    !prepared.ok ||
    !prepared.signedUrl ||
    !prepared.storagePath
  ) {
    throw new Error(
      prepared.error ||
      "Büyük PDF yüklemesi hazırlanamadı."
    );
  }

  /*
   * Vercel'e uğramadan
   * direkt Supabase Storage.
   */
  const uploadBody =
    new FormData();

  uploadBody.append(
    "cacheControl",
    "3600"
  );

  uploadBody.append(
    "",
    file
  );

  const uploadResponse =
    await fetch(
      prepared.signedUrl,
      {
        method:
          "PUT",

        headers: {
          "x-upsert":
            "false",
        },

        body:
          uploadBody,
      }
    );

  if (
    !uploadResponse.ok
  ) {
    const message =
      await uploadResponse
        .text();

    throw new Error(
      message ||
      "PDF Storage'a yüklenemedi."
    );
  }

  return {
    headers: {
      "Content-Type":
        "application/json",
    },

    body:
      JSON.stringify({
        storagePath:
          prepared.storagePath,

        originalName:
          file.name,
      }),
  };
}
async function optimizeImageForOcr(
  file: File
): Promise<File> {
  if (
    !file.type.startsWith(
      "image/"
    )
  ) {
    return file;
  }

  /*
   * HEIC / HEIF Gemini tarafından doğrudan okunabilir.
   * Browser canvas decode edemezse orijinali yollarız.
   */
  const maxDimension =
    1600;

  let source:
    CanvasImageSource | null =
      null;

  let width =
    0;

  let height =
    0;

  let close:
    (() => void) | null =
      null;

  try {
    if (
      typeof createImageBitmap ===
      "function"
    ) {
      try {
        const bitmap =
          await createImageBitmap(
            file
          );

        source =
          bitmap;

        width =
          bitmap.width;

        height =
          bitmap.height;

        close =
          () =>
            bitmap.close();
      } catch {
        // iOS fallback aşağıda.
      }
    }

    if (!source) {
      const objectUrl =
        URL.createObjectURL(
          file
        );

      try {
        const image =
          await new Promise<HTMLImageElement>(
            (
              resolve,
              reject
            ) => {
              const element =
                new Image();

              element.onload =
                () =>
                  resolve(
                    element
                  );

              element.onerror =
                () =>
                  reject(
                    new Error(
                      "Görsel tarayıcıda açılamadı."
                    )
                  );

              element.src =
                objectUrl;
            }
          );

        source =
          image;

        width =
          image.naturalWidth;

        height =
          image.naturalHeight;

        close =
          () =>
            URL.revokeObjectURL(
              objectUrl
            );
      } catch {
        URL.revokeObjectURL(
          objectUrl
        );

        return file;
      }
    }

    if (
      !width ||
      !height
    ) {
      return file;
    }

    const scale =
      Math.min(
        1,

        maxDimension /
          Math.max(
            width,
            height
          )
      );

    const outputWidth =
      Math.max(
        1,

        Math.round(
          width *
          scale
        )
      );

    const outputHeight =
      Math.max(
        1,

        Math.round(
          height *
          scale
        )
      );

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      outputWidth;

    canvas.height =
      outputHeight;

    const context =
      canvas.getContext(
        "2d",
        {
          alpha: false,
        }
      );

    if (!context) {
      return file;
    }

    context.drawImage(
      source,
      0,
      0,
      outputWidth,
      outputHeight
    );

    const blob =
      await new Promise<Blob | null>(
        (
          resolve
        ) =>
          canvas.toBlob(
            resolve,

            "image/jpeg",

            0.82
          )
      );

    if (
      !blob ||
      blob.size >=
        file.size
    ) {
      return file;
    }

    const base =
      file.name.replace(
        /\.[^.]+$/,
        ""
      );

    return new File(
      [
        blob,
      ],

      `${base}-ocr.jpg`,

      {
        type:
          "image/jpeg",

        lastModified:
          Date.now(),
      }
    );
  } catch {
    return file;
  } finally {
    close?.();
  }
}

export default function ConverterPage() {
  const [
    activeTool,
    setActiveTool,
  ] =
    useState<Tool>(
      "image_pdf"
    );

  const [
    files,
    setFiles,
  ] =
    useState<File[]>([]);

  const [
    working,
    setWorking,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    result,
    setResult,
  ] =
    useState<ResultFile | null>(
      null
    );

  const [
    pageExpression,
    setPageExpression,
  ] =
    useState("");

  const [
    textResult,
    setTextResult,
  ] =
    useState("");

  const [
    textCopied,
    setTextCopied,
  ] =
    useState(false);

  const [
    conversionHistory,
    setConversionHistory,
  ] =
    useState<
      ConversionHistoryItem[]
    >([]);

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);

  const [
    historyDeletingId,
    setHistoryDeletingId,
  ] =
    useState("");

  const [
    rotateAngle,
    setRotateAngle,
  ] =
    useState<
      90 | 180 | 270
    >(90);

  const activeMeta =
    useMemo(
      () =>
        TOOLS.find(
          (tool) =>
            tool.id ===
            activeTool
        )!,
      [activeTool]
    );

  const accepts =
    activeTool ===
    "word_pdf"
      ? ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : activeTool ===
          "image_word" ||
        activeTool ===
          "image_text"
        ? "image/jpeg,image/png,image/webp,image/heic,image/heif"
        : activeTool ===
            "image_pdf"
          ? "image/jpeg,image/png"
          : "application/pdf";

  const multiple =
    activeTool ===
      "image_pdf" ||
    activeTool ===
      "merge_pdf";

  async function loadConversionHistory() {
    try {
      setHistoryLoading(
        true
      );

      const response =
        await fetch(
          "/api/conversion-history",
          {
            cache:
              "no-store",
          }
        );

      if (!response.ok) {
        return;
      }

      const data =
        await response.json();

      setConversionHistory(
        Array.isArray(
          data?.items
        )
          ? data.items
          : []
      );
    } catch {
      /*
       * Geçmiş yüklenemese bile
       * dönüştürme aracı çalışmaya devam eder.
       */
    } finally {
      setHistoryLoading(
        false
      );
    }
  }

  async function deleteConversionHistoryItem(
    item: ConversionHistoryItem
  ) {
    const approved =
      window.confirm(
        `"${item.output_name}" kalıcı olarak silinsin mi?`
      );

    if (!approved) {
      return;
    }

    try {
      setHistoryDeletingId(
        item.id
      );

      const response =
        await fetch(
          `/api/conversion-history?id=${encodeURIComponent(
            item.id
          )}`,
          {
            method:
              "DELETE",
          }
        );

      const raw =
        await response.text();

      let data:
        {
          ok?: boolean;
          error?: string;
        } = {};

      try {
        data =
          raw
            ? JSON.parse(
                raw
              )
            : {};
      } catch {
        throw new Error(
          "Silme servisi geçersiz cevap verdi."
        );
      }

      if (
        !response.ok ||
        !data.ok
      ) {
        throw new Error(
          data.error ||
          "Belge silinemedi."
        );
      }

      /*
       * Ekstra GET beklemeden
       * ekrandan anında kaldır.
       */
      setConversionHistory(
        (
          current
        ) =>
          current.filter(
            (
              entry
            ) =>
              entry.id !==
              item.id
          )
      );
    } catch (
      error
    ) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Belge silinemedi."
      );
    } finally {
      setHistoryDeletingId(
        ""
      );
    }
  }
  async function persistConversion(
    blob: Blob,
    outputName: string
  ) {
    try {
      const formData =
        new FormData();

      const sourceName =
        files.length > 0
          ? files
              .map(
                (file) =>
                  file.name
              )
              .join(", ")
          : "Belge";

      formData.append(
        "file",
        new File(
          [blob],
          outputName,
          {
            type:
              blob.type ||
              "application/octet-stream",
          }
        )
      );

      formData.append(
        "sourceName",
        sourceName
      );

      formData.append(
        "conversionType",
        activeTool
      );

      const response =
        await fetch(
          "/api/conversion-history/save",
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        const raw =
          await response.text();

        console.error(
          "CONVERSION HISTORY SAVE ERROR:",
          response.status,
          raw
        );

        return;
      }

      await loadConversionHistory();
    } catch {
      /*
       * Storage kayıt hatası
       * kullanıcının dönüşüm sonucunu bozmaz.
       */
    }
  }

  useEffect(() => {
    loadConversionHistory();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedTool = params.get("tool") as Tool | null;
    const pending = (window as typeof window & {
      __alMetherMobileUpload?: { tool: Tool; files: File[] };
    }).__alMetherMobileUpload;

    if (pending && TOOLS.some((tool) => tool.id === pending.tool)) {
      setActiveTool(pending.tool);
      setFiles(pending.files);
      delete (window as typeof window & {
        __alMetherMobileUpload?: { tool: Tool; files: File[] };
      }).__alMetherMobileUpload;
    } else if (requestedTool && TOOLS.some((tool) => tool.id === requestedTool)) {
      setActiveTool(requestedTool);
    }

    function receiveMobileUpload(event: Event) {
      const detail = (event as CustomEvent<{ tool: Tool; files: File[] }>).detail;
      if (!detail || !TOOLS.some((tool) => tool.id === detail.tool)) return;
      setActiveTool(detail.tool);
      setFiles(detail.files);
      delete (window as typeof window & {
        __alMetherMobileUpload?: { tool: Tool; files: File[] };
      }).__alMetherMobileUpload;
    }

    window.addEventListener("al-mether-mobile-upload", receiveMobileUpload);
    return () => {
      window.removeEventListener("al-mether-mobile-upload", receiveMobileUpload);
    };
  }, []);

  useEffect(() => {
    if (
      !result?.url ||
      !result.name
    ) {
      return;
    }

    async function saveResult() {
      try {
        const response =
          await fetch(
            result!.url
          );

        const blob =
          await response.blob();

        await persistConversion(
          blob,
          result!.name
        );
      } catch {
        // Geçmiş kaydı kritik değil.
      }
    }

    saveResult();
  }, [result?.url]);

  useEffect(() => {
    if (
      !textResult ||
      !files[0]
    ) {
      return;
    }

    const base =
      files[0].name.replace(
        /\.[^.]+$/,
        ""
      );

    const blob =
      new Blob(
        [textResult],
        {
          type:
            "text/plain;charset=utf-8",
        }
      );

    persistConversion(
      blob,
      `${base}.txt`
    );
  }, [textResult]);
  function clearResult() {
    if (
      result?.url
    ) {
      URL.revokeObjectURL(
        result.url
      );
    }

    setResult(null);
  }

  function switchTool(
    tool: Tool
  ) {
    clearResult();

    setActiveTool(tool);
    setFiles([]);
    setError("");
    setPageExpression("");
    setTextResult("");
    setTextCopied(false);
    setRotateAngle(90);
  }

  function selectFiles(
    nextFiles:
      FileList | null
  ) {
    clearResult();

    setError("");

    if (!nextFiles) {
      setFiles([]);
      return;
    }

    const selected =
      Array.from(
        nextFiles
      );

    if (
      activeTool ===
      "word_pdf"
    ) {
      const valid =
        selected.filter(
          (file) => {
            const name =
              file.name
                .toLowerCase();

            return (
              name.endsWith(
                ".doc"
              ) ||
              name.endsWith(
                ".docx"
              )
            );
          }
        );

      if (
        valid.length !==
        selected.length
      ) {
        setError(
          "Bu işlem için yalnızca DOC ve DOCX dosyaları kullanılabilir."
        );
      }

      setFiles(
        valid.slice(0, 1)
      );

      return;
    }
    if (
      activeTool ===
      "image_text"
    ) {
      const valid =
        selected.filter(
          (file) =>
            file.type === "image/jpeg" ||
            file.type === "image/png" ||
            file.type === "image/webp" ||
            file.type === "image/heic" ||
            file.type === "image/heif"
        );

      if (
        valid.length !==
        selected.length
      ) {
        setError(
          "Görsel → Metin için JPG, PNG veya WEBP kullanın."
        );
      }

      setFiles(
        valid.slice(0, 1)
      );

      return;
    }
    if (
      activeTool ===
      "image_word"
    ) {
      const valid =
        selected.filter(
          (file) =>
            file.type === "image/jpeg" ||
            file.type === "image/png" ||
            file.type === "image/webp" ||
            file.type === "image/heic" ||
            file.type === "image/heif"
        );

      if (
        valid.length !==
        selected.length
      ) {
        setError(
          "Görsel → Word için JPG, PNG veya WEBP kullanın."
        );
      }

      setFiles(
        valid.slice(0, 1)
      );

      return;
    }
    if (
      activeTool ===
      "image_pdf"
    ) {
      const valid =
        selected.filter(
          (file) =>
            file.type ===
              "image/jpeg" ||
            file.type ===
              "image/png"
        );

      if (
        valid.length !==
        selected.length
      ) {
        setError(
          "Bu işlem için yalnızca JPG ve PNG dosyaları kullanılabilir."
        );
      }

      setFiles(valid);
      return;
    }

    const valid =
      selected.filter(
        (file) =>
          file.type ===
            "application/pdf" ||
          file.name
            .toLowerCase()
            .endsWith(
              ".pdf"
            )
      );

    if (
      valid.length !==
      selected.length
    ) {
      setError(
        "Bu işlem için yalnızca PDF dosyaları kullanılabilir."
      );
    }

    if (
      activeTool !==
        "merge_pdf" &&
      valid.length > 1
    ) {
      setError(
        "Bu işlemde tek PDF seçebilirsiniz."
      );

      setFiles(
        valid.slice(0, 1)
      );

      return;
    }

    setFiles(valid);
  }

  function createDownload(
    bytes:
      Uint8Array,
    name: string
  ) {
    clearResult();

    const safeBytes =
      Uint8Array.from(
        bytes
      );

    const blob =
      new Blob(
        [safeBytes],
        {
          type:
            "application/pdf",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    setResult({
      url,
      name,
    });
  }

  async function pdfToText() {
    setTextResult("");
    setTextCopied(false);

    const file =
      files[0];

    if (!file) {
      throw new Error(
        "Önce PDF seçin."
      );
    }

    const prepared =
      await preparePdfConversionRequest(
        file
      );

    const response =
      await fetch(
        "/api/convert/pdf-to-text",
        {
          method:
            "POST",

          headers:
            prepared.headers,

          body:
            prepared.body,
        }
      );

    const raw =
      await response.text();

    let data:
      {
        ok?: boolean;
        text?: string;
        error?: string;
        engine?: string;
      } = {};

    try {
      data =
        raw
          ? JSON.parse(
              raw
            )
          : {};
    } catch {
      throw new Error(
        `PDF → Metin sunucu hatası (${response.status}).`
      );
    }

    if (
      !response.ok
    ) {
      throw new Error(
        data?.error ||
        `PDF → Metin işlemi başarısız (${response.status}).`
      );
    }

    if (
      !data.text
    ) {
      throw new Error(
        "PDF okundu ancak metin dönmedi."
      );
    }

    setTextResult(
      data.text
    );

    setTextCopied(false);
    clearResult();
  }

  async function imageToText() {
    setTextResult("");
    setTextCopied(false);

    const file =
      files[0];

    if (!file) {
      throw new Error(
        "Önce görsel seçin."
      );
    }

    const optimizedFile =
      await optimizeImageForOcr(
        file
      );

    const formData =
      new FormData();

    formData.append(
      "file",
      optimizedFile
    );

    const controller =
      new AbortController();

    const timeout =
      window.setTimeout(
        () =>
          controller.abort(),
        30000
      );

    const startedAt =
      performance.now();

    let response:
      Response;

    try {
      response =
        await fetch(
          "/api/convert/image-to-text",
          {
            method: "POST",
            body: formData,
            signal:
              controller.signal,
          }
        );
    } finally {
      window.clearTimeout(
        timeout
      );
    }

    console.info(
      "OCR duration:",
      Math.round(
        performance.now() -
        startedAt
      ),
      "ms",
      "original:",
      file.size,
      "optimized:",
      optimizedFile.size
    );

    const raw =
      await response.text();

    let data:
      {
        ok?: boolean;
        text?: string;
        error?: string;
        engine?: string;
      } = {};

    try {
      data =
        raw
          ? JSON.parse(raw)
          : {};
    } catch {
      throw new Error(
        raw ||
        `Görsel → Metin sunucu hatası (${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error ||
        `Görsel → Metin işlemi başarısız (${response.status}).`
      );
    }

    if (!data?.text) {
      throw new Error(
        "OCR tamamlandı ancak metin dönmedi."
      );
    }

    setTextResult(
      data.text
    );

    setTextCopied(false);
    clearResult();
  }

  async function copyTextResult() {
    if (!textResult) {
      return;
    }

    await navigator.clipboard.writeText(
      textResult
    );

    setTextCopied(true);

    window.setTimeout(
      () =>
        setTextCopied(false),
      1400
    );
  }

  function downloadTextResult() {
    if (!textResult) {
      return;
    }

    const blob =
      new Blob(
        [textResult],
        {
          type:
            "text/plain;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const anchor =
      document.createElement(
        "a"
      );

    anchor.href =
      url;

    const base =
      files[0]?.name.replace(
        /\.[^.]+$/,
        ""
      ) ||
      "belge";

    anchor.download =
      `${base}.txt`;

    document.body.appendChild(
      anchor
    );

    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(
      url
    );
  }
  async function imageToWord() {
    const file =
      files[0];

    if (!file) {
      throw new Error(
        "Önce görsel seçin."
      );
    }

    const optimizedFile =
      await optimizeImageForOcr(
        file
      );

    const formData =
      new FormData();

    formData.append(
      "file",
      optimizedFile
    );

    const controller =
      new AbortController();

    const timeout =
      window.setTimeout(
        () =>
          controller.abort(),
        30000
      );

    const startedAt =
      performance.now();

    let response:
      Response;

    try {
      response =
        await fetch(
          "/api/convert/image-to-word",
          {
            method: "POST",

            body:
              formData,

            signal:
              controller.signal,
          }
        );
    } finally {
      window.clearTimeout(
        timeout
      );
    }

    console.info(
      "WORD OCR duration:",
      Math.round(
        performance.now() -
        startedAt
      ),
      "ms",
      "original:",
      file.size,
      "optimized:",
      optimizedFile.size
    );

    if (!response.ok) {
      const raw =
        await response.text();

      let message =
        "Görsel → Word dönüşümü başarısız.";

      try {
        const data =
          JSON.parse(raw);

        message =
          data?.error ||
          message;
      } catch {
        if (raw) {
          message = raw;
        }
      }

      throw new Error(
        message
      );
    }

    const blob =
      await response.blob();

    clearResult();

    const url =
      URL.createObjectURL(
        blob
      );

    setResult({
      url,

      name:
        `${file.name.replace(
          /\.[^.]+$/,
          ""
        )}.docx`,
    });
  }
  async function scannedPdfToWord() {
    const file =
      files[0];

    if (!file) {
      throw new Error(
        "Önce taranmış PDF seçin."
      );
    }

    const prepared =
      await preparePdfConversionRequest(
        file
      );

    const response =
      await fetch(
        "/api/convert/scanned-pdf-to-word",
        {
          method:
            "POST",

          headers:
            prepared.headers,

          body:
            prepared.body,
        }
      );

    if (!response.ok) {
      let message =
        "Taranmış PDF → Word dönüşümü başarısız.";

      try {
        const data =
          await response.json();

        message =
          data?.error ||
          message;
      } catch {}

      throw new Error(
        message
      );
    }

    const blob =
      await response.blob();

    clearResult();

    const url =
      URL.createObjectURL(
        blob
      );

    setResult({
      url,

      name:
        `${file.name.replace(
          /\.pdf$/i,
          ""
        )}-ocr.docx`,
    });
  }
  async function pdfToWord() {
    const file =
      files[0];

    if (!file) {
      throw new Error(
        "Önce PDF dosyası seçin."
      );
    }

    const prepared =
      await preparePdfConversionRequest(
        file
      );

    const response =
      await fetch(
        "/api/convert/pdf-to-word",
        {
          method:
            "POST",

          headers:
            prepared.headers,

          body:
            prepared.body,
        }
      );

    if (!response.ok) {
      let message =
        "PDF → Word dönüşümü başarısız.";

      try {
        const data =
          await response.json();

        message =
          data?.error ||
          message;
      } catch {
        // JSON olmayan hata
      }

      throw new Error(
        message
      );
    }

    const blob =
      await response.blob();

    clearResult();

    const url =
      URL.createObjectURL(
        blob
      );

    setResult({
      url,

      name:
        `${file.name.replace(
          /\.pdf$/i,
          ""
        )}.docx`,
    });
  }
  async function wordToPdf() {
    const file =
      files[0];

    if (!file) {
      throw new Error(
        "Önce Word dosyası seçin."
      );
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    const response =
      await fetch(
        "/api/convert/word-to-pdf",
        {
          method: "POST",
          body: formData,
        }
      );

    if (
      !response.ok
    ) {
      let message =
        "Word → PDF dönüşümü başarısız.";

      try {
        const data =
          await response.json();

        message =
          data?.error ||
          message;
      } catch {
        // binary olmayan hata yanıtı
      }

      throw new Error(
        message
      );
    }

    const blob =
      await response.blob();

    clearResult();

    const url =
      URL.createObjectURL(
        blob
      );

    setResult({
      url,
      name:
        `${file.name.replace(
          /\.(docx|doc)$/i,
          ""
        )}.pdf`,
    });
  }
  async function imageToPdf() {
    if (
      files.length === 0
    ) {
      throw new Error(
        "Önce görsel seçin."
      );
    }

    const output =
      await PDFDocument.create();

    const pageWidth =
      595.28;

    const pageHeight =
      841.89;

    const margin = 28;

    for (
      const file
      of files
    ) {
      const bytes =
        await file.arrayBuffer();

      const image =
        file.type ===
        "image/png"
          ? await output
              .embedPng(
                bytes
              )
          : await output
              .embedJpg(
                bytes
              );

      const scale =
        Math.min(
          (
            pageWidth -
            margin * 2
          ) /
            image.width,

          (
            pageHeight -
            margin * 2
          ) /
            image.height
        );

      const width =
        image.width *
        scale;

      const height =
        image.height *
        scale;

      const page =
        output.addPage([
          pageWidth,
          pageHeight,
        ]);

      page.drawImage(
        image,
        {
          x:
            (
              pageWidth -
              width
            ) / 2,

          y:
            (
              pageHeight -
              height
            ) / 2,

          width,
          height,
        }
      );
    }

    const bytes =
      await output.save();

    const name =
      files.length === 1
        ? `${files[0].name.replace(
            /\.[^.]+$/,
            ""
          )}.pdf`
        : `belgeler-${Date.now()}.pdf`;

    createDownload(
      bytes,
      name
    );
  }

  async function mergePdf() {
    if (
      files.length < 2
    ) {
      throw new Error(
        "Birleştirmek için en az 2 PDF seçin."
      );
    }

    const output =
      await PDFDocument.create();

    for (
      const file
      of files
    ) {
      const source =
        await PDFDocument.load(
          await file.arrayBuffer()
        );

      const indexes =
        source.getPageIndices();

      const pages =
        await output.copyPages(
          source,
          indexes
        );

      for (
        const page
        of pages
      ) {
        output.addPage(
          page
        );
      }
    }

    const bytes =
      await output.save();

    createDownload(
      bytes,
      `birlesik-belge-${Date.now()}.pdf`
    );
  }

  async function extractPages() {
    const file =
      files[0];

    if (!file) {
      throw new Error(
        "Önce PDF seçin."
      );
    }

    const source =
      await PDFDocument.load(
        await file.arrayBuffer()
      );

    const indexes =
      parsePageExpression(
        pageExpression,
        source.getPageCount()
      );

    const output =
      await PDFDocument.create();

    const pages =
      await output.copyPages(
        source,
        indexes
      );

    for (
      const page
      of pages
    ) {
      output.addPage(
        page
      );
    }

    const bytes =
      await output.save();

    createDownload(
      bytes,
      `${file.name.replace(
        /\.pdf$/i,
        ""
      )}-secilen-sayfalar.pdf`
    );
  }

  async function deletePages() {
    const file =
      files[0];

    if (!file) {
      throw new Error(
        "Önce PDF seçin."
      );
    }

    const source =
      await PDFDocument.load(
        await file.arrayBuffer()
      );

    const pageCount =
      source.getPageCount();

    const deleteIndexes =
      new Set(
        parsePageExpression(
          pageExpression,
          pageCount
        )
      );

    const keepIndexes =
      Array.from(
        {
          length:
            pageCount,
        },
        (
          _,
          index
        ) =>
          index
      ).filter(
        (index) =>
          !deleteIndexes.has(
            index
          )
      );

    if (
      keepIndexes.length === 0
    ) {
      throw new Error(
        "PDF'in tüm sayfalarını silemezsiniz."
      );
    }

    const output =
      await PDFDocument.create();

    const pages =
      await output.copyPages(
        source,
        keepIndexes
      );

    for (
      const page
      of pages
    ) {
      output.addPage(
        page
      );
    }

    const bytes =
      await output.save();

    createDownload(
      bytes,
      `${file.name.replace(
        /\.pdf$/i,
        ""
      )}-duzenlenmis.pdf`
    );
  }

  async function rotatePdf() {
    const file =
      files[0];

    if (!file) {
      throw new Error(
        "Önce PDF seçin."
      );
    }

    const pdf =
      await PDFDocument.load(
        await file.arrayBuffer()
      );

    for (
      const page
      of pdf.getPages()
    ) {
      const current =
        page
          .getRotation()
          .angle || 0;

      page.setRotation(
        degrees(
          (
            current +
            rotateAngle
          ) %
            360
        )
      );
    }

    const bytes =
      await pdf.save();

    createDownload(
      bytes,
      `${file.name.replace(
        /\.pdf$/i,
        ""
      )}-dondurulmus.pdf`
    );
  }

  async function runTool() {
    try {
      setWorking(true);
      setError("");

      if (
        activeTool ===
        "word_pdf"
      ) {
        await wordToPdf();
      }

      if (
        activeTool ===
        "pdf_word"
      ) {
        await pdfToWord();
      }

      if (
        activeTool ===
        "scanned_pdf_word"
      ) {
        await scannedPdfToWord();
      }

      if (
        activeTool ===
        "image_word"
      ) {
        await imageToWord();
      }

      if (
        activeTool ===
        "pdf_text"
      ) {
        await pdfToText();
      }

      if (
        activeTool ===
        "image_text"
      ) {
        await imageToText();
      }
      if (
        activeTool ===
        "image_pdf"
      ) {
        await imageToPdf();
      }

      if (
        activeTool ===
        "merge_pdf"
      ) {
        await mergePdf();
      }

      if (
        activeTool ===
        "extract_pdf"
      ) {
        await extractPages();
      }

      if (
        activeTool ===
        "delete_pages"
      ) {
        await deletePages();
      }

      if (
        activeTool ===
        "rotate_pdf"
      ) {
        await rotatePdf();
      }
    } catch (
      toolError
    ) {
      setError(
        toolError instanceof Error
          ? toolError.message
          : "Dosya işlemi tamamlanamadı."
      );
    } finally {
      setWorking(false);
    }
  }

  function actionLabel() {
    if (working) {
      return "İşleniyor...";
    }

    switch (
      activeTool
    ) {
      case "word_pdf":
        return "Word'ü PDF'e çevir";

      case "pdf_word":
        return "PDF'i Word'e çevir";

      case "scanned_pdf_word":
        return "Taranmış PDF'i Word'e çevir";

      case "image_word":
        return "Görseli Word'e çevir";

      case "pdf_text":
        return "PDF metnini çıkar";

      case "image_text":
        return "Görsel metnini çıkar";

      case "image_pdf":
        return "PDF oluştur";

      case "merge_pdf":
        return "PDF'leri birleştir";

      case "extract_pdf":
        return "Sayfaları çıkar";

      case "delete_pages":
        return "Sayfaları sil";

      case "rotate_pdf":
        return "PDF'i döndür";
    }
  }

  return (
    <main className="legal-app converter-page">
      <header className="converter-header">
        <div className="converter-brand">
          <LegalBrand compact />

          <h1>
            Dönüştür
          </h1>
        </div>

        <p>
          Hukuk ofisi belge araçları
        </p>
      </header>

      <section className="converter-shell">
        <aside className="tool-list">
          {TOOLS.map(
            (tool) => (
              <button
                key={
                  tool.id
                }
                type="button"
                className={
                  activeTool ===
                  tool.id
                    ? "tool-button active"
                    : "tool-button"
                }
                onClick={() =>
                  switchTool(
                    tool.id
                  )
                }
              >
                <strong>
                  {
                    tool.title
                  }
                </strong>

                <span>
                  {
                    tool.short
                  }
                </span>
              </button>
            )
          )}
        </aside>

        <section className="workspace">
          <div className="workspace-head">
            <div>
              <span>
                BELGE ARACI
              </span>

              <h2>
                {
                  activeMeta.title
                }
              </h2>

              <p>
                {
                  activeMeta.short
                }
              </p>
            </div>

            <div className="file-counter">
              <strong>
                {
                  files.length
                }
              </strong>

              <span>
                dosya
              </span>
            </div>
          </div>

          <label className="drop-zone">
            <input
              key={
                activeTool
              }
              type="file"
              accept={
                accepts
              }
              multiple={
                multiple
              }
              onChange={(
                event
              ) => {
                selectFiles(
                  event.target
                    .files
                );
              }}
            />

            <strong>
              Dosya seç
            </strong>

            <span>
              {activeTool ===
              "word_pdf"
                ? "DOC / DOCX"
                : activeTool ===
                    "pdf_word"
                  ? "PDF"
                  : activeTool ===
                      "scanned_pdf_word"
                    ? "TARANMIŞ PDF"
                    : activeTool ===
                        "image_word"
                    ? "JPG / PNG / WEBP"
                    : activeTool ===
                        "image_text"
                      ? "JPG / PNG / WEBP"
                      : activeTool ===
                          "pdf_text"
                        ? "PDF"
                        : activeTool ===
                            "image_pdf"
                  ? "JPG / PNG"
                  : activeTool ===
                      "merge_pdf"
                    ? "2 veya daha fazla PDF"
                    : "PDF"}
            </span>
          </label>

          {files.length >
            0 && (
            <div className="selected-files">
              {files.map(
                (
                  file,
                  index
                ) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="selected-file"
                  >
                    <strong>
                      {
                        file.name
                      }
                    </strong>

                    <span>
                      {formatSize(
                        file.size
                      )}
                    </span>
                  </div>
                )
              )}
            </div>
          )}

          {(activeTool ===
            "extract_pdf" ||
            activeTool ===
              "delete_pages") && (
            <div className="option-block">
              <label>
                {activeTool ===
                "extract_pdf"
                  ? "Çıkarılacak sayfalar"
                  : "Silinecek sayfalar"}
              </label>

              <input
                value={
                  pageExpression
                }
                onChange={(
                  event
                ) =>
                  setPageExpression(
                    event.target
                      .value
                  )
                }
                placeholder="Örn: 1-3,5,8"
              />

              <span>
                Sayfa numaralarını virgül veya aralık kullanarak yazın.
              </span>
            </div>
          )}

          {activeTool ===
            "rotate_pdf" && (
            <div className="option-block">
              <label>
                Döndürme açısı
              </label>

              <div className="angle-buttons">
                {(
                  [
                    90,
                    180,
                    270,
                  ] as const
                ).map(
                  (
                    angle
                  ) => (
                    <button
                      key={
                        angle
                      }
                      type="button"
                      className={
                        rotateAngle ===
                        angle
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setRotateAngle(
                          angle
                        )
                      }
                    >
                      {
                        angle
                      }°
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="converter-error">
              {error}
            </div>
          )}

          <div className="converter-actions">
            <button
              type="button"
              className="primary-action"
              onClick={
                runTool
              }
              disabled={
                working ||
                files.length ===
                  0
              }
            >
              {
                actionLabel()
              }
            </button>

            {result && (
              <a
                className="download-action"
                href={
                  result.url
                }
                download={
                  result.name
                }
              >
                İndir
              </a>
            )}
          </div>

          {textResult && (
            <div className="text-result">
              <div className="text-result-head">
                <div>
                  <span>
                    ÇIKARILAN METİN
                  </span>

                  <strong>
                    Metin hazır
                  </strong>
                </div>

                <div className="text-result-actions">
                  <button
                    type="button"
                    onClick={
                      copyTextResult
                    }
                  >
                    {textCopied
                      ? "Kopyalandı"
                      : "Kopyala"}
                  </button>

                  <button
                    type="button"
                    onClick={
                      downloadTextResult
                    }
                  >
                    TXT indir
                  </button>
                </div>
              </div>

              <textarea
                value={
                  textResult
                }
                readOnly
              />
            </div>
          )}
          {result && (
            <div className="result-box">
              <div>
                <span>
                  HAZIR
                </span>

                <strong>
                  {
                    result.name
                  }
                </strong>
              </div>

              <span>
                İşlem tamamlandı
              </span>
            </div>
          )}
        </section>

        <aside className="history-panel">
          <div className="history-head">
            <div>
              <span>
                BELGELER
              </span>

              <strong>
                Son Dönüştürülenler
              </strong>
            </div>

            <button
              type="button"
              onClick={
                loadConversionHistory
              }
              aria-label="Geçmişi yenile"
            >
              ↻
            </button>
          </div>

          {historyLoading &&
          conversionHistory.length === 0 ? (
            <div className="history-empty">
              Belgeler yükleniyor...
            </div>
          ) : conversionHistory.length === 0 ? (
            <div className="history-empty">
              Henüz dönüştürülmüş belge yok.
            </div>
          ) : (
            <div className="history-list">
              {conversionHistory.map(
                (item) => (
                  <div
                    key={
                      item.id
                    }
                    className="history-item"
                  >
                    <div className="history-file">
                      <strong>
                        {
                          item.output_name
                        }
                      </strong>

                      <span>
                        {
                          TOOLS.find(
                            (
                              tool
                            ) =>
                              tool.id ===
                              item.conversion_type
                          )?.title ||
                          item.conversion_type
                        }
                      </span>
                    </div>

                    <div className="history-meta">
                      <span>
                        {item.file_size
                          ? formatSize(
                              item.file_size
                            )
                          : "—"}
                      </span>

                      <span>
                        {new Date(
                          item.created_at
                        ).toLocaleDateString(
                          "tr-TR",
                          {
                            day:
                              "2-digit",

                            month:
                              "2-digit",

                            year:
                              "numeric",
                          }
                        )}
                      </span>
                    </div>

                    {item.url && (
                      <div className="history-actions">
                        <a
                          href={
                            item.url
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          Aç
                        </a>

                        <a
                          href={
                            item.url
                          }
                          download={
                            item.output_name
                          }
                        >
                          İndir
                        </a>

                        <button
                          type="button"
                          className="history-delete"
                          disabled={
                            historyDeletingId ===
                            item.id
                          }
                          onClick={() =>
                            deleteConversionHistoryItem(
                              item
                            )
                          }
                        >
                          {historyDeletingId ===
                          item.id
                            ? "Siliniyor"
                            : "Sil"}
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </aside>
      </section>

      <LegalSessionControl />
      <LegalDock />

      <style jsx>{`
        .converter-page {
          min-height: 100dvh;
          padding:
            10px 14px 78px;
        }

        .converter-header {
          height: 52px;

          display: flex;
          align-items: center;
          justify-content:
            space-between;

          gap: 16px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .converter-header > div > span,
        .workspace-head > div > span {
          display: block;

          margin-bottom: 2px;

          color:
            var(--legal-gold);

          font-size: 7px;
          font-weight: 900;
          letter-spacing:
            0.15em;
        }

        .converter-header h1 {
          margin: 0;

          font-size: 15px;
        }

        .converter-header > p {
          margin: 0;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .converter-shell {
          display: grid;

          grid-template-columns:
            minmax(200px, 0.78fr)
            minmax(500px, 1.8fr)
            minmax(280px, 1fr);

          gap: 9px;

          margin-top: 10px;
        }

        .tool-list,
        .workspace {
          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-lg);

          background:
            var(--legal-surface);

          box-shadow:
            var(--legal-shadow-sm);
        }

        .tool-list {
          display: grid;
          align-content: start;
          gap: 5px;

          padding: 7px;

          max-height:
            calc(100dvh - 165px);

          overflow-y: auto;
          overflow-x: hidden;

          scrollbar-width: thin;
        }

        .tool-button {
          min-height: 58px;

          display: grid;
          align-content: center;

          gap: 3px;

          padding:
            8px 9px;

          border:
            1px solid
            transparent;

          border-radius:
            var(--legal-radius-sm);

          background:
            transparent;

          color:
            var(--legal-text);

          text-align: left;

          cursor: pointer;
        }

        .tool-button:hover {
          background:
            var(--legal-surface-2);
        }

        .tool-button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          box-shadow:
            inset 2px 0 0
            var(--legal-gold);
        }

        .tool-button strong {
          font-size: 9px;
        }

        .tool-button span {
          color:
            var(--legal-muted);

          font-size: 7.5px;
          line-height: 1.35;
        }

        .history-panel {
          min-width: 0;

          max-height:
            calc(
              100dvh -
              165px
            );

          overflow: hidden;

          display: flex;
          flex-direction: column;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-lg);

          background:
            var(--legal-surface);

          box-shadow:
            var(--legal-shadow-sm);
        }

        .history-head {
          min-height: 54px;

          display: flex;
          align-items: center;
          justify-content:
            space-between;

          gap: 8px;

          padding:
            9px 10px;

          border-bottom:
            1px solid
            var(--legal-border);
        }

        .history-head > div {
          min-width: 0;

          display: grid;
          gap: 2px;
        }

        .history-head span {
          color:
            var(--legal-gold);

          font-size: 6.5px;
          font-weight: 900;
          letter-spacing:
            0.12em;
        }

        .history-head strong {
          color:
            var(--legal-text);

          font-size: 9px;
        }

        .history-head button {
          width: 29px;
          height: 29px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);

          color:
            var(--legal-text-soft);

          cursor: pointer;
        }

        .history-list {
          min-height: 0;

          overflow-y: auto;

          display: grid;
          align-content: start;

          gap: 6px;

          padding: 8px;

          scrollbar-width: thin;
        }

        .history-item {
          min-width: 0;

          display: grid;
          gap: 6px;

          padding:
            8px 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);
        }

        .history-file {
          min-width: 0;

          display: grid;
          gap: 2px;
        }

        .history-file strong {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          color:
            var(--legal-text);

          font-size: 8.5px;
        }

        .history-file span,
        .history-meta span {
          color:
            var(--legal-muted);

          font-size: 7px;
        }

        .history-meta {
          display: flex;
          align-items: center;
          justify-content:
            space-between;

          gap: 7px;
        }

        .history-actions {
          display: grid;

          grid-template-columns:
            1fr 1fr 1fr;

          gap: 5px;
        }

        .history-actions a,
        .history-actions button {
          height: 27px;

          display: flex;
          align-items: center;
          justify-content: center;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface);

          color:
            var(--legal-text-soft);

          text-decoration: none;

          font-size: 7.5px;
          font-weight: 800;
        }

        .history-actions a:hover,
        .history-actions button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .history-actions button {
          font-family:
            inherit;

          cursor: pointer;
        }

        .history-actions .history-delete {
          border-color:
            var(--legal-danger);

          color:
            var(--legal-danger);
        }

        .history-actions .history-delete:hover {
          background:
            color-mix(
              in srgb,
              var(--legal-danger)
              10%,
              transparent
            );
        }

        .history-actions .history-delete:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .history-empty {
          padding: 18px 12px;

          color:
            var(--legal-muted);

          text-align: center;

          font-size: 8px;
          line-height: 1.5;
        }
        .workspace {
          min-width: 0;

          padding: 11px;
        }

        .workspace-head {
          display: flex;
          align-items: flex-start;
          justify-content:
            space-between;

          gap: 12px;

          margin-bottom: 10px;
        }

        .workspace-head h2 {
          margin: 0;

          color:
            var(--legal-text);

          font-size: 14px;
        }

        .workspace-head p {
          margin:
            3px 0 0;

          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .file-counter {
          min-width: 62px;

          display: grid;
          justify-items: center;

          padding:
            6px 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);
        }

        .file-counter strong {
          color:
            var(--legal-gold);

          font-size: 15px;
        }

        .file-counter span {
          color:
            var(--legal-muted);

          font-size: 7px;
        }

        .drop-zone {
          min-height: 86px;

          display: grid;
          place-content: center;
          justify-items: center;

          gap: 4px;

          border:
            1px dashed
            var(--legal-border-strong);

          border-radius:
            var(--legal-radius-md);

          background:
            var(--legal-surface-2);

          cursor: pointer;
        }

        .drop-zone:hover {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);
        }

        .drop-zone input {
          display: none;
        }

        .drop-zone strong {
          color:
            var(--legal-text);

          font-size: 10px;
        }

        .drop-zone span {
          color:
            var(--legal-muted);

          font-size: 8px;
        }

        .selected-files {
          max-height: 145px;

          overflow-y: auto;

          display: grid;
          gap: 4px;

          margin-top: 7px;
        }

        .selected-file {
          min-width: 0;

          display: flex;
          align-items: center;
          justify-content:
            space-between;

          gap: 10px;

          padding:
            7px 8px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);
        }

        .selected-file strong {
          min-width: 0;

          overflow: hidden;
          text-overflow:
            ellipsis;
          white-space: nowrap;

          font-size: 8px;
        }

        .selected-file span {
          flex: 0 0 auto;

          color:
            var(--legal-muted);

          font-size: 7px;
        }

        .option-block {
          display: grid;
          gap: 5px;

          margin-top: 8px;

          padding: 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);
        }

        .option-block label {
          color:
            var(--legal-text);

          font-size: 8px;
          font-weight: 800;
        }

        .option-block > input {
          height: 32px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface);

          color:
            var(--legal-text);

          outline: none;

          font-size: 8.5px;
        }

        .option-block > input:focus {
          border-color:
            var(--legal-gold);
        }

        .option-block > span {
          color:
            var(--legal-muted);

          font-size: 7px;
        }

        .angle-buttons {
          display: flex;
          gap: 5px;
        }

        .angle-buttons button {
          height: 31px;
          min-width: 52px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface);

          color:
            var(--legal-text-soft);

          font-size: 8px;
          font-weight: 800;

          cursor: pointer;
        }

        .angle-buttons button.active {
          border-color:
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);
        }

        .converter-error {
          margin-top: 7px;

          color:
            var(--legal-danger);

          font-size: 8px;
        }

        .converter-actions {
          display: flex;
          gap: 6px;

          margin-top: 10px;
        }

        .primary-action,
        .download-action {
          height: 32px;

          display: inline-flex;
          align-items: center;
          justify-content: center;

          padding:
            0 12px;

          border-radius:
            var(--legal-radius-sm);

          font-size: 8.5px;
          font-weight: 850;
        }

        .primary-action {
          border:
            1px solid
            var(--legal-gold);

          background:
            var(--legal-gold);

          color:
            #17130b;

          cursor: pointer;
        }

        .primary-action:disabled {
          opacity: 0.45;
          cursor: default;
        }

        .download-action {
          border:
            1px solid
            var(--legal-gold);

          background:
            var(--legal-gold-soft);

          color:
            var(--legal-gold);

          text-decoration: none;
        }

        .text-result {
          margin-top: 8px;

          padding: 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);
        }

        .text-result-head {
          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 10px;

          margin-bottom: 7px;
        }

        .text-result-head > div:first-child {
          display: grid;
          gap: 2px;
        }

        .text-result-head span {
          color:
            var(--legal-gold);

          font-size: 6.5px;
          font-weight: 900;
          letter-spacing:
            0.12em;
        }

        .text-result-head strong {
          font-size: 8px;
        }

        .text-result-actions {
          display: flex;
          gap: 5px;
        }

        .text-result-actions button {
          height: 28px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface);

          color:
            var(--legal-text-soft);

          font-size: 7.5px;
          font-weight: 800;

          cursor: pointer;
        }

        .text-result-actions button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .text-result textarea {
          width: 100%;
          min-height: 180px;
          max-height: 300px;

          resize: vertical;

          padding: 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface);

          color:
            var(--legal-text);

          outline: none;

          font-family:
            inherit;

          font-size: 8px;
          line-height: 1.55;
        }
        .result-box {
          display: flex;
          align-items: center;
          justify-content:
            space-between;

          gap: 10px;

          margin-top: 8px;

          padding:
            8px 9px;

          border:
            1px solid
            var(--legal-success);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);
        }

        .result-box > div {
          min-width: 0;

          display: grid;
          gap: 2px;
        }

        .result-box > div > span {
          color:
            var(--legal-success);

          font-size: 6.5px;
          font-weight: 900;
          letter-spacing:
            0.13em;
        }

        .result-box strong {
          overflow: hidden;
          text-overflow:
            ellipsis;
          white-space: nowrap;

          font-size: 8px;
        }

        .result-box > span {
          flex: 0 0 auto;

          color:
            var(--legal-muted);

          font-size: 7px;
        }

        @media (
          max-width: 720px
        ) {
          .converter-page {
            padding:
              8px 7px 76px;
          }

          .converter-header > p {
            display: none;
          }

          .converter-shell {
            grid-template-columns:
              minmax(200px, 0.78fr)
            minmax(500px, 1.8fr)
            minmax(280px, 1fr);
          }

          .tool-list {
            display: flex;
            flex-wrap: nowrap;

            overflow-x: auto;
            overflow-y: hidden;

            max-height: none;

            padding: 5px;

            scroll-snap-type:
              x mandatory;

            -webkit-overflow-scrolling:
              touch;
          }

          .tool-list::-webkit-scrollbar {
            display: none;
          }

          .tool-button {
            flex: 0 0 auto;

            min-width: 138px;
            min-height: 50px;

            scroll-snap-align:
              start;
          }

          .workspace {
            padding: 10px;
          }

          .history-panel {
            max-height: none;

            order: 3;
          }

          .history-list {
            max-height: 260px;
          }

          .history-head {
            min-height: 46px;
          }

          .workspace-head {
            align-items: center;
          }

          .text-result {
          margin-top: 8px;

          padding: 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface-2);
        }

        .text-result-head {
          display: flex;
          align-items: center;
          justify-content: space-between;

          gap: 10px;

          margin-bottom: 7px;
        }

        .text-result-head > div:first-child {
          display: grid;
          gap: 2px;
        }

        .text-result-head span {
          color:
            var(--legal-gold);

          font-size: 6.5px;
          font-weight: 900;
          letter-spacing:
            0.12em;
        }

        .text-result-head strong {
          font-size: 8px;
        }

        .text-result-actions {
          display: flex;
          gap: 5px;
        }

        .text-result-actions button {
          height: 28px;

          padding:
            0 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface);

          color:
            var(--legal-text-soft);

          font-size: 7.5px;
          font-weight: 800;

          cursor: pointer;
        }

        .text-result-actions button:hover {
          border-color:
            var(--legal-gold);

          color:
            var(--legal-gold);
        }

        .text-result textarea {
          width: 100%;
          min-height: 180px;
          max-height: 300px;

          resize: vertical;

          padding: 9px;

          border:
            1px solid
            var(--legal-border);

          border-radius:
            var(--legal-radius-sm);

          background:
            var(--legal-surface);

          color:
            var(--legal-text);

          outline: none;

          font-family:
            inherit;

          font-size: 8px;
          line-height: 1.55;
        }
        .result-box {
            align-items:
              flex-start;

            flex-direction:
              column;
          }
        }

        @media (min-width: 901px) {
          .converter-page {
            height: 100vh;
            min-height: 0;
            padding: 10px 72px 10px 10px;
            overflow: hidden;
          }

          .converter-header {
            height: 58px;
            padding: 0 16px;
            border: 1px solid var(--legal-border);
            border-radius: 20px 20px 0 0;
            background: color-mix(in srgb, var(--legal-surface) 92%, transparent);
            box-shadow: var(--legal-shadow-sm);
            backdrop-filter: blur(20px);
          }

          .converter-header h1 {
            font-size: 16px;
            font-weight: 850;
          }

          .converter-header > p {
            font-size: 10px;
          }

          .converter-shell {
            height: calc(100vh - 78px);
            min-height: 0;
            grid-template-columns: 184px minmax(0, 1fr) 276px;
            gap: 10px;
            margin-top: 0;
            padding: 10px;
            border: 1px solid var(--legal-border);
            border-top: 0;
            border-radius: 0 0 20px 20px;
            background: color-mix(in srgb, var(--legal-surface) 88%, transparent);
            box-shadow: var(--legal-shadow-md);
            backdrop-filter: blur(20px);
          }

          .tool-list,
          .workspace,
          .history-panel {
            height: 100%;
            min-height: 0;
            max-height: none;
            background: color-mix(in srgb, var(--legal-surface) 94%, transparent);
          }

          .tool-list {
            gap: 4px;
            padding: 8px;
          }

          .tool-button {
            min-height: 44px;
            gap: 2px;
            padding: 7px 9px;
          }

          .tool-button strong {
            font-size: 10px;
            line-height: 1.25;
          }

          .tool-button span {
            font-size: 8px;
            line-height: 1.3;
          }

          .workspace {
            padding: 16px;
            overflow-y: auto;
            scrollbar-width: thin;
          }

          .workspace-head {
            margin-bottom: 14px;
          }

          .workspace-head h2 {
            font-size: 17px;
          }

          .workspace-head p {
            font-size: 10px;
          }

          .drop-zone {
            min-height: 132px;
            border-radius: 14px;
          }

          .drop-zone strong {
            font-size: 13px;
          }

          .drop-zone span {
            font-size: 9px;
          }

          .primary-action,
          .download-action {
            height: 36px;
            font-size: 10px;
          }

          .history-head {
            min-height: 58px;
            padding: 11px 12px;
          }

          .history-head strong {
            font-size: 11px;
          }

          .history-head span,
          .history-file span,
          .history-meta span {
            font-size: 8px;
          }

          .history-list {
            gap: 7px;
            padding: 9px;
          }

          .history-item {
            padding: 10px;
            border-radius: 10px;
          }

          .history-file strong {
            font-size: 9.5px;
          }

          .history-actions a,
          .history-actions button {
            height: 29px;
            font-size: 8px;
          }

          .history-empty {
            font-size: 9px;
          }
        }
      `}</style>
    </main>
  );
}

















