const INSTALLER_NAME = "AL-METHER-Legal-Setup.exe";
const INSTALLER_SIZE = "10,5 MB";
const INSTALLER_SHA256 =
  "B39BA787BD3EDDA0B1F123E10E332CFF63A20CCA2428DA614E0EEBC2185CAD5D";

const DOWNLOAD_URL =
  "https://github.com/denizhidir35-ui/al-mether-legal/releases/download/v1.0.0/AL-METHER-Legal-Setup.exe";

export const dynamic = "force-dynamic";

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

      <section class="hero">
        <div class="copy">
          <div class="eyebrow">
            <span class="windowsMark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            Windows masaüstü uygulaması
          </div>
          <h1>Hukuk iş akışınız,<span> artık masaüstünde.</span></h1>
          <p class="lead">
            AL METHER Legal'in Windows uygulamasını indirin. Dosyalarınıza,
            takviminize ve hukuk çalışma alanınıza doğrudan masaüstünüzden erişin.
          </p>
          <div class="actions">
            ${renderDownloadButton(downloadAvailable)}
            <div class="compatibility"><b aria-hidden="true">✓</b> Windows 10 ve Windows 11 ile uyumlu</div>
          </div>
        </div>

        <aside class="installerCard" aria-label="Kurulum dosyası bilgileri">
          <div class="cardTopline"><span>WINDOWS INSTALLER</span><span>v1.0.0</span></div>
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
        "default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
