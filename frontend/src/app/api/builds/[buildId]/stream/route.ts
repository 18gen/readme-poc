import "server-only";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { buildId: string } }) {
  const buildId = params.buildId;
  if (!buildId) return NextResponse.json({ error: "buildId required" }, { status: 400 });

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  });

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(enc.encode(`event: ${event}\n`));
        controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let closed = false;
      (async () => {
        // Initial snapshot
        let prevLogs = "";
        try {
          const b = await prisma.build.findUnique({ where: { id: buildId }, include: { deployment: true } });
          if (b) {
            prevLogs = b.logs || "";
            send("status", { status: b.status, logs: prevLogs, deployment: b.deployment });
          } else {
            send("status", { status: "UNKNOWN", logs: "" });
          }
        } catch (e) {
          send("error", { message: (e as any)?.message || "prisma error" });
        }

        while (!closed) {
          await new Promise(r => setTimeout(r, 600));
          try {
            const b = await prisma.build.findUnique({ where: { id: buildId }, include: { deployment: true } });
            if (!b) continue;
            const curLogs = b.logs || "";
            if (curLogs.length !== prevLogs.length) {
              send("logs", { append: curLogs.slice(prevLogs.length) });
              prevLogs = curLogs;
            }
            send("status", { status: b.status, deployment: b.deployment });
            if (b.status === "SUCCEEDED" || b.status === "FAILED") break;
          } catch (e) {
            send("error", { message: (e as any)?.message || "poll error" });
          }
        }
        controller.close();
      })();
    },
    cancel() {}
  });

  return new Response(stream, { headers });
}