import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { githubClient } from "@/lib/github";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json({ error: "Missing owner/repo" }, { status: 400 });
    }

    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const accessToken = (token as any)?.accessToken as string | undefined;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const octokit = githubClient(accessToken);
    const { data } = await octokit.rest.repos.listBranches({ owner, repo, per_page: 100 });

    const formatted = data.map((b) => ({ name: b.name, commit: { sha: b.commit?.sha ?? "" } }));
    return NextResponse.json(formatted);
  } catch (err) {
    console.error("Failed to fetch branches:", err);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}
