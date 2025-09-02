"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ThemeKey = "light" | "dark" | "system";

const OPTIONS: { key: ThemeKey; label: string }[] = [
  { key: "system", label: "System" },
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => {
          const selected = theme === opt.key;
          return (
            <DropdownMenuItem
              key={opt.key}
              onClick={() => setTheme(opt.key)}
              className="flex items-center justify-between"
            >
              <span>{opt.label}</span>
              <Check
                className={`h-4 w-4 ${
                  selected ? "opacity-100" : "opacity-0"
                }`}
              />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
