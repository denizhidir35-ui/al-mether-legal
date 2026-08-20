const WINDOWS_VERSION_MANIFEST = {
  version: "1.0.5",
  downloadUrl:
    "https://github.com/denizhidir35-ui/al-mether-legal/releases/download/v1.0.5/AL-METHER-Legal-Setup.exe",
  sha256: "DB66DE5D2F697156A71B03FBA0437687B3F694AB09D9F23145839972070CC6C7",
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
