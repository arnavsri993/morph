---
title: Output Toggle Panel
date: 2026-07-04
status: approved
---

## Problem

The `<pre id="output">` panel in Morph Studio displays raw JSON. This is useful for developers but hard to read for non-technical users reviewing AI-generated UI reports.

## Goal

Add a toggle above the output panel that switches between:
1. **JSON** — the existing raw `<pre>` display (unchanged)
2. **Readable** — a formatted, collapsible view of the same data

## Scope

All changes are self-contained inside the `dashboardHtml` function in `src/server.js`. No new files, no dependencies.

## Architecture

### Toggle bar

A two-button toggle (`JSON` | `Readable`) sits above the output panel. The active mode is stored in a JS variable `outputMode` (`"json"` or `"readable"`). Clicking a button calls `renderPayload(lastPayload)` which re-renders using the current mode. `lastPayload` is a module-level variable updated on every new payload.

### Readable renderer (`renderReadable(payload)`)

Iterates the top-level keys of the payload and renders a `<details>`/`<summary>` collapsible section for each. Key-specific renderers:

| Key | Rendered as |
|-----|-------------|
| `verdict` | Colored badge (green=pass, red=fail) |
| `score` | Numeric + colored score bar (green ≥95, yellow ≥70, red <70) |
| `summary` | High / Medium / Low count chips with severity colors |
| `gate` | Passed/Blocked badge + threshold value |
| `issues` | Cards: severity chip, file:line, reason, suggestedFix |
| `nextActions` | Bulleted list |
| `ciSummary`, `humanReport` | Plain text block |
| Everything else | Key: value rows |

### State management

- `lastPayload` — holds the most recent payload; updated in `renderPayload`
- `outputMode` — `"json"` or `"readable"`; persists across payloads within the session
- Toggle resets to whatever mode was active when new data arrives (no forced reset)

### Styling

New CSS added inline (same pattern as existing styles). Readable view uses the same CSS variables (`--ok`, `--bad`, `--warn`, `--line`, `--surface`, etc.) already defined in the dashboard. No new colors introduced.

## What is NOT changing

- The JSON view is pixel-identical to the current `<pre>` output
- No server-side changes
- No persistent storage of toggle state
- No extra network requests
