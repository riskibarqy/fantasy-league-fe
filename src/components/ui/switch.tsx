import { cn } from "@/lib/utils";

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
};

export const Switch = ({ checked, onCheckedChange, disabled = false, className, ariaLabel }: SwitchProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={checked}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface-strong)] p-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked &&
          "border-transparent bg-[linear-gradient(120deg,var(--brand-cyan)_0%,var(--brand-pink)_100%)]",
        className
      )}
      onClick={() => onCheckedChange(!checked)}
    >
      <span
        className={cn(
          "inline-block h-6 w-6 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6" : "translate-x-0"
        )}
      />
    </button>
  );
};
