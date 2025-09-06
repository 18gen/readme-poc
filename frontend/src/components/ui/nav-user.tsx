// src/components/ui/nav-user.tsx
"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { User2, LogIn, LogOut, Github } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuGroup, DropdownMenuSub, DropdownMenuSubTrigger,
  DropdownMenuPortal, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useTheme } from "next-themes";
import { useEffect } from "react";

export function NavUser() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const loading = status === "loading";

  // If NOT signed in: clicking the button goes straight to GitHub sign-in.
  if (!session && !loading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            className="h-8"
            onClick={() =>
              signIn("github", {
                callbackUrl: "/build",
                // Force GitHub to re-show the consent screen and upgrade scopes
                prompt: "consent",
              })
            }
            aria-label="Sign in with GitHub"
          >
            <Github className="mr-2 h-4 w-4" />
            Sign in with GitHub
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const username = session?.user?.name ?? "User";
  const email = session?.user?.email ?? "";
  const userImage = session?.user?.image ?? "";

  console.log("Session:", session);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-8">
              {loading ? "Loading..." : (
                <>
                  <Avatar>
                    <AvatarImage src={userImage} />
                    <AvatarFallback>CN</AvatarFallback>
                  </Avatar>
                  {username}
                </>
                )
                }
              
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" className="w-48">
            <DropdownMenuLabel>
              {username}
              {email ? <div className="text-xs text-muted-foreground">{email}</div> : null}
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                Profile
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuRadioGroup
                      value={(theme as "system" | "light" | "dark") ?? "system"}
                      onValueChange={(v) => setTheme(v as any)}
                    >
                      {["system", "dark", "light"].map((opt) => (
                        <DropdownMenuRadioItem key={opt} value={opt}>
                          <span className="capitalize">{opt}</span>
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                signOut({ callbackUrl: "/" });
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
