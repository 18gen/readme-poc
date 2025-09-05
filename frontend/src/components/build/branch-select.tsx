"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Branch = { name: string; commit?: { sha?: string } };

export default function BranchSelect({
  owner, repo, value, onValueChange,
}: { owner: string; repo: string; value?: string; onValueChange: (v: string) => void }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(`/api/github/branches?owner=${owner}&repo=${repo}`, { cache: "no-store" });
        const text = await res.text();
        const json = (() => { try { return JSON.parse(text); } catch { return null; } })();
        if (!res.ok || !json?.ok) throw new Error(json?.error || text || "Failed to load branches");

        const list: Branch[] = json.branches || [];
        setBranches(list);

        // set default if no external value
        if (!value && list.length) onValueChange(list[0].name);
      } catch (e: any) {
        setErr(e?.message || "failed to load branches");
        setBranches([{ name: "main" }, { name: "master" }]); // fallback
        if (!value) onValueChange("main");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo]);

  return (
    <div className="min-w-48">
      <Select disabled={loading} value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder={loading ? "Loading…" : (err ? "Fallback branches" : "Branch")} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {branches.map(b => (
            <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
