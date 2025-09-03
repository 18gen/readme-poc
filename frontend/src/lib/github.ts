import { Octokit } from "octokit";

export function githubClient(accessToken: string) {
  return new Octokit({ auth: accessToken });
}

export interface GitHubRepo {
  id: number;
  name: string;
  owner: {
    login: string;
  };
  private: boolean;
  default_branch: string;
  updated_at: string | null;
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}
