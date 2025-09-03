"use client";

import * as React from "react";
import { Code2, User, BookOpen, Pickaxe } from "lucide-react";
import { NavMain } from "@/components/ui/nav-main";
import { NavUser } from "@/components/ui/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const data = {
  navMain: [
    { title: "プロファイル", url: "/navi", icon: User, items: [] },
    { title: "ビルド / デプロイ", url: "/build", icon: Pickaxe, items: [] },
    {
      title: "ドキュメント",
      url: "/#",
      icon: BookOpen,
      items: [
        { title: "ようこそ！", url: "/#" },
        { title: "はじめに", url: "/#" },
        { title: "イベント参加方法", url: "/#" },
        { title: "イベント開催方法", url: "/#" },
      ],
    },
  ],
};

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { state, toggleSidebar } = useSidebar();

  const handleSidebarClick = React.useCallback((e: React.MouseEvent) => {
    // Only toggle if clicking on the background, not on interactive elements
    if (e.target === e.currentTarget) {
      toggleSidebar();
    }
  }, [toggleSidebar]);

  return (
    <Sidebar 
      collapsible="icon" 
      className="group/sidebar relative" 
      onClick={state === "collapsed" ? handleSidebarClick : undefined}
      {...props}
    >
      <SidebarHeader className="relative z-10">
        <SidebarMenu>
          <SidebarMenuItem className="flex w-full items-center justify-between">
            {state === "collapsed" ? (
              // COLLAPSED: Show Code2, transform to SidebarTrigger icon on hover
              <div className="relative h-8 w-8 ">
                {/* Code2 icon - fades out on hover */}
                <Code2 
                  className={[
                    "absolute inset-0 m-auto h-5 w-5 pointer-events-none",
                    "transition-all duration-200 ease-out",
                    "group-hover/sidebar:opacity-0 group-hover/sidebar:scale-75 group-hover/sidebar:rotate-90",
                    "opacity-100 scale-100 rotate-0"
                  ].join(" ")}
                />
                {/* SidebarTrigger icon - fades in on hover and is clickable */}
                <SidebarTrigger 
                  aria-label="Open sidebar"
                  className={[
                    "absolute inset-0 h-8 w-8 z-20",
                    "transition-all duration-200 ease-out",
                    "group-hover/sidebar:opacity-100 group-hover/sidebar:scale-100 group-hover/sidebar:rotate-0",
                    "opacity-0 scale-75 -rotate-90"
                  ].join(" ")}
                />
              </div>
            ) : (
              // EXPANDED: Show both Code2 (as home link) and SidebarTrigger (close button) on same row
              <>
                {/* Left: Code2 as home link - same size as collapsed state */}
                <div className="h-8 w-8 flex items-center justify-center">
                  <SidebarMenuButton
                    asChild
                    className="h-8 w-8 p-0 flex items-center justify-center hover:bg-accent/50 transition-colors"
                  >
                    <Code2 className="p-1.5 h-4 w-4" />
                  </SidebarMenuButton>
                </div>

                {/* Right: Close trigger */}
                <SidebarTrigger
                  aria-label="Close sidebar"
                  className="ml-auto h-7 w-7 hover:bg-accent/50 transition-colors"
                />
              </>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="relative z-10">
        <NavMain items={data.navMain} />
      </SidebarContent>

      <SidebarFooter className="relative z-10">
        <NavUser />
      </SidebarFooter>

      {/* Rail with visual feedback on hover - clickable when collapsed */}
      <SidebarRail />
    </Sidebar>
  );
}