import { NextResponse } from "next/server"

export async function POST(req: Request) {

  try {

    const formData =
      await req.formData()

    const file =
      formData.get("file")

    if (!file) {

      return NextResponse.json({

        text:
          "PDF bulunamadı."

      })

    }

    return NextResponse.json({

      text:
        "PDF başarıyla yüklendi."

    })

  }

  catch (error) {

    console.log(error)

    return NextResponse.json({

      text:
        "PDF yükleme hatası."

    })

  }

}