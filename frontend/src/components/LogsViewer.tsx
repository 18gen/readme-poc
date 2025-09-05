"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function LogsViewer({ deploymentId }: { deploymentId: string }) {
  const [buf, setBuf] = useState("");
  const [from, setFrom] = useState(0);
  const [source, setSource] = useState<"local"|"s3"|"">("");
  const [auto, setAuto] = useState(true);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let alive = true;
    setBuf(""); setFrom(0); setSource(""); setAuto(true);

    async function tick() {
      while (alive) {
        try {
          const res = await fetch(`/api/deployments/${deploymentId}/logs?from=${from}`, { cache: "no-store" });
          if (res.ok) {
            const j = await res.json();
            setBuf(prev => prev + (j.chunk || ""));
            setFrom(j.nextFrom ?? from);
            setSource(j.source || "");
            if (auto && preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 800));
      }
    }
    tick();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-2">
        <div className="text-xs text-muted-foreground">source: {source || "…"}</div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={()=>setAuto(a=>!a)}>{auto ? "AutoScroll: ON" : "AutoScroll: OFF"}</Button>
          <Button size="sm" variant="outline" onClick={()=>{ setBuf(""); setFrom(0); }}><RefreshCw className="w-4 h-4 mr-1" />Clear</Button>
        </div>
      </div>
      <pre ref={preRef} className="flex-1 overflow-auto rounded-md bg-black/90 text-green-200 p-3 text-xs leading-relaxed">
        {buf || "Waiting for logs…"}
      </pre>
    </div>
  );
}
