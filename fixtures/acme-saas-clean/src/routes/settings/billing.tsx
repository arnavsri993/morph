import React from "react";
import { Button } from "../../components/Button";

export function BillingSettings() {
  return (
    <section className="grid gap-[var(--space-4)] text-[var(--color-text)]">
      <header className="space-y-[12px]">
        <p className="text-sm font-medium text-[var(--color-muted)]">Billing</p>
        <h1 className="text-lg font-semibold">Workspace plan</h1>
      </header>

      <div className="min-w-0 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-[var(--space-4)]">
          <div className="space-y-[8px]">
            <p className="text-sm font-medium">Scale plan</p>
            <p className="max-w-xl text-sm text-[var(--color-muted)]">
              The billing card follows the Acme design grammar with tokenized spacing, color, radius, and component usage.
            </p>
          </div>

          <button aria-label="Dismiss billing notice">
            <svg viewBox="0 0 20 20"><path d="M4 4l12 12M16 4L4 16" /></svg>
          </button>

          <Button variant="primary">Update plan</Button>
        </div>
      </div>
    </section>
  );
}
