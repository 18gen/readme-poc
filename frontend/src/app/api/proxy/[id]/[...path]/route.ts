import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getJSON } from "@/lib/s3";

const cache = new Map<string, { meta:any; ts:number }>();
const TTL = 30_000;

async function readMeta(id: string) {
  const now = Date.now(); const hit = cache.get(id);
  if (hit && now - hit.ts < TTL) return hit.meta;
  const meta = await getJSON<any>(process.env.AWS_S3_BUILD_BUCKET!, `meta/${id}.json`);
  if (meta) cache.set(id, { meta, ts: now });
  return meta;
}

async function proxy(request: Request, id: string, pathSegs: string[]) {
  const meta = await readMeta(id);
  if (!meta?.hostPort) return NextResponse.json({ ok:false, error:"not running" }, { status:503 });

  const upstream = new URL(`http://127.0.0.1:${meta.hostPort}/${(pathSegs||[]).join("/")}`);
  const method = request.method;
  const init: RequestInit = { method, redirect: "manual" as any };

  const hopByHop = new Set(["connection","keep-alive","proxy-authenticate","proxy-authorization","te","trailers","transfer-encoding","upgrade","host","accept-encoding"]);
  const hh = new Headers();
  request.headers.forEach((v,k)=>{ if(!hopByHop.has(k.toLowerCase())) hh.set(k,v); });
  init.headers = hh;

  if (method !== "GET" && method !== "HEAD") init.body = await request.arrayBuffer();

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

export async function GET(req: Request, ctx: { params:{ id:string; path?:string[] } }) { return proxy(req, ctx.params.id, ctx.params.path||[]); }
export async function POST(req: Request, ctx: { params:{ id:string; path?:string[] } }) { return proxy(req, ctx.params.id, ctx.params.path||[]); }
export async function PUT(req: Request, ctx: { params:{ id:string; path?:string[] } }) { return proxy(req, ctx.params.id, ctx.params.path||[]); }
export async function PATCH(req: Request, ctx: { params:{ id:string; path?:string[] } }) { return proxy(req, ctx.params.id, ctx.params.path||[]); }
export async function DELETE(req: Request, ctx: { params:{ id:string; path?:string[] } }) { return proxy(req, ctx.params.id, ctx.params.path||[]); }
