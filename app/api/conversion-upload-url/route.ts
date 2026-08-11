import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  getOrCreateAppUser,
} from "@/lib/alUser";

import {
  getSupabaseAdmin,
} from "@/lib/supabaseAdmin";

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
      (await request.json()) as {
        fileName?: string;
        fileType?: string;
        fileSize?: number;
      };

    const fileName =
      String(
        body.fileName ||
        ""
      ).trim();

    const fileType =
      String(
        body.fileType ||
        ""
      ).trim();

    const fileSize =
      Number(
        body.fileSize ||
        0
      );

    if (
      !fileName
        .toLowerCase()
        .endsWith(
          ".pdf"
        )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Yalnızca PDF destekleniyor.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      fileType &&
      fileType !==
        "application/pdf"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Geçersiz PDF türü.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(
        fileSize
      ) ||
      fileSize <= 0 ||
      fileSize >
        45 *
          1024 *
          1024
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "PDF en fazla 45 MB olabilir.",
        },
        {
          status: 400,
        }
      );
    }

    const storagePath =
      `tmp/${appUser.id}/${crypto.randomUUID()}.pdf`;

    const supabase =
      getSupabaseAdmin();

    const signed =
      await supabase
        .storage
        .from(
          "legal-conversions"
        )
        .createSignedUploadUrl(
          storagePath,
          {
            upsert: false,
          }
        );

    if (
      signed.error ||
      !signed.data
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            signed.error
              ?.message ||
            "Yükleme bağlantısı oluşturulamadı.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,

      storagePath,

      signedUrl:
        signed.data
          .signedUrl,
    });
  } catch (
    error: unknown
  ) {
    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "Geçici yükleme hazırlanamadı.",
      },
      {
        status: 500,
      }
    );
  }
}
