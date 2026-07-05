// Shallow-clone support for reviewing agent branches straight from GitHub.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";

export function githubCloneUrl(repo, { token = null } = {}) {
  const raw = String(repo ?? "").trim();
  if (!raw) throw new Error("A GitHub repository is required.");
  if (/^https?:\/\//i.test(raw) || /^git@/i.test(raw) || /^file:\/\//i.test(raw)) return raw;
  if (!/^[\w.-]+\/[\w.-]+$/.test(raw)) {
    throw new Error(`"${raw}" is not a valid GitHub repository. Use owner/repo or a full URL.`);
  }
  if (token) {
    return `https://x-access-token:${encodeURIComponent(token)}@github.com/${raw}.git`;
  }
  return `https://github.com/${raw}.git`;
}

export async function cloneRepo(repo, destination, { branch = null, timeoutMs = 60_000, token = null } = {}) {
  const url = githubCloneUrl(repo, { token });
  if (existsSync(destination)) {
    await rm(destination, { recursive: true, force: true });
  }

  const args = ["clone", "--depth", "1", "--single-branch"];
  if (branch) args.push("--branch", branch);
  args.push(url, destination);

  await runGit(args, timeoutMs);
  return { url, destination, branch };
}

function runGit(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`git ${args[0]} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to run git: ${error.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`git ${args[0]} failed (exit ${code}): ${stderr.trim().split("\n").pop() ?? "unknown error"}`));
    });
  });
}
