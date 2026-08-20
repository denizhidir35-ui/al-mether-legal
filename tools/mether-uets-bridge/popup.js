const LOCAL =
  "http://localhost:3000/uets-import?bridge=1";

const PROD =
  "https://legal.almether.com/uets-import?bridge=1";

const local =
  document.getElementById(
    "local"
  );

const prod =
  document.getElementById(
    "prod"
  );

const status =
  document.getElementById(
    "status"
  );

async function render() {
  const stored =
    await chrome.storage
      .local
      .get(
        "metherTarget"
      );

  const value =
    stored
      ?.metherTarget ||
    LOCAL;

  local.classList.toggle(
    "active",
    value === LOCAL
  );

  prod.classList.toggle(
    "active",
    value === PROD
  );
}

local.addEventListener(
  "click",
  async () => {
    await chrome.storage
      .local
      .set({
        metherTarget:
          LOCAL,
      });

    status.textContent =
      "Localhost seçildi.";

    render();
  }
);

prod.addEventListener(
  "click",
  async () => {
    await chrome.storage
      .local
      .set({
        metherTarget:
          PROD,
      });

    status.textContent =
      "Production seçildi.";

    render();
  }
);

render();
const testBridge =
  document.getElementById(
    "testBridge"
  );

testBridge.addEventListener(
  "click",
  async () => {
    const stored =
      await chrome.storage
        .local
        .get(
          "metherTarget"
        );

    const target =
      stored
        ?.metherTarget ||
      LOCAL;

    const payload = {
      version: 1,

      capturedAt:
        new Date()
          .toISOString(),

      url:
        "https://ptt.etebligat.gov.tr/test",

      title:
        "METHER UETS BRIDGE TEST",

      text: `
METHER UETS BRIDGE TEST BELGESİ

BU GERÇEK TEBLİGAT DEĞİLDİR.
HUKUKİ DEĞERİ YOKTUR.
TAKVİME OTOMATİK KAYDEDİLMEMELİDİR.

Gönderen:
TEST ADALET BİRİMİ

Mahkeme:
İzmir 20. İş Mahkemesi

Dosya No:
2026/152 TEST

Tebligat konusu:
Elektronik tebligat Bridge aktarım testi.

Duruşma tarihi:
20.08.2026

Duruşma saati:
10:30

Bu tarih yalnızca METHER Bridge teknik testi için hazırlanmıştır.
Gerçek hukuki olay değildir.
      `.trim(),

      links: [],
    };

    await chrome.storage
      .local
      .set({
        metherUetsCapture:
          payload,
      });

    await chrome.tabs.create({
      url: target,
    });

    status.textContent =
      "Test aktarımı gönderildi.";
  }
);
