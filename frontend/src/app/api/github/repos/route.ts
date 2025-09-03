import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { githubClient } from "@/lib/github";

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    const accessToken = (token as any)?.accessToken as string | undefined;

    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const octokit = githubClient(accessToken);
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
      direction: "desc",
      visibility: "all",
    });

    const formatted = data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      owner: { login: repo.owner?.login ?? "" },
      private: !!repo.private,
      default_branch: repo.default_branch ?? "main",
      updated_at: repo.updated_at ?? null,
    }));

    return NextResponse.json(formatted);
  } catch (err) {
    console.error("Failed to fetch repositories:", err);
    return NextResponse.json({ error: "Failed to fetch repositories" }, { status: 500 });
  }
}
