import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import type { BodyPart } from "@/ar/types";

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-cyan-400/25 bg-slate-950/70 backdrop-blur-md",
        "shadow-[0_0_40px_-12px_rgba(34,211,238,0.55)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  className,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    primary:
      "bg-gradient-to-b from-cyan-300 to-cyan-500 text-slate-950 border-cyan-200/60 shadow-[0_0_28px_-6px_rgba(34,211,238,0.9)] hover:from-cyan-200 hover:to-cyan-400",
    ghost: "bg-slate-900/70 text-cyan-100 border-cyan-400/30 hover:bg-slate-800/80",
    danger: "bg-gradient-to-b from-rose-400 to-rose-600 text-white border-rose-300/50 hover:from-rose-300",
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "font-display select-none rounded-xl border px-4 py-3 text-xs font-bold tracking-[0.18em] uppercase",
        "transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function IconBtn({
  children,
  onClick,
  active,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  title: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl border text-base backdrop-blur-md transition active:scale-95",
        active
          ? "border-cyan-300/70 bg-cyan-400/20 text-cyan-100 shadow-[0_0_18px_-4px_rgba(34,211,238,0.9)]"
          : "border-white/15 bg-slate-950/60 text-slate-300 hover:border-cyan-400/40 hover:text-cyan-200",
      )}
    >
      {children}
    </button>
  );
}

export function OptionRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.28em] text-cyan-300/70 uppercase">{label}</div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.98]",
              value === o.value
                ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-50 shadow-[0_0_20px_-8px_rgba(34,211,238,0.9)]"
                : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-400/30",
            )}
          >
            <div className="font-display text-[11px] font-bold tracking-[0.14em] uppercase">{o.label}</div>
            {o.hint && <div className="mt-0.5 font-mono text-[10px] leading-tight text-slate-400">{o.hint}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

const CHIP_STYLES: Record<BodyPart["state"], string> = {
  ok: "border-cyan-300/60 bg-cyan-400/15 text-cyan-100",
  scanning: "border-amber-300/50 bg-amber-400/10 text-amber-200",
  locked: "border-white/10 bg-slate-900/60 text-slate-500",
};

export function PartChip({ part }: { part: BodyPart }) {
  return (
    <span
      className={cn(
        "font-mono rounded-md border px-2 py-1 text-[10px] tracking-wider whitespace-nowrap backdrop-blur-sm",
        CHIP_STYLES[part.state],
      )}
    >
      {part.state === "ok" ? "◈" : part.state === "scanning" ? "◌" : "·"} {part.label}
    </span>
  );
}
