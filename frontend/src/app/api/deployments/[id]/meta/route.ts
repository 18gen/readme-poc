import "server-only";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getJSON } from "@/lib/s3";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  const bucket = process.env.AWS_S3_BUILD_BUCKET!;
  const [db, s3] = await Promise.all([
    prisma.deployment.findUnique({
      where: { id },
      select: { id: true, status: true, hostPort: true, buildId: true, projectId: true }
    }).catch(()=>null),
    getJSON<any>(bucket, `meta/${id}.json`).catch(()=>null),
  ]);

  if (!db && !s3) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, db, s3 });
}
