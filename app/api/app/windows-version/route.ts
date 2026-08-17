const WINDOWS_VERSION_MANIFEST = {
  version: "1.0.4",
  downloadUrl:
    "https://github.com/denizhidir35-ui/al-mether-legal/releases/download/v1.0.4/AL-METHER-Legal-Setup.exe",
  sha256: "8A1C12E501036B970BC5E7B58FB6EFF5A6896D87BCBF714B438336059BE956B9",
  mandatory: true,
} as const;

export async function GET() {
  return Response.json(WINDOWS_VERSION_MANIFEST, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=60",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
