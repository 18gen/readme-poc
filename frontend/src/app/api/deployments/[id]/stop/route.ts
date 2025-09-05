import "server-only";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { dockerRunner } from "@/lib/docker-runner";
import { putText } from "@/lib/s3";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const bucket = process.env.AWS_S3_BUILD_BUCKET!;
  const container = `readmectl-${id.toLowerCase().replace(/[^a-z0-9_.-]/g, "")}`;

  try {
    dockerRunner.stop(container);
    await putText(bucket, `meta/${id}.json`, JSON.stringify({ deploymentId: id, status: "stopped" }), "application/json");
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "stop failed" }, { status: 500 });
  }
}
