import "server-only";
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { s3 } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const LOG_DIR = "/tmp/readme-mvp/logs";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const from = Number(url.searchParams.get("from") || "0");
  const id = params.id;
  const localPath = path.join(LOG_DIR, `${id}.log`);

  // ローカルがあればローカルを優先（ビルド中のリアルタイム）
  try {
    const stat = await fs.stat(localPath);
    const size = stat.size;
    const start = Math.min(from, size);
    const buf = await fs.readFile(localPath);
    const chunk = buf.subarray(start);
    return NextResponse.json({ ok:true, chunk: chunk.toString("utf8"), nextFrom: start + chunk.length, eof:false, source:"local" });
  } catch {
    // なければ S3 から range 取得（ビルド後）
    try {
      const bucket = process.env.AWS_S3_BUILD_BUCKET!;
      const key = `logs/${id}.log`;
      const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=${from}-` }));
      // @ts-ignore
      const text = await (typeof out.Body?.text === "function" ? out.Body.text() : streamToString(out.Body));
      const nextFrom = from + Buffer.byteLength(text || "", "utf8");
      return NextResponse.json({ ok:true, chunk: text, nextFrom, eof:true, source:"s3" });
    } catch (e:any) {
      return NextResponse.json({ ok:false, error: e?.message ?? "no log yet" }, { status: 404 });
    }
  }
}

async function streamToString(stream: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}
