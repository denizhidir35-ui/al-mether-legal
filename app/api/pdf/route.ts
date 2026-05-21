import { NextResponse } from "next/server"

export async function POST() {

  return NextResponse.json({

    text:

`PDF başarıyla yüklendi.

Bu demo sürümünde PDF analizi
geçici olarak kapalıdır.

AI sistemi çalışıyor.`

  })

}