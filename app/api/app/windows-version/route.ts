const WINDOWS_VERSION_MANIFEST = {
  version: "1.0.6",
  downloadUrl:
    "https://github.com/denizhidir35-ui/al-mether-legal/releases/download/v1.0.6/AL-METHER-Legal-Setup.exe",
  sha256: "725B84FD4261676CE2DA2A78FB87F56561787D046CBD670ED8D0A83B8192D594",
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
