const WINDOWS_VERSION_MANIFEST = {
  version: "1.0.3",
  downloadUrl:
    "https://github.com/denizhidir35-ui/al-mether-legal/releases/download/v1.0.3/AL-METHER-Legal-Setup.exe",
  sha256: "6F64C62F94E3141C0667421DF1F31C63DDFB80B11962F8EF777DCDE2F6DB6621",
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
