const LOCAL =
  "http://localhost:3000/celse-import?bridge=1";

const PROD =
  "https://legal.almether.com/celse-import?bridge=1";

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
        "metherCelseTarget"
      );

  const value =
    stored
      ?.metherCelseTarget ||
    LOCAL;

  status.textContent =
    value === PROD
      ? "Hedef: Production"
      : "Hedef: Localhost";
}

local.addEventListener(
  "click",
  async () => {
    await chrome.storage
      .local
      .set({
        metherCelseTarget:
          LOCAL
      });

    await render();
  }
);

prod.addEventListener(
  "click",
  async () => {
    await chrome.storage
      .local
      .set({
        metherCelseTarget:
          PROD
      });

    await render();
  }
);

void render();