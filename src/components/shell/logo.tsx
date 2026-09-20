import { cn } from "@/lib/utils";

/**
 * The mark: a single ECG beat on an indigo tile. It reads as clinical at a glance and
 * survives 16px, which a two-letter monogram does not.
 *
 * Solid fill rather than a gradient on purpose — this renders once per message in a
 * thread, and a repeated `<linearGradient id>` breaks the moment one instance unmounts.
 * The standalone icon.svg and the share image keep the gradient; there is only ever one
 * of each. The indigo is fixed in both themes, the way a logo should be.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="7.5" fill="#4F5DF2" />
      <path
        d="M4.5 18H11l2.2-8.4L16.8 22.4 19.4 18H27.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark plus wordmark, for the sidebar and anywhere the product names itself. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <LogoMark />
      <span className="truncate text-[14.5px] tracking-[-0.01em]">
        <span className="font-semibold">ClinicSoft</span>{" "}
        <span className="font-normal text-muted-foreground">Agent</span>
      </span>
    </span>
  );
}
