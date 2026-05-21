"use client"

import { useState } from "react"

export default function Home() {

  const [cevap, setCevap] =
    useState("")

  const [loading, setLoading] =
    useState(false)

  const [arama, setArama] =
    useState("")

  const [seciliDava, setSeciliDava] =
    useState<any>(null)

  const [davalar, setDavalar] =
    useState([

      {
        id: 1,
        ad: "İcra Takibi",
        muvekkil: "Ahmet Yılmaz",
        durum: "🔴 Kritik",
        kalan: 2,
        not:
          "Borçlu itiraz hazırlığında."
      },

      {
        id: 2,
        ad: "Tahliye Davası",
        muvekkil: "Ayşe Kaya",
        durum: "🟡 Yaklaşıyor",
        kalan: 6,
        not:
          "Duruşma tarihi yaklaşıyor."
      },

      {
        id: 3,
        ad: "İtiraz Dosyası",
        muvekkil: "Mehmet Demir",
        durum: "🟢 Normal",
        kalan: 14,
        not:
          "Belgeler tamamlandı."
      }

    ])

  const filtreliDavalar =
    davalar.filter(

      (dava) =>

        dava.ad
          .toLowerCase()
          .includes(
            arama.toLowerCase()
          )

        ||

        dava.muvekkil
          .toLowerCase()
          .includes(
            arama.toLowerCase()
          )

    )

  async function aiTaslakOlustur() {

    setLoading(true)

    try {

      const res =
        await fetch(
          "/api/ai",
          {
            method: "POST",

            headers: {

              "Content-Type":
                "application/json"

            },

            body: JSON.stringify({

              prompt:

`Türk hukuk sistemine uygun,
profesyonel bir cevap
dilekçesi oluştur.`

            })

          }
        )

      const data =
        await res.json()

      setCevap(
        data.text
      )

    }

    catch {

      setCevap(
        "AI bağlantı hatası."
      )

    }

    setLoading(false)
  }

  async function pdfYukle(
    e: any
  ) {

    try {

      const file =
        e.target.files?.[0]

      if (!file) return

      setLoading(true)

      const formData =
        new FormData()

      formData.append(
        "file",
        file
      )

      const res =
        await fetch(
          "/api/pdf",
          {
            method: "POST",
            body: formData
          }
        )

      const data =
        await res.json()

      setCevap(
        data.text
      )

    }

    catch {

      setCevap(
        "PDF yükleme hatası."
      )

    }

    setLoading(false)
  }

  function yeniDava() {

    const ad =
      prompt("Dava adı")

    const muvekkil =
      prompt("Müvekkil adı")

    const kalan =
      prompt("Kaç gün kaldı?")

    if (
      !ad ||
      !muvekkil
    )
      return

    let durum =
      "🟢 Normal"

    if (
      Number(kalan) <= 3
    ) {

      durum =
        "🔴 Kritik"

    }

    else if (
      Number(kalan) <= 7
    ) {

      durum =
        "🟡 Yaklaşıyor"

    }

    setDavalar([

      ...davalar,

      {
        id: Date.now(),
        ad,
        muvekkil,
        durum,
        kalan:
          Number(kalan) || 14,
        not:
          "Yeni dava oluşturuldu."
      }

    ])
  }

  function davaSil() {

    const yeniListe =
      davalar.filter(

        (d: any) =>
          d.id !== seciliDava.id

      )

    setDavalar(
      yeniListe
    )

    setSeciliDava(null)
  }

  const kritik =
    davalar.filter(
      d =>
        d.durum.includes("Kritik")
    ).length

  const yaklasan =
    davalar.filter(
      d =>
        d.durum.includes("Yaklaşıyor")
    ).length

  const normal =
    davalar.filter(
      d =>
        d.durum.includes("Normal")
    ).length

  return (

    <main className="min-h-screen bg-black text-white p-8">

      <div className="flex items-center justify-between mb-10">

        <div>

          <h1 className="text-5xl font-bold">

            ⚖️ AL Mether Legal

          </h1>

          <p className="text-zinc-400 mt-2">

            AI Hukuk Otomasyon Sistemi

          </p>

        </div>

        <div className="text-right">

          <p className="text-zinc-500">

            Demo Sürüm

          </p>

          <p className="text-green-400 text-xl">

            Sistem Aktif

          </p>

        </div>

      </div>

      <div className="grid md:grid-cols-3 gap-5 mb-8">

        <div className="bg-red-600 p-6 rounded-3xl">

          <h2 className="text-2xl font-bold">

            Kritik

          </h2>

          <p className="text-6xl mt-3 font-bold">

            {kritik}

          </p>

        </div>

        <div className="bg-yellow-500 p-6 rounded-3xl">

          <h2 className="text-2xl font-bold">

            Yaklaşan

          </h2>

          <p className="text-6xl mt-3 font-bold">

            {yaklasan}

          </p>

        </div>

        <div className="bg-green-600 p-6 rounded-3xl">

          <h2 className="text-2xl font-bold">

            Normal

          </h2>

          <p className="text-6xl mt-3 font-bold">

            {normal}

          </p>

        </div>

      </div>

      <div className="flex flex-wrap gap-4 mb-8">

        <button

          onClick={
            aiTaslakOlustur
          }

          className="bg-purple-600 hover:bg-purple-700 transition px-6 py-3 rounded-2xl text-lg"

        >

          🤖 AI Taslak Oluştur

        </button>

        <label className="bg-blue-600 hover:bg-blue-700 transition px-6 py-3 rounded-2xl text-lg cursor-pointer">

          📄 PDF Yükle

          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={pdfYukle}
          />

        </label>

        <button

          onClick={
            yeniDava
          }

          className="bg-green-600 hover:bg-green-700 transition px-6 py-3 rounded-2xl text-lg"

        >

          ➕ Yeni Dava

        </button>

      </div>

      <input

        type="text"

        placeholder="Dava veya müvekkil ara..."

        value={arama}

        onChange={(e) =>
          setArama(
            e.target.value
          )
        }

        className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl p-4 mb-8 text-white outline-none"

      />

      {

        loading && (

          <div className="bg-zinc-900 p-5 rounded-3xl mb-8 border border-zinc-700">

            🤖 AI düşünüyor...

          </div>

        )

      }

      {

        cevap && (

          <div className="bg-zinc-900 p-6 rounded-3xl mb-8 border border-zinc-700 whitespace-pre-wrap">

            <h2 className="text-3xl font-bold text-green-400 mb-5">

              🤖 AI Dilekçe Taslağı

            </h2>

            {cevap}

          </div>

        )

      }

      <div className="space-y-5">

        {

          filtreliDavalar.map((dava) => (

            <div

              key={dava.id}

              onClick={() =>
                setSeciliDava(dava)
              }

              className="bg-zinc-900 border border-zinc-700 hover:border-green-500 transition p-6 rounded-3xl cursor-pointer"

            >

              <div className="flex items-center justify-between">

                <div>

                  <h2 className="text-3xl font-bold text-green-400">

                    {dava.ad}

                  </h2>

                  <p className="mt-3 text-lg">

                    👤 {dava.muvekkil}

                  </p>

                  <p className="mt-2 text-lg">

                    ⏳ {dava.kalan} gün kaldı

                  </p>

                </div>

                <div className="text-xl">

                  {dava.durum}

                </div>

              </div>

            </div>

          ))

        }

      </div>

      {

        seciliDava && (

          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">

            <div className="bg-zinc-900 border border-zinc-700 p-10 rounded-3xl w-[750px] max-w-[95%]">

              <div className="flex justify-between items-start mb-6">

                <div>

                  <h2 className="text-4xl font-bold text-green-400">

                    {seciliDava.ad}

                  </h2>

                  <p className="text-xl mt-4">

                    👤 {seciliDava.muvekkil}

                  </p>

                </div>

                <div className="text-xl">

                  {seciliDava.durum}

                </div>

              </div>

              <div className="bg-black border border-zinc-700 rounded-3xl p-6 mb-6">

                <h3 className="text-2xl text-green-400 mb-4">

                  📌 Dava Bilgisi

                </h3>

                <p className="text-lg">

                  ⏳ {seciliDava.kalan} gün kaldı

                </p>

                <p className="mt-4 text-lg">

                  📝 {seciliDava.not}

                </p>

              </div>

              <div className="bg-black border border-zinc-700 rounded-3xl p-6 mb-8">

                <h3 className="text-2xl text-green-400 mb-4">

                  🤖 AI Önerisi

                </h3>

                <p className="text-lg">

                  Dosya süresi kontrol edilmeli.
                </p>

                <p className="text-lg mt-3">

                  Müvekkil ile iletişim kurulmalı.
                </p>

                <p className="text-lg mt-3">

                  Evrak eksikleri gözden geçirilmeli.
                </p>

              </div>

              <div className="flex gap-4 flex-wrap">

                <button

                  onClick={
                    davaSil
                  }

                  className="bg-red-600 hover:bg-red-700 transition px-6 py-3 rounded-2xl text-lg"

                >

                  🗑️ Davayı Sil

                </button>

                <button

                  onClick={() =>
                    setSeciliDava(null)
                  }

                  className="bg-zinc-700 hover:bg-zinc-600 transition px-6 py-3 rounded-2xl text-lg"

                >

                  Kapat

                </button>

              </div>

            </div>

          </div>

        )

      }

    </main>
  )
}