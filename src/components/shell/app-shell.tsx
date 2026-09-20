"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { SquarePen, PanelLeft, Sun, Moon, Lightbulb, Database, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonaSwitcher } from "./persona-switcher";
import { ConversationList } from "./conversation-list";
import { ConversationMenu } from "./conversation-menu";
import { Logo } from "./logo";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Kbd } from "@/components/ui/kbd";

const PAGES = [
  { href: "/insights",   label: "Insights",   Icon: Lightbulb,   desc: "24 things worth knowing" },
  { href: "/explore",    label: "Explore",    Icon: Database,    desc: "Every table, explained" },
  { href: "/guardrails", label: "Guardrails", Icon: ShieldCheck, desc: "What it will refuse" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const newConversation = useStore((s) => s.newConversation);
  const title = useStore((s) => s.conversation.title);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { void useStore.persist.rehydrate(); }, []);

  const onAsk = path === "/ask" || path === "/";
  const page = PAGES.find((n) => path.startsWith(n.href));

  const startNew = () => { newConversation(); router.push("/ask"); setMobileOpen(false); };

  // ⌘⇧O: new chat, the ChatGPT chord. Esc stops a running answer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") { e.preventDefault(); startNew(); }
      if (e.key === "Escape" && useStore.getState().busy) useStore.getState().stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sidebar = (
    <>
      <div className="flex h-14 items-center gap-2 px-3">
        <Link href="/ask" onClick={() => setMobileOpen(false)} className="min-w-0">
          <Logo />
        </Link>
        <Button variant="ghost" size="icon-sm" className="ml-auto hidden md:inline-flex text-muted-foreground" onClick={() => setCollapsed(true)} aria-label="Hide sidebar">
          <PanelLeft className="size-4" />
        </Button>
      </div>

      <div className="px-2 pb-1">
        <button onClick={startNew}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium text-foreground hover:bg-sidebar-accent">
          <SquarePen className="size-4" />New chat
          <span className="ml-auto hidden text-[10.5px] text-muted-foreground/70 md:inline"><Kbd>⌘</Kbd><Kbd>⇧</Kbd><Kbd>O</Kbd></span>
        </button>
        {PAGES.map(({ href, label, Icon }) => (
          <Link key={href} href={href} onClick={() => setMobileOpen(false)}
            className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors",
              path.startsWith(href) ? "bg-sidebar-accent text-foreground font-medium" : "text-foreground/75 hover:bg-sidebar-accent/60 hover:text-foreground")}>
            <Icon className="size-4 text-muted-foreground" />{label}
          </Link>
        ))}
      </div>

      <div className="mt-2 px-4 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">Chats</div>
      <ConversationList onNavigate={() => setMobileOpen(false)} />

      <div className="border-t border-border/70 p-2">
        <BackendStatus />
        <ThemeToggle />
      </div>
    </>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside className={cn("hidden md:flex w-[264px] shrink-0 flex-col border-r border-border/60 bg-sidebar transition-[width]", collapsed && "md:hidden")}>
        {sidebar}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[300px] p-0 flex flex-col bg-sidebar">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className={cn("flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4", !onAsk && "border-b border-border/60")}>
          <Button variant="ghost" size="icon" className="text-muted-foreground md:hidden" onClick={() => setMobileOpen(true)} aria-label="Menu"><PanelLeft className="size-[18px]" /></Button>
          {collapsed && (
            <>
              <Button variant="ghost" size="icon-sm" className="hidden md:inline-flex text-muted-foreground" onClick={() => setCollapsed(false)} aria-label="Show sidebar"><PanelLeft className="size-4" /></Button>
              <Button variant="ghost" size="icon-sm" className="hidden md:inline-flex text-muted-foreground" onClick={startNew} aria-label="New chat"><SquarePen className="size-4" /></Button>
            </>
          )}
          <div className="min-w-0 flex items-center gap-1">
            {onAsk ? (
              title ? <><span className="truncate text-[13.5px] font-medium">{title}</span><ConversationMenu /></>
                    : <span className="text-[13.5px] text-muted-foreground">New chat</span>
            ) : page ? (
              <div className="leading-tight">
                <div className="text-[13.5px] font-medium">{page.label}</div>
                <div className="text-[11.5px] text-muted-foreground">{page.desc}</div>
              </div>
            ) : null}
          </div>
          <div className="ml-auto"><PersonaSwitcher /></div>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-8" />;
  const dark = resolvedTheme === "dark";
  return (
    <button onClick={() => setTheme(dark ? "light" : "dark")}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground">
      {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
      <span>{dark ? "Dark" : "Light"} mode</span>
    </button>
  );
}

function BackendStatus() {
  const [state, setState] = useState<"ok" | "down" | "checking">("checking");
  useEffect(() => {
    let alive = true;
    const tick = () => api.health().then((h) => alive && setState(h?.status === "ok" ? "ok" : "down")).catch(() => alive && setState("down"));
    tick(); const id = setInterval(tick, 20000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-[12.5px] text-muted-foreground">
      <span className={cn("size-2 rounded-full", state === "ok" ? "bg-tier-open" : state === "down" ? "bg-tier-never" : "bg-muted-foreground/40")} />
      <span>Agent {state === "ok" ? "online" : state === "down" ? "offline" : "…"}</span>
      <span className="ml-auto font-mono text-[10.5px] text-muted-foreground/70">V4 Flash</span>
    </div>
  );
}
