import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

export const runtime =
  "nodejs";

function safeText(
  value: unknown,
  maxLength: number
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .slice(
          0,
          maxLength
        )
    : "";
}

export async function POST(
  request: NextRequest
) {
  try {
    const {
      appUser,
      error,
    } =
      await getOrCreateAppUser();

    if (
      error ||
      !appUser
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            error ||
            "Oturum bulunamadı.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const text =
      safeText(
        body?.text,
        1_500_000
      );

    const title =
      safeText(
        body?.title,
        500
      ) ||
      "UETS Tebligatı";

    const sourceUrl =
      safeText(
        body?.url,
        3000
      );

    if (
      text.length <
      30
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Tebligat içeriği okunamadı.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      sourceUrl &&
      !sourceUrl.startsWith(
        "https://ptt.etebligat.gov.tr/"
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Geçersiz UETS kaynağı.",
        },
        {
          status: 400,
        }
      );
    }

    const aiUrl =
      new URL(
        "/api/ai",
        request.url
      );

    const aiResponse =
      await fetch(
        aiUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            cookie:
              request.headers
                .get(
                  "cookie"
                ) ||
              "",
          },

          body:
            JSON.stringify({
              subject:
                title,

              sender:
                "PTT UETS",

              body:
                text,
            }),

          cache:
            "no-store",
        }
      );

    const aiData =
      await aiResponse
        .json();

    if (
      !aiResponse.ok ||
      !aiData?.ok
    ) {
      return NextResponse.json(
        {
          ok: false,

          error:
            aiData?.error ||
            "UETS belge analizi yapılamadı.",
        },
        {
          status:
            aiResponse.status ||
            500,
        }
      );
    }

    /*
     * ÖNEMLİ:
     * Bu endpoint yalnız analiz yapar.
     * Takvime otomatik kayıt YAPMAZ.
     *
     * Duruşma / doğrulanmış süre sınıflandırmasını
     * bir sonraki katmanda güvenli biçimde bağlayacağız.
     */

    return NextResponse.json({
      ok: true,

      source: {
        type:
          "uets_browser_bridge",

        url:
          sourceUrl,

        title,
      },

      analysis:
        aiData.analysis ||
        aiData.data
          ?.analysis ||
        null,

      uetsExtraction:
        aiData
          .uetsExtraction ||
        aiData.data
          ?.uetsExtraction ||
        null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof
          Error
            ? error.message
            : "UETS analizi başarısız.",
      },
      {
        status: 500,
      }
    );
  }
}