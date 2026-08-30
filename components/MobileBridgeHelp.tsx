import Link from "next/link";

export default function MobileBridgeHelp() {
  return (
    <section className="mobile-bridge-help">
      <h1>Masaüstünden doğrudan aktarım</h1>
      <p>UETS/CELSE doğrudan aktarımı masaüstünde METHER Bridge ile kullanılabilir.</p>
      <p>Mobil Chrome, masaüstü Chrome eklentisini çalıştırmaz. Telefonunuzdaki belgeyi mevcut belge analiz ve dava aktarım akışında yükleyebilirsiniz.</p>
      <Link href="/cases?import=document">Belge Yükle</Link>
      <p>Belgeyi kontrol edip kaydetmeden dava kaydı oluşturulmaz.</p>
    </section>
  );
}
