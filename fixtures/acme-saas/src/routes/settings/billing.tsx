import React from "react";

export function BillingSettings() {
  return (
    <section className="grid gap-[18px] text-[var(--color-text)]">
      <header className="space-y-[12px]">
        <p className="text-sm font-medium text-[var(--color-muted)]">Billing</p>
        <h1 className="text-lg font-semibold">Workspace plan</h1>
      </header>

      <div className="min-w-[840px] rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-[29px] shadow-2xl">
        <div className="flex items-start justify-between gap-[18px]">
          <div className="space-y-[8px]">
            <p className="text-[15.5px] font-medium">Scale plan</p>
            <p className="max-w-xl text-sm text-[var(--color-muted)]">
              The agent-generated billing card works, but it quietly drifts away from the Acme design grammar.
            </p>
          </div>

          <button
            className="rounded-[28px] bg-[#7c3aed] px-[21px] py-[11px] text-sm font-semibold text-[#faf5ff] focus:outline-none"
          >
            Update plan
          </button>
        </div>
      </div>
    </section>
  );
}
