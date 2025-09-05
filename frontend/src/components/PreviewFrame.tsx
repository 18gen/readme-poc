"use client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, RefreshCw, Square } from "lucide-react";

export function PreviewFrame({ deploymentId }: { deploymentId: string }) {
  const [status, setStatus] = useState<"starting"|"running"|"error"|"stopped">("starting");
  const [src, setSrc] = useState<string>("");
  const [key, setKey] = useState(0);
  const proxyRoot = useMemo(()=> `/api/proxy/${deploymentId}/`, [deploymentId]);

  useEffect(() => {
    let alive = true;
    setStatus("starting"); setSrc(""); setKey(0);
    (async () => {
      while (alive && status!=="running" && status!=="stopped") {
        try {
          const res = await fetch(proxyRoot, { method: "GET", cache: "no-store" });
          if (res.ok || res.status===301 || res.status===302) { setSrc(proxyRoot); setStatus("running"); break; }
          if (res.status === 503) {
            // 503 のときは meta を取りに行き、原因を出すと捗ります（任意）
            const meta = await fetch(`/api/deployments/${deploymentId}/meta`, { cache: "no-store" }).then(r=>r.json()).catch(()=>null);
            console.warn("proxy 503", meta);
          }
        } catch (e) {}
        await new Promise(r => setTimeout(r, 1000));
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId]);

  const stop = async () => { await fetch(`/api/deployments/${deploymentId}/stop`, { method:"POST" }); setStatus("stopped"); };

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between">
        <Badge variant={status==="running"?"default":status==="starting"?"secondary":"destructive"}>{status}</Badge>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={()=>setKey(k=>k+1)}><RefreshCw className="w-4 h-4 mr-1" />Reload</Button>
          <a href={src || proxyRoot} target="_blank" rel="noreferrer"><Button size="sm" variant="outline"><ExternalLink className="w-4 h-4 mr-1" />Open</Button></a>
          <Button size="sm" variant="destructive" onClick={stop}><Square className="w-4 h-4 mr-1" />Stop</Button>
        </div>
      </div>
      <div className="border rounded-xl overflow-hidden bg-background min-h-[420px]">
        {status==="running"
          ? <iframe key={key} src={src || proxyRoot} className="w-full h-[65vh] bg-white"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups" />
          : <div className="p-6 text-sm text-muted-foreground">Waiting for app to start…</div>
        }
      </div>
    </div>
  );
}