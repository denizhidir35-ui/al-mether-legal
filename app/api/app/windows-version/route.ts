const WINDOWS_VERSION_MANIFEST = {
  version: "1.0.2",
  downloadUrl:
    "https://github.com/denizhidir35-ui/al-mether-legal/releases/download/v1.0.2/AL-METHER-Legal-Setup.exe",
  sha256: "6507CC6BC1AD9C49C4E25C750599647811624CDB7BB49ECBFDD90DDA509C76C3",
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
