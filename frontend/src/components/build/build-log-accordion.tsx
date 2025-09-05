"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type Props = { buildId: string };

type Status = "RUNNING" | "SUCCEEDED" | "FAILED" | "PENDING" | "UNKNOWN";

export default function BuildLogAccordion({ buildId }: Props) {
  const [status, setStatus] = useState<Status>("PENDING");
  const [full, setFull] = useState<string>("");
  const [tail, setTail] = useState<string>("");
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    let alive = true;
    const es = new EventSource(`/api/builds/${buildId}/stream`);
    es.addEventListener("status", (e: any) => {
      const data = JSON.parse(e.data);
      setStatus((data.status || "UNKNOWN") as Status);
      if (data.logs && typeof data.logs === "string") {
        setFull(data.logs);
        setTail(data.logs.slice(-4000));
      }
    });
    es.addEventListener("logs", (e: any) => {
      const data = JSON.parse(e.data);
      if (!data?.append) return;
      setFull(prev => prev + data.append);
      setTail(prev => (prev + data.append).slice(-4000));
      if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
    });
    es.addEventListener("error", () => { /* ignore transient */ });
    es.onerror = () => { if (alive) es.close(); };
    return () => { alive = false; es.close(); };
  }, [buildId]);

  const sections = useMemo(() => {
    const mk = (title: string, rx: RegExp) => ({
      title,
      content: (full.match(rx)?.join("") || "").trim() || "(no output yet)"
    });
    return [
      mk("1. Checkout", /(==> Cloning[\s\S]*?)(?==>|\Z)/g),
      mk("2. Docker Build", /(==> Building image[\s\S]*?)(?==>|\Z)/g),
      mk("3. Run Container", /(==> Running container[\s\S]*?)(?==>|\Z)/g),
      mk("4. Artifacts/S3", /(Uploaded artifact[\s\S]*?)(?==>|\Z)/g),
    ];
  }, [full]);

  const BadgeEl = () => (
    <Badge variant={status==="RUNNING" ? "secondary" : status==="SUCCEEDED" ? "default" : status==="FAILED" ? "destructive" : "outline"}>
      {status.toLowerCase()}
    </Badge>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Build status:</span>
          <BadgeEl />
        </div>
        <Button size="sm" variant="outline" onClick={()=>location.reload()}><RefreshCw className="w-4 h-4 mr-1" />Reload</Button>
      </div>

      <Accordion type="multiple" defaultValue={["tail", "build"]} className="rounded-lg border">
        <AccordionItem value="tail">
          <AccordionTrigger className="px-4">Live Tail (last 4KB)</AccordionTrigger>
          <AccordionContent className="px-0">
            <pre ref={preRef} className="max-h-[360px] overflow-auto bg-black text-green-200 p-3 text-xs rounded-b-lg">
              {tail || "(waiting...)"}
            </pre>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="build">
          <AccordionTrigger className="px-4">Build Steps</AccordionTrigger>
          <AccordionContent className="px-0">
            {sections.map((s, i) => (
              <div key={i} className="border-t last:border-b">
                <div className="px-4 py-2 text-sm font-medium">{s.title}</div>
                <pre className="px-4 pb-3 text-xs whitespace-pre-wrap">{s.content}</pre>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="raw">
          <AccordionTrigger className="px-4">Raw Log</AccordionTrigger>
          <AccordionContent className="px-0">
            <pre className="max-h-[480px] overflow-auto bg-zinc-950 text-zinc-200 p-3 text-xs rounded-b-lg">
              {full || "(waiting...)"}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}