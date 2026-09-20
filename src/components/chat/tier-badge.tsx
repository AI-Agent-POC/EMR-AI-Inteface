import { Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/types";

const META: Record<Tier, { label: string; cls: string; Icon: typeof Eye; hint: string }> = {
  open:       { label: "Open",       cls: "bg-tier-open/12 text-tier-open border-tier-open/30",             Icon: Eye,    hint: "Aggregate data, no PHI" },
  restricted: { label: "Restricted", cls: "bg-tier-restricted/12 text-tier-restricted border-tier-restricted/35", Icon: Lock, hint: "Patient-identifying; one patient at a time, logged" },
  never:      { label: "Never",      cls: "bg-tier-never/12 text-tier-never border-tier-never/35",          Icon: EyeOff, hint: "Never reaches the assistant, for any role" },
};

export function TierBadge({ tier, compact = false, className }: { tier: Tier; compact?: boolean; className?: string }) {
  const m = META[tier];
  return (
    <span title={m.hint}
      className={cn("inline-flex items-center gap-1 rounded-full border px-1.5 text-[10.5px] font-medium leading-5 tracking-wide", m.cls, className)}>
      <m.Icon className="size-3" />
      {!compact && m.label}
    </span>
  );
}
