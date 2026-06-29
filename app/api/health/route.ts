import { NextResponse } from "next/server";
import { HealthCheckEngine } from "@/lib/core/health";

export async function GET() {
  const result = await HealthCheckEngine.run();

  return NextResponse.json(result, {
    status: result.ok ? 200 : 500,
  });
}
