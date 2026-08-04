import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.GEMINI_API_KEY || "";

  return NextResponse.json({
    ok: Boolean(key),
    exists: Boolean(key),
    length: key.length,
    startsWith: key ? key.slice(0, 6) : "",
    endsWith: key ? key.slice(-4) : "",
  });
}
