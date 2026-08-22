const INSTALLER_NAME = "AL-METHER-Legal-Setup.exe";
const INSTALLER_SIZE = "11.157.309 bayt";
const INSTALLER_VERSION = "1.0.6.0";
const INSTALLER_SHA256 =
  "725B84FD4261676CE2DA2A78FB87F56561787D046CBD670ED8D0A83B8192D594";

const DOWNLOAD_URL =
  "https://github.com/denizhidir35-ui/al-mether-legal/releases/download/v1.0.6/AL-METHER-Legal-Setup.exe";
const MOBILE_WEB_URL = "https://legal.almether.com";

// Sabit hedef için önceden üretilmiş QR matrisi; runtime bağımlılığı veya dış istek yoktur.
const MOBILE_QR_MATRIX = [
  "1111111001000000101111111",
  "1000001011011011101000001",
  "1011101001110011101011101",
  "1011101011010110001011101",
  "1011101000101010101011101",
  "1000001010100011001000001",
  "1111111010101010101111111",
  "0000000000001001100000000",
  "1111101111101110010101010",
  "1110010101000100100100010",
  "1100001101011001111001011",
  "1010000101110001011110001",
  "1110111011011111011010111",
  "1111010011101000100101010",
  "1001101011100011011111011",
  "1011000100100010110110001",
  "1011011010011110111110100",
  "0000000011010011100011000",
  "1111111011100100101010111",
  "1000001000110001100011000",
  "1011101011111101111110100",
  "1011101010010101011011111",
  "1011101010100110100001101",
  "1000001011011001101111001",
  "1111111010001110011111111",
] as const;

export const dynamic = "force-dynamic";

function renderMobileQrCode() {
  const modules = MOBILE_QR_MATRIX.flatMap((row, y) =>
    [...row].map((module, x) => (module === "1" ? `M${x} ${y}h1v1h-1z` : "")),
  ).join("");

  return `<svg class="desktopQr" viewBox="0 0 33 33" role="img" aria-labelledby="desktopQrTitle desktopQrDescription" shape-rendering="crispEdges">
    <title id="desktopQrTitle">legal.almether.com QR kodu</title>
    <desc id="desktopQrDescription">AL METHER Legal'i telefonda açmak için tarayın.</desc>
    <rect width="33" height="33" rx="1.6" fill="#f8f5ed" />
    <path d="${modules}" transform="translate(4 4)" fill="#07101f" />
  </svg>`;
}

function renderDownloadButton(downloadAvailable: boolean) {
  if (!downloadAvailable) {
    return `
      <span class="downloadButton downloadDisabled" aria-disabled="true">
        <b class="downloadGlyph" aria-hidden="true">↓</b>
        <span>
          <strong>Windows için İndir</strong>
          <small>Yayın hazırlanıyor</small>
        </span>
      </span>`;
  }

  return `
    <a class="downloadButton" href="${DOWNLOAD_URL}">
      <b class="downloadGlyph" aria-hidden="true">↓</b>
      <span>
        <strong>Windows için İndir</strong>
        <small>Windows 10/11 · ${INSTALLER_SIZE}</small>
      </span>
    </a>`;
}

