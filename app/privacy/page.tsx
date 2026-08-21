import Image from "next/image";

export const metadata = {
  title: "Gizlilik Politikası | AL METHER Legal",
  description: "AL METHER Legal UETS ve CELSE / UYAP köprüleri gizlilik politikası.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f6f3ec] px-5 py-10 text-[#172033] sm:px-8">
      <article className="mx-auto max-w-3xl rounded-[28px] border border-[#d8d1c3] bg-white/95 p-6 shadow-[0_24px_70px_rgba(35,28,18,0.10)] sm:p-10">
        <Image
          src="/brand/legal-logo-light.png"
          alt="AL METHER Legal"
          width={108}
          height={101}
          className="mb-6 h-auto w-[108px] object-contain"
          priority
        />

        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a87517]">
          UETS ve CELSE / UYAP Köprüleri
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Gizlilik Politikası</h1>
        <p className="mt-2 text-sm text-[#667085]">Son güncelleme: 20 Ağustos 2026</p>

        <div className="mt-8 space-y-6 text-[15px] leading-7 text-[#3d4657]">
          <section>
            <h2 className="text-lg font-semibold text-[#172033]">İşlenen içerik</h2>
            <p className="mt-2">
              METHER UETS Bridge ve METHER CELSE / UYAP Bridge, yalnız kullanıcı ilgili portalda
              <strong> “METHER&apos;e Aktar” </strong>
              düğmesine bastığında açık UETS tebligatı veya UYAP dava ve duruşma içeriğini AL METHER
              Legal çalışma alanına aktarır. Aktarım, dava eşleştirme, belge analizi ve takvim kaydı
              gibi kullanıcının başlattığı hukuki iş akışını tamamlamak amacıyla yapılır.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#172033]">Toplanmayan veriler</h2>
            <p className="mt-2">
              Uzantılar parola, çerez, erişim veya yenileme tokenı, oturum anahtarı ya da tarayıcıdaki
              kimlik doğrulama bilgilerini toplamaz ve METHER&apos;e aktarmaz.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#172033]">Kullanım ve paylaşım</h2>
            <p className="mt-2">
              Aktarılan içerik yalnız kullanıcının talep ettiği AL METHER Legal işlevlerini sunmak için
              işlenir. Veriler satılmaz, reklam amacıyla kullanılmaz ve reklam profili oluşturmak için
              paylaşılmaz.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-[#172033]">İletişim</h2>
            <p className="mt-2">
              Gizlilik talepleri için <a className="font-semibold text-[#9a6910] underline" href="mailto:info@almether.com">info@almether.com</a> adresinden bize ulaşabilirsiniz.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
