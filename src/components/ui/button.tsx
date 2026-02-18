import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-[linear-gradient(120deg,var(--brand-pink)_0%,var(--brand-cyan)_100%)] text-white hover:brightness-105",
        destructive:
          "border border-transparent bg-[linear-gradient(120deg,#ff4b7a_0%,#ff2e63_100%)] text-white hover:brightness-105",
        secondary: "border border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)] hover:bg-[var(--surface-strong)]",
        ghost: "border border-transparent bg-transparent text-[var(--text)] hover:bg-[var(--surface-soft)]",
        outline: "border border-[var(--border)] bg-transparent text-[var(--text)] hover:bg-[var(--surface-soft)]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
