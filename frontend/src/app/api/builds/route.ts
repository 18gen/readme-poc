import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { dockerRunner } from "@/lib/docker-runner";
import { putText, putFile } from "@/lib/s3";

const LOG_DIR = "/tmp/readme-mvp/logs";

export async function GET() {
  return NextResponse.json({ ok: true, message: "POST /api/builds" });
}

export async function POST(req: Request) {
  const body = await req.json();
  const owner: string = body.owner;
  const repo: string = body.repo;
  const branch: string = body.branch ?? "main";
  const env: Record<string,string> = body.env ?? {};
  const deploymentId: string = body.deploymentId ?? randomUUID();

  // まず "building" をS3に即書き & ローカルログを準備
  const bucket = process.env.AWS_S3_BUILD_BUCKET!;
  const metaKey = `meta/${deploymentId}.json`;
  const logPath = path.join(LOG_DIR, `${deploymentId}.log`);
  await fs.mkdir(LOG_DIR, { recursive: true });
  await fs.writeFile(logPath, `==> Build started: ${new Date().toISOString()}\n`, "utf8");
  await putText(bucket, metaKey, JSON.stringify({ deploymentId, status:"building", startedAt: new Date().toISOString() }, null, 2), "application/json");

  const onLog = async (line: string) => { await fs.appendFile(logPath, line); };

  try {
    const result = await dockerRunner.buildAndRun({ deploymentId, owner, repo, branch, env, onLog });
    // 完了ログ
    await fs.appendFile(logPath, `\n==> Container running at hostPort ${result.hostPort}\n`);

    // S3へログ＆メタをアップデート
    const buf = await fs.readFile(logPath);
    await putFile(bucket, `logs/${deploymentId}.log`, buf, "text/plain");
    await putText(bucket, metaKey, JSON.stringify({ deploymentId, status:"running", ...result, startedAt: new Date().toISOString() }, null, 2), "application/json");

    // UIへ即返却 → これで“Building…”を閉じてPreviewへ遷移できる
    return NextResponse.json({ ok: true, deploymentId, ...result }, { status: 201 });
  } catch (e:any) {
    const buf = await fs.readFile(logPath);
    await putFile(bucket, `logs/${deploymentId}.log`, buf, "text/plain");
    await putText(bucket, metaKey, JSON.stringify({ deploymentId, status:"error", error: e?.message ?? String(e) }, null, 2), "application/json");
    return NextResponse.json({ ok:false, error: e?.message ?? "internal error" }, { status: 500 });
  }
}