export async function GET() {
  let downloadAvailable = false;

  try {
    const installerResponse = await fetch(DOWNLOAD_URL, {
      method: "HEAD",
      cache: "no-store",
    });

    downloadAvailable = installerResponse.ok;
  } catch {
    // Depolama geçici olarak doğrulanamazsa kullanıcıya bozuk bağlantı sunma.
  }

  const html = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#050912" />
    <meta name="description" content="AL METHER Legal resmi Windows 10/11 kurulum dosyasını indirin." />
    <title>Windows için İndir | AL METHER Legal</title>
    <link rel="icon" href="/brand/legal-app-icon-light.png" />
    <link rel="stylesheet" href="/download.css" />
    <script src="/download-install.js" defer></script>
  </head>
  <body>
    <main class="page">
      <div class="glow" aria-hidden="true"></div>

      <header class="header">
        <a class="brand" href="/download" aria-label="AL METHER Legal">
          <img class="brandIcon" src="/brand/legal-icon-dark.png" alt="" width="42" height="42" />
          <span><strong>AL METHER</strong><small>LEGAL</small></span>
        </a>
        <div class="officialBadge"><b aria-hidden="true">✓</b> Resmî indirme</div>
      </header>

      <section class="mobileInstallSection" aria-labelledby="mobileInstallTitle">
        <div class="mobileInstallCard">
          <div class="mobileAppIdentity">
            <img src="/brand/legal-app-icon-dark.png" alt="" width="58" height="58" />
            <div>
              <span class="mobileEyebrow">Mobil çalışma alanı</span>
              <h2 id="mobileInstallTitle">AL METHER Legal cebinizde.</h2>
            </div>
          </div>

          <p class="mobileLead">
            PDF ve fotoğraf yükleyin, kameradan belge çekin;<br />
            davalarınızı ve kritik tarihlerinizi telefondan yönetin.
          </p>

          <ul class="mobileFeatures" aria-label="Mobil özellikler">
            <li>Kameradan Belge</li>
            <li>PDF &amp; Fotoğraf</li>
            <li>Dava</li>
            <li>Takvim &amp; Alarm</li>
          </ul>

          <div class="mobileInstallOptions">
            <div class="iosInstall">
              <a class="mobilePrimaryButton" href="/inbox">Telefonda Aç</a>
              <p>Safari <span aria-hidden="true">→</span> Paylaş <span aria-hidden="true">→</span> Ana Ekrana Ekle</p>
            </div>

            <div class="androidInstall">
              <button class="mobilePrimaryButton pwaInstallButton" type="button">Uygulamayı Yükle</button>
              <p class="androidFallback">Chrome <span aria-hidden="true">→</span> Menü <span aria-hidden="true">→</span> Uygulamayı yükle / Ana ekrana ekle</p>
            </div>

            <a class="mobileWebButton" href="/inbox">Web'de Aç</a>
          </div>
        </div>
      </section>

      <section class="hero">
        <div class="copy">
          <div class="eyebrow">
            <span class="windowsMark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            Windows masaüstü uygulaması
          </div>
          <h1>Hukuk iş akışınız,<span>artık her yerde.</span></h1>
          <p class="lead">
            AL METHER Legal’a Windows uygulamasından veya mobil cihazınızdan erişin.<br />
            Dosyalarınızı, kritik tarihlerinizi ve çalışma alanınızı her yerden yönetin.
          </p>
          <div class="actions">
            <div class="actionButtons">
              ${renderDownloadButton(downloadAvailable)}
              <a class="webOpenButton" href="/inbox">Web’de Aç</a>
            </div>
            <div class="compatibility">
              <b aria-hidden="true">✓</b>
              <span>Windows 10/11</span><i aria-hidden="true">•</i>
              <span>Otomatik güncelleme</span><i aria-hidden="true">•</i>
              <span>SHA-256 doğrulama</span>
            </div>
          </div>
        </div>

        <div class="installerRail">
          <aside class="installerCard" aria-label="Kurulum dosyası bilgileri">
            <div class="cardTopline"><span>WINDOWS INSTALLER</span><span>v${INSTALLER_VERSION}</span></div>
            <div class="appIdentity">
              <div class="appIcon">
                <img src="/brand/legal-app-icon-dark.png" alt="AL METHER Legal uygulama ikonu" width="76" height="76" />
              </div>
              <div><p>AL METHER Legal</p><span>Windows 10/11</span></div>
            </div>
            <div class="fileRow">
              <b class="fileGlyph" aria-hidden="true">▣</b>
              <div><span>Kurulum dosyası</span><strong>${INSTALLER_NAME}</strong></div>
              <small>${INSTALLER_SIZE}</small>
            </div>
            <div class="checksum">
              <div><b aria-hidden="true">✓</b><span>SHA-256 doğrulama değeri</span></div>
              <code>${INSTALLER_SHA256}</code>
            </div>
            <p class="securityNote">
              Dosya bütünlüğünü doğrulamak için indirme sonrası SHA-256 değerini karşılaştırabilirsiniz.
            </p>
          </aside>
          <section class="desktopMobileCard" aria-labelledby="desktopMobileTitle">
            <div class="desktopMobileCopy">
              <span class="desktopMobileKicker">MOBİL ERİŞİM</span>
              <h2 id="desktopMobileTitle">Telefonda da kullanın</h2>
              <p class="desktopMobileDescription">
                PDF ve fotoğraf yükleyin, kameradan belge çekin;<br />
                davalarınızı ve kritik tarihlerinizi telefondan yönetin.
              </p>
              <div class="desktopPlatformGuides">
                <p><strong>iPhone / iPad</strong><span>Safari → Paylaş → Ana Ekrana Ekle</span></p>
                <p><strong>Android</strong><span>Chrome → Uygulamayı Yükle / Ana ekrana ekle</span></p>
              </div>
              <ul class="desktopMobileCapabilities" aria-label="Mobil yetenekler">
                <li><b aria-hidden="true">◉</b>Kamera</li>
                <li><b aria-hidden="true">▤</b>PDF &amp; Fotoğraf</li>
                <li><b aria-hidden="true">§</b>Dava</li>
                <li><b aria-hidden="true">◇</b>Takvim &amp; Alarm</li>
              </ul>
              <a class="desktopMobileUrl" href="${MOBILE_WEB_URL}">legal.almether.com</a>
            </div>
            <a class="desktopQrLink" href="${MOBILE_WEB_URL}" aria-label="AL METHER Legal'i telefonda aç: legal.almether.com">
              ${renderMobileQrCode()}
              <span>Kamerayla tarayın</span>
            </a>
          </section>
        </div>
      </section>

      <footer class="footer"><span>© 2026 AL METHER</span><span>Resmî Windows dağıtımı</span></footer>
    </main>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=60",
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
