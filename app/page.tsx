import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { BellRing, CalendarCheck2, FileCheck2, Gavel, MailCheck, ShieldCheck } from "lucide-react";

import { authOptions } from "@/lib/auth";

const SITE_URL = "https://legal.almether.com";
const TITLE = "Avukat Yazılımı ve Dava Takip Programı | AL METHER Legal";
const DESCRIPTION =
  "AL METHER Legal; dava, hukuki süre, duruşma ve tebligat takibini UYAP ve UETS entegrasyonlarıyla tek çalışma alanında birleştiren avukat yazılımıdır.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: SITE_URL,
    siteName: "AL METHER Legal",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "AL METHER Legal avukat yazılımı" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AL METHER Legal",
  url: SITE_URL,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Hukuk Bürosu Yönetim Yazılımı",
  operatingSystem: "Web, Windows",
  inLanguage: "tr-TR",
  description: DESCRIPTION,
  image: `${SITE_URL}/opengraph-image`,
  featureList: [
    "Dava ve dosya takibi",
    "Hukuki süre ve duruşma takibi",
    "UETS tebligat aktarımı",
    "UYAP ve CELSE dava aktarımı",
    "Avukat takvimi ve alarm yönetimi",
  ],
};

const features = [
  { icon: Gavel, title: "Dava takibi", description: "Dosya, mahkeme ve duruşma bilgilerini düzenli bir çalışma alanında izleyin." },
  { icon: CalendarCheck2, title: "Hukuki süre takibi", description: "Kritik süreleri, duruşmaları ve görevleri avukat takvimiyle birlikte yönetin." },
  { icon: MailCheck, title: "UETS entegrasyonu", description: "Tebligat içeriğini güvenli tarayıcı köprüsüyle Legal çalışma alanına aktarın." },
  { icon: FileCheck2, title: "UYAP / CELSE entegrasyonu", description: "Dava ve duruşma verilerini yeniden yazmadan dosyanızla eşleştirin." },
  { icon: BellRing, title: "Akıllı hatırlatmalar", description: "Yaklaşan hukuki işlemler için takvim ve alarm bildirimlerini tek yerde görün." },
  { icon: ShieldCheck, title: "Güvenli çalışma alanı", description: "Hukuki iş akışınızı erişim kontrollü, kullanıcı odaklı bir ortamda sürdürün." },
];

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="h-[100dvh] overflow-y-auto bg-[#050811] text-[#f5f2eb]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationSchema).replace(/</g, "\\u003c"),
        }}
      />

      <div className="relative isolate min-h-full overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[linear-gradient(rgba(2,5,13,0.84),rgba(2,5,13,0.97)),url('/brand/legal-login-background.webp')] bg-cover bg-center" />
        <div aria-hidden="true" className="absolute left-1/2 top-[-18rem] -z-10 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[#c8a45f]/10 blur-3xl" />

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex items-center gap-3" aria-label="AL METHER Legal ana sayfa">
            <Image src="/brand/legal-icon-dark.png" alt="AL METHER Legal" width={470} height={370} priority sizes="44px" className="h-11 w-11 object-contain" />
            <span className="grid leading-none">
              <strong className="text-sm tracking-[0.08em]">AL METHER</strong>
              <span className="mt-1 text-[9px] font-bold tracking-[0.28em] text-[#c8a45f]">LEGAL</span>
            </span>
          </Link>
          <Link href="/login" className="rounded-xl border border-[#c8a45f]/45 bg-[#0f141d]/80 px-4 py-2.5 text-xs font-bold text-[#e7ce95] transition hover:border-[#c8a45f] hover:bg-[#c8a45f]/10">
            Giriş Yap
          </Link>
        </header>

        <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-10 lg:pb-24 lg:pt-24">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#c8a45f]">Hukuki işleriniz için tek çalışma alanı</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Dava, süre ve tebligat takibinde daha sakin bir çalışma günü.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[#b8bdc7] sm:text-lg">
              AL METHER Legal; dava takip programı, hukuki süre takip sistemi ve avukat takvimini UYAP ile UETS iş akışlarıyla bir araya getirir.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login" className="rounded-xl border border-[#c8a45f] bg-gradient-to-br from-[#d9b86e] to-[#a97e34] px-6 py-3.5 text-sm font-extrabold text-[#090a0d] transition hover:brightness-110">
                Legal’e Giriş Yap
              </Link>
              <Link href="/privacy" className="rounded-xl border border-[#30394a] bg-[#0f141d]/70 px-6 py-3.5 text-sm font-bold text-[#d5d0c7] transition hover:border-[#c8a45f]/55">
                Gizlilik Politikası
              </Link>
            </div>
          </div>

          <aside className="rounded-[28px] border border-[#c8a45f]/25 bg-[#0b1019]/85 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.38)] backdrop-blur-xl sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c8a45f]">Legal çalışma akışı</p>
            <div className="mt-5 grid gap-3">
              {features.slice(0, 4).map(({ icon: Icon, title }) => (
                <div key={title} className="flex items-center gap-3 rounded-xl border border-[#283243] bg-[#111722]/85 p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#c8a45f]/10 text-[#d9b86e]">
                    <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
                  </span>
                  <span className="text-sm font-semibold text-[#e8e3d9]">{title}</span>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="border-y border-[#202938] bg-[#080c14]/85">
          <div className="mx-auto grid w-full max-w-6xl gap-4 px-5 py-12 sm:grid-cols-2 sm:px-8 lg:grid-cols-3 lg:px-10">
            {features.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-2xl border border-[#242e3d] bg-[#0f141d]/75 p-5">
                <Icon aria-hidden="true" className="text-[#c8a45f]" size={21} strokeWidth={1.7} />
                <h2 className="mt-4 text-base font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#9da4b0]">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 text-xs text-[#858d9a] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
          <span>© 2026 AL METHER Legal</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-[#d9b86e]">Gizlilik</Link>
            <a href="mailto:info@almether.com" className="hover:text-[#d9b86e]">İletişim</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
