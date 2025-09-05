import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getJSON } from "@/lib/s3";

async function resolveHostPort(id: string) {
  // ① DB を一次ソースに
  try {
    const dep = await prisma.deployment.findUnique({
      where: { id },
      select: { hostPort: true, status: true },
    });
    if (dep?.hostPort) return { hostPort: dep.hostPort, source: "db", status: dep.status };
  } catch {}

  // ② S3 をフォールバックに
  try {
    const meta = await getJSON<any>(process.env.AWS_S3_BUILD_BUCKET!, `meta/${id}.json`);
    if (meta?.hostPort) return { hostPort: meta.hostPort, source: "s3", status: meta.status };
  } catch {}

  return null;
}

async function handle(request: Request, id: string) {
  const resolved = await resolveHostPort(id);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "deployment not running (no hostPort in DB/S3)" }, { status: 503 });
  }

  const upstream = new URL(`http://127.0.0.1:${resolved.hostPort}/`);
  const init: RequestInit = { method: request.method, redirect: "manual" as any };

  const hopByHop = new Set([
    "connection","keep-alive","proxy-authenticate","proxy-authorization",
    "te","trailers","transfer-encoding","upgrade","host","accept-encoding"
  ]);
  const headers = new Headers();
  request.headers.forEach((v,k)=>{ if(!hopByHop.has(k.toLowerCase())) headers.set(k,v); });
  init.headers = headers;

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  const res = await fetch(upstream, init);
  const out = new Headers(res.headers);
  out.delete("x-frame-options");
  out.delete("content-security-policy");
  const loc = out.get("location");
  if (loc) {
    try {
      const u = new URL(loc, upstream);
      out.set("location", `/api/proxy/${id}${u.pathname}${u.search}`);
    } catch {}
  }
  return new NextResponse(res.body, { status: res.status, headers: out });
}

export async function GET(req: Request, ctx: { params:{ deploymentId: string } }) { return handle(req, ctx.params.deploymentId); }
export async function POST(req: Request, ctx: { params:{ deploymentId: string } }) { return handle(req, ctx.params.deploymentId); }
export async function PUT(req: Request, ctx: { params:{ deploymentId: string } }) { return handle(req, ctx.params.deploymentId); }
export async function PATCH(req: Request, ctx: { params:{ deploymentId: string } }) { return handle(req, ctx.params.deploymentId); }
export async function DELETE(req: Request, ctx: { params:{ deploymentId: string } }) { return handle(req, ctx.params.deploymentId); }
