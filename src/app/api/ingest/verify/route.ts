import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ingestPassword = process.env.INGEST_PASSWORD;

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid or missing ingest password" },
      { status: 401 }
    );
  }

  const provided = typeof body?.password === "string" ? body.password : "";
  if (provided !== ingestPassword) {
    return NextResponse.json(
      { error: "Invalid or missing ingest password" },
      { status: 401 }
    );
  }

  return NextResponse.json({authenticated: true});
}
