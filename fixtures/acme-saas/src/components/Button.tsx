import React from "react";

type ButtonProps = {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
};

export function Button({ children, variant = "primary" }: ButtonProps) {
  const className = variant === "primary"
    ? "inline-flex min-h-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-primary)] px-[var(--space-4)] text-sm font-medium text-[var(--color-primary-foreground)] shadow-[var(--shadow-card)] hover:bg-[var(--color-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
    : "inline-flex min-h-10 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] text-sm font-medium text-[var(--color-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]";

  return <button className={className}>{children}</button>;
}
