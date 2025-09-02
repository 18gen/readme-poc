"use client";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import PageLayout from "@/components/layout/pageLayout";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
        <ThemeProvider attribute="class" defaultTheme="system">
          <PageLayout>{children}</PageLayout>
          <Toaster richColors closeButton />
        </ThemeProvider>
    </SessionProvider>
    );
}
