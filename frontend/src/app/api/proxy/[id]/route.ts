import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getJSON } from "@/lib/s3";

async function handle(req: Request, id: string) {
  const meta = await getJSON<any>(process.env.AWS_S3_BUILD_BUCKET!, `meta/${id}.json`);
  if (!meta?.hostPort) return NextResponse.json({ ok: false, error: "not running" }, { status: 503 });

  const upstream = new URL(`http://127.0.0.1:${meta.hostPort}/`);
  const init: RequestInit = { method: req.method, redirect: "manual" as any };
  const hopByHop = new Set(["connection","keep-alive","proxy-authenticate","proxy-authorization","te","trailers","transfer-encoding","upgrade","host","accept-encoding"]);
  const hh = new Headers();
  req.headers.forEach((v,k)=>{ if(!hopByHop.has(k.toLowerCase())) hh.set(k,v); });
  init.headers = hh;
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  const res = await fetch(upstream, init);
  const out = new Headers(res.headers);
  out.delete("x-frame-options");
  out.delete("content-security-policy");
  const loc = out.get("location");
  if (loc) {
    try { const u = new URL(loc, upstream); out.set("location", `/api/proxy/${id}${u.pathname}${u.search}`); } catch {}
  }
  return new NextResponse(res.body, { status: res.status, headers: out });
}

export async function GET(req: Request, ctx: { params:{ deploymentId: string } }) { return handle(req, ctx.params.deploymentId); }
export async function POST(req: Request, ctx: { params:{ deploymentId: string } }) { return handle(req, ctx.params.deploymentId); }
export async function PUT(req: Request, ctx: { params:{ deploymentId: string } }) { return handle(req, ctx.params.deploymentId); }
export async function PATCH(req: Request, ctx: { params:{ deploymentId: string } }) { return handle(req, ctx.params.deploymentId); }
export async function DELETE(req: Request, ctx: { params:{ deploymentId: string } }) { return handle(req, ctx.params.deploymentId); }