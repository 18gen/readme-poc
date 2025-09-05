import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

const GH = "https://api.github.com";

async function fetchJSON(url: string, token?: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "readme-mvp",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: "application/vnd.github+json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${text || url}`);
  }
  return res.json();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get("owner") || "";
  const repo  = url.searchParams.get("repo")  || "";
  if (!owner || !repo) {
    return NextResponse.json({ ok:false, error:"owner/repo required" }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN; // optional but recommended
  // 1) default branch
  const repoInfo = await fetchJSON(`${GH}/repos/${owner}/${repo}`, token);
  const defaultBranch = repoInfo?.default_branch || "main";

  // 2) branches (handle pagination up to ~300 for MVP)
  const branches: Array<{ name:string; commit:{ sha:string } }> = [];
  let page = 1;
  while (page <= 3) {
    const list = await fetchJSON(
      `${GH}/repos/${owner}/${repo}/branches?per_page=100&page=${page}`,
      token
    );
    if (!Array.isArray(list) || list.length === 0) break;
    list.forEach((b: any) => branches.push({ name: b.name, commit: { sha: b?.commit?.sha } }));
    if (list.length < 100) break;
    page++;
  }

  // ensure default first, unique by name
  const seen = new Set<string>();
  const ordered = [
    ...branches.filter(b => b.name === defaultBranch),
    ...branches.filter(b => b.name !== defaultBranch),
  ].filter(b => (seen.has(b.name) ? false : (seen.add(b.name), true)));

  return NextResponse.json(
    { ok: true, defaultBranch, branches: ordered },
    { headers: { "Cache-Control": "no-store" } }
  );
}
