"use client";

import { useEffect, useState } from "react";
import { Play, Square, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BuildLogAccordion from "./build-log-accordion";
import { PreviewFrame } from "@/components/PreviewFrame";
import BranchSelect from "./branch-select";

interface Props {
  projectId: string;
  owner: string;
  repo: string;
  defaultBranch: string;
}

export function BuildPanel({ projectId, owner, repo, defaultBranch }: Props) {
  const [branch, setBranch] = useState(defaultBranch || "main");
  const [env, setEnv] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);
  const [buildId, setBuildId] = useState<string | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const last = localStorage.getItem("lastDeploymentId");
      if (last) setDeploymentId(last);
    } catch {}
  }, []);

  async function startBuild() {
    setLoading(true);
    try {
      const res = await fetch("/api/builds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner, repo, branch, env }),
      });
      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      if (!res.ok) {
        throw new Error(json?.error || text || "Build failed");
      }

      // success path:
      setBuildId(json.buildId);
      setDeploymentId(json.deploymentId);
      try { localStorage.setItem("lastDeploymentId", json.deploymentId); } catch {}
    } catch (e: any) {
      alert(e.message || "build failed");
    } finally {
      setLoading(false);
    }
  }

  async function stop() {
    if (!deploymentId) return;
    await fetch(`/api/deployments/${deploymentId}/stop`, { method: "POST" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BranchSelect owner={owner} repo={repo} value={branch} onValueChange={setBranch} />
        <Button onClick={startBuild} disabled={loading} className="gap-2"><Play className="w-4 h-4" />Build & Run</Button>
        <Button onClick={stop} variant="destructive" disabled={!deploymentId} className="gap-2"><Square className="w-4 h-4" />Stop</Button>
      </div>

      {buildId && <BuildLogAccordion buildId={buildId} />}

      {deploymentId && (
        <div className="mt-4">
          <PreviewFrame deploymentId={deploymentId} />
        </div>
      )}
    </div>
  );
}

export default BuildPanel;