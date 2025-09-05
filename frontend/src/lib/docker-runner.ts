// src/lib/docker-runner.ts
import "server-only";
import { spawn, execSync } from "child_process";
import { promises as fs, existsSync, readFileSync } from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import getPort from "get-port";
import { putText, putFile } from "./s3";

const TEMP_DIR = "/tmp/readme-mvp";
const INTERNAL_PORT = 3000;

function sh(cmd: string, cwd?: string, env?: NodeJS.ProcessEnv) {
  return execSync(cmd, { stdio: "pipe", cwd, env: { ...process.env, ...env } }).toString();
}
async function ensureDir(p: string) { await fs.mkdir(p, { recursive: true }); }
function dockerName(prefix: string, id: string) {
  const safe = id.toLowerCase().replace(/[^a-z0-9_.-]/g, "");
  return `${prefix}-${safe}`;
}

// get-port v7+ では makeRange が無いので自前で候補配列を作る
function portRange(min: number, max: number): number[] {
  const arr: number[] = [];
  for (let p = max; p >= min; p--) arr.push(p);
  return arr;
}

async function ensureDockerfile(workdir: string) {
  const df = path.join(workdir, "Dockerfile");
  if (existsSync(df)) return;

  const dockerfile = `
  # ---- build stage ----
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
  COPY . .
  ENV NEXT_TELEMETRY_DISABLED=1
  RUN npx next telemetry disable || true
  RUN npm run build

  # ---- run stage ----
  FROM node:20-alpine
  WORKDIR /app
  ENV NODE_ENV=production
  COPY --from=builder /app/.next/standalone ./
  COPY --from=builder /app/public ./public
  COPY --from=builder /app/.next/static ./.next/static
  EXPOSE 3000
  CMD ["node", "server.js"]
  `.trim();

  await fs.writeFile(df, dockerfile, "utf8");

  // next.config.ts に output: 'standalone' が無ければ追加（あればスキップ）
  const ncfg = path.join(workdir, "next.config.ts");
  if (existsSync(ncfg)) {
    const raw = readFileSync(ncfg, "utf8");
    if (!raw.includes("output: 'standalone'")) {
      await fs.writeFile(
        ncfg,
        raw.replace(
          /const nextConfig\s*:\s*NextConfig\s*=\s*{([\s\S]*?)}/,
          (_m, inner) => `const nextConfig: NextConfig = {\n  output: 'standalone',${inner}\n}`
        ),
        "utf8"
      );
    }
  }
}

export interface DockerRunResult {
  image: string;
  container: string;
  hostPort: number;
}

export class DockerRunner {
  async checkout(owner: string, repo: string, branch: string, onLog: (l: string) => void) {
    await ensureDir(TEMP_DIR);
    const workdir = path.join(TEMP_DIR, `${owner}-${repo}-${branch}`);
    if (existsSync(workdir)) {
      onLog(`==> Using cached repo at ${workdir}`);
      return workdir;
    }
    onLog(`==> Cloning ${owner}/${repo}#${branch}`);
    const git = simpleGit();
    await git.clone(`https://github.com/${owner}/${repo}.git`, workdir);
    await git.cwd(workdir).checkout(branch);
    return workdir;
  }

  async buildAndRun(params: {
    deploymentId: string;
    owner: string; repo: string; branch: string;
    env: Record<string, string>;
    onLog: (l: string) => void;
  }): Promise<DockerRunResult> {
    const { deploymentId, owner, repo, branch, env, onLog } = params;
    const workdir = await this.checkout(owner, repo, branch, onLog);

    await ensureDockerfile(workdir);

    const image = dockerName("readmeimg", deploymentId);
    const container = dockerName("readmectl", deploymentId);

    // ✅ fixed: choose an available port from a range
    const hostPort = await getPort({ port: portRange(42000, 48000) });

    onLog(`==> Building image ${image}`);
    await new Promise<void>((resolve, reject) => {
      const p = spawn("docker", ["build", "-t", image, "."], { cwd: workdir });
      p.stdout.on("data", d => onLog(d.toString()));
      p.stderr.on("data", d => onLog(d.toString()));
      p.on("error", reject);
      p.on("close", code => code === 0 ? resolve() : reject(new Error(`docker build exit ${code}`)));
    });

    // 同名コンテナが残っていたら掃除
    try { sh(`docker rm -f ${container}`); } catch {}

    onLog(`==> Running container ${container} on :${hostPort}`);
    const runArgs = [
      "run","-d",
      "--name", container,
      "-p", `${hostPort}:${INTERNAL_PORT}`,
      "--read-only",
      "--memory", process.env.DOCKER_RUN_MEMORY || "1024m",
      "--cpus", process.env.DOCKER_RUN_CPUS || "0.5",
      "--cap-drop", "ALL",
      "--security-opt","no-new-privileges:true",
    ];

    // 環境変数注入
    Object.entries(env || {}).forEach(([k, v]) => {
      runArgs.push("--env", `${k}=${v}`);
    });
    runArgs.push(image);

    sh(`docker ${runArgs.map(a => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`);

    // ---- アーティファクトを S3 に保存（Dockerfile も含む） ----
    const buildBucket = process.env.AWS_S3_BUILD_BUCKET!;
    try {
      const tarName = `${deploymentId}.tar.gz`;
      const tarPath = path.join(TEMP_DIR, tarName);
      // macOS/Unix 前提：tar でワークコピーを固める（サイズが大きい場合は除外パターンを追加）
      sh(`tar -czf ${tarPath} -C ${workdir} .`);
      const buf = await fs.readFile(tarPath);
      await putFile(buildBucket, `artifacts/${tarName}`, buf, "application/gzip");
      onLog(`==> Uploaded artifact to s3://${buildBucket}/artifacts/${tarName}`);
    } catch (e: any) {
      onLog(`WARN: artifact upload failed: ${e?.message ?? e}`);
    }

    return { image, container, hostPort };
  }

  stop(container: string) {
    try { sh(`docker rm -f ${container}`); } catch {}
  }
}

export const dockerRunner = new DockerRunner();
