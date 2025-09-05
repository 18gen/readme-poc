import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import { promises as fs } from "fs";
import { dockerRunner } from "@/lib/docker-runner";
import { putText, putFile } from "@/lib/s3";
import { prisma } from "@/lib/prisma";

const LOG_DIR = "/tmp/readme-mvp/logs";

export async function POST(req: Request) {
  const body = await req.json();
  const owner: string = body.owner;
  const repo: string = body.repo;
  const branch: string = body.branch ?? "main";
  const env: Record<string, string> = body.env ?? {};
  if (!owner || !repo) {
    return NextResponse.json({ ok: false, error: "owner/repo required" }, { status: 400 });
  }

  // Ensure Project
  const project = await ensureProject(owner, repo, branch);

  // Create Build + Deployment shells
  const build = await prisma.build.create({
    data: { projectId: project.id, branch, status: "RUNNING", logs: "" }
  });

  const deploymentId = randomUUID();
  await prisma.deployment.create({
    data: { id: deploymentId, projectId: project.id, buildId: build.id, status: "PENDING" }
  });

  // Prepare logging
  const bucket = process.env.AWS_S3_BUILD_BUCKET!;
  const metaKey = `meta/${deploymentId}.json`;
  const logPath = path.join(LOG_DIR, `${deploymentId}.log`);
  await fs.mkdir(LOG_DIR, { recursive: true });
  await fs.writeFile(logPath, `==> Build started: ${new Date().toISOString()}\n`, "utf8");
  await putText(bucket, metaKey, JSON.stringify({ deploymentId, status: "building", buildId: build.id, projectId: project.id }, null, 2), "application/json");

  let buffer = "";
  let flushing = false;
  async function flush() {
    if (flushing || !buffer) return;
    flushing = true;
    const chunk = buffer; buffer = "";
    try {
      // Fallback-safe append
      const cur = await prisma.build.findUnique({ where: { id: build.id }, select: { logs: true } });
      await prisma.build.update({ where: { id: build.id }, data: { logs: (cur?.logs || "") + chunk } });
    } finally { flushing = false; }
  }
  const interval = setInterval(flush, 400);
  const onLog = async (line: string) => { await fs.appendFile(logPath, line); buffer += line; };

  try {
    const result = await dockerRunner.buildAndRun({ deploymentId, owner, repo, branch, env, onLog });
    clearInterval(interval);
    await flush();

    await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "RUNNING", hostPort: result.hostPort } });
    await prisma.build.update({ where: { id: build.id }, data: { status: "SUCCEEDED" } });

    const buf = await fs.readFile(logPath);
    await putFile(bucket, `logs/${deploymentId}.log`, buf, "text/plain");
    await putText(bucket, metaKey, JSON.stringify({ deploymentId, status: "running", hostPort: result.hostPort, buildId: build.id, projectId: project.id }, null, 2), "application/json");

    return NextResponse.json({ ok: true, buildId: build.id, deploymentId, hostPort: result.hostPort }, { status: 201 });
  } catch (e: any) {
    clearInterval(interval);
    await flush();
    const buf = await fs.readFile(logPath);
    await putFile(bucket, `logs/${deploymentId}.log`, buf, "text/plain");
    await putText(bucket, metaKey, JSON.stringify({ deploymentId, status: "error", error: e?.message ?? String(e), buildId: build.id }, null, 2), "application/json");
    await prisma.deployment.update({ where: { id: deploymentId }, data: { status: "FAILED" } }).catch(()=>{});
    await prisma.build.update({ where: { id: build.id }, data: { status: "FAILED" } }).catch(()=>{});
    return NextResponse.json({ ok: false, error: e?.message ?? "internal error" }, { status: 500 });
  }
}

async function ensureProject(owner: string, repo: string, defaultBranch: string) {
  const prev = await prisma.project.findFirst({ where: { owner, repo } });
  if (prev) return prev;
  return prisma.project.create({ data: { owner, repo, defaultBranch } });
}