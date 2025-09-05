"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, RefreshCw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = { deploymentId: string };

export function PreviewFrame({ deploymentId }: Props) {
  const [status, setStatus] = useState<"starting"|"running"|"error"|"stopped">("starting");
  const [src, setSrc] = useState<string>("");
  const [key, setKey] = useState(0);
  const [errMsg, setErrMsg] = useState<string>("");

  const proxyRoot = useMemo(() => `/api/proxy/${deploymentId}/`, [deploymentId]);

  async function check() {
    try {
      // metaで状態を確認
      const metaRes = await fetch(`/api/deployments/${deploymentId}/meta`, { cache: "no-store" });
      if (!metaRes.ok) throw new Error("meta not found");
      const { meta } = await metaRes.json();
      if (meta?.status === "stopped") { setStatus("stopped"); return; }
      if (!src) setSrc(proxyRoot);

      // upstream 200 確認
      const head = await fetch(proxyRoot, { method: "GET", cache: "no-store" });
      if (head.ok || head.status === 302 || head.status === 301) {
        setStatus("running");
        return;
      }
      throw new Error(`upstream status ${head.status}`);
    } catch (e: any) {
      setErrMsg(e?.message ?? String(e));
      setStatus((prev) => prev === "starting" ? "starting" : "error");
    }
  }

  // 起動直後はポーリングで立ち上がり待ち
  useEffect(() => {
    let alive = true;
    setStatus("starting"); setErrMsg(""); setSrc("");
    const loop = async () => {
      while (alive && (status === "starting" || status === "error")) {
        await check();
        await new Promise(r => setTimeout(r, 1500));
        if (!alive) break;
        if (status === "running" || status === "stopped") break;
      }
    };
    loop();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId]);

  const hardRefresh = () => { setKey(k => k + 1); };

  const stop = async () => {
    await fetch(`/api/deployments/${deploymentId}/stop`, { method: "POST" });
    setStatus("stopped");
  };

  return (
    <div className="w-full h-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={status === "running" ? "default" : status === "starting" ? "secondary" : "destructive"}>
            {status}
          </Badge>
          {status !== "running" && errMsg && <span className="text-sm text-muted-foreground">{errMsg}</span>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={check}><RefreshCw className="h-4 w-4 mr-1" />Check</Button>
          <Button size="sm" variant="outline" onClick={hardRefresh}><RefreshCw className="h-4 w-4 mr-1" />Reload</Button>
          <a href={src || proxyRoot} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline"><ExternalLink className="h-4 w-4 mr-1" />Open</Button>
          </a>
          <Button size="sm" variant="destructive" onClick={stop}><Square className="h-4 w-4 mr-1" />Stop</Button>
        </div>
      </div>

      <div className="flex-1 min-h-[480px] border rounded-xl overflow-hidden bg-background">
        {status === "running" && (
          <iframe
            key={key}
            src={src || proxyRoot}
            className="w-full h-[70vh] bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
          />
        )}
        {status === "starting" && (
          <div className="p-6 text-sm text-muted-foreground">Starting container… waiting for health.</div>
        )}
        {status === "error" && (
          <div className="p-6 text-sm text-muted-foreground">Waiting for app… retrying. You can open in new tab to inspect logs.</div>
        )}
        {status === "stopped" && (
          <div className="p-6 text-sm text-muted-foreground">Stopped.</div>
        )}
      </div>
    </div>
  );
}
