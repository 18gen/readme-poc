import "server-only";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getJSON } from "@/lib/s3";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const meta = await getJSON<any>(process.env.AWS_S3_BUILD_BUCKET!, `meta/${params.id}.json`);
  if (!meta) return NextResponse.json({ ok:false, error:"not found" }, { status:404 });
  return NextResponse.json({ ok:true, meta });
}
