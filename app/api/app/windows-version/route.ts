const WINDOWS_VERSION_MANIFEST = {
  version: "1.0.1",
  downloadUrl:
    "https://github.com/denizhidir35-ui/al-mether-legal/releases/download/v1.0.1/AL-METHER-Legal-Setup.exe",
  sha256: "EF0CB4A879B92D00B5920B07848C3151525872B4E00AD12D199928433119E4E5",
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
