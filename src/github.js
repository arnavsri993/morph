// Checkout support for reviewing agent branches straight from GitHub.
//
// GitHub-hosted repos are downloaded through the tarball API over plain HTTPS so
// this works in serverless runtimes (e.g. Vercel) where no `git` binary exists.
// Other remotes (file://, ssh, non-GitHub hosts) fall back to shelling out to git.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

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

export function parseGithubRepo(repo) {
  const raw = String(repo ?? "").trim();
  if (/^[\w.-]+\/[\w.-]+$/.test(raw)) {
    const [owner, name] = raw.split("/");
    return { owner, name: name.replace(/\.git$/i, "") };
  }
  const https = raw.match(/^https?:\/\/(?:[^@/]+@)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i);
  if (https) return { owner: https[1], name: https[2] };
  const ssh = raw.match(/^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/i);
  if (ssh) return { owner: ssh[1], name: ssh[2] };
  return null;
}

export async function cloneRepo(repo, destination, { branch = null, timeoutMs = 60_000, token = null } = {}) {
  const raw = String(repo ?? "").trim();
  if (!raw) throw new Error("A GitHub repository is required.");
  if (existsSync(destination)) {
    await rm(destination, { recursive: true, force: true });
  }

  const parsed = parseGithubRepo(raw);
  if (parsed) {
    await downloadGithubTarball(parsed, destination, { branch, token, timeoutMs });
    return { url: `https://github.com/${parsed.owner}/${parsed.name}.git`, destination, branch };
  }

  const url = githubCloneUrl(raw, { token });
  const args = ["clone", "--depth", "1", "--single-branch"];
  if (branch) args.push("--branch", branch);
  args.push(url, destination);

  await runGit(args, timeoutMs);
  return { url, destination, branch };
}

async function downloadGithubTarball({ owner, name }, destination, { branch = null, token = null, timeoutMs = 60_000 } = {}) {
  const ref = branch ? `/${encodeURIComponent(branch)}` : "";
  const url = `https://api.github.com/repos/${owner}/${name}/tarball${ref}`;
  const headers = {
    "user-agent": "morph-studio",
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28"
  };
  if (token) headers.authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    if (error?.name === "TimeoutError") {
      throw new Error(`GitHub download timed out after ${timeoutMs}ms.`);
    }
    throw new Error(`Could not reach GitHub: ${error.message}`);
  }
  if (response.status === 404) {
    throw new Error(`${owner}/${name} was not found. Check the name, or connect GitHub if the repo is private.`);
  }
  if (!response.ok) {
    throw new Error(`GitHub returned ${response.status} while downloading ${owner}/${name}.`);
  }

  const archive = Buffer.from(await response.arrayBuffer());
  let tarball;
  try {
    tarball = gunzipSync(archive);
  } catch {
    throw new Error(`GitHub returned an unreadable archive for ${owner}/${name}.`);
  }
  await extractTarball(tarball, destination, { strip: 1 });
}

// Minimal tar extraction (ustar/pax, as produced by git archive and the GitHub
// tarball API). Regular files and directories only; symlinks are skipped.
export async function extractTarball(tarball, destination, { strip = 0 } = {}) {
  await mkdir(destination, { recursive: true });
  let offset = 0;
  let overridePath = null;

  while (offset + 512 <= tarball.length) {
    const header = tarball.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;

    const size = parseInt(readField(header, 124, 12) || "0", 8) || 0;
    const type = String.fromCharCode(header[156] || 0x30);
    const data = tarball.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;

    if (type === "L") {
      overridePath = data.toString("utf8").replace(/\0+$/, "");
      continue;
    }
    if (type === "x") {
      const paxPath = parsePaxRecords(data).path;
      if (paxPath) overridePath = paxPath;
      continue;
    }
    if (type === "g") continue;

    const prefix = readField(header, 345, 155);
    const rawName = overridePath ?? (prefix ? `${prefix}/${readField(header, 0, 100)}` : readField(header, 0, 100));
    overridePath = null;

    const parts = rawName.split("/").filter((part) => part && part !== ".");
    if (parts.includes("..")) continue;
    const relative = parts.slice(strip).join("/");
    if (!relative) continue;
    const target = path.join(destination, relative);

    if (type === "5") {
      await mkdir(target, { recursive: true });
    } else if (type === "0") {
      await mkdir(path.dirname(target), { recursive: true });
      const mode = (parseInt(readField(header, 100, 8) || "644", 8) || 0o644) & 0o777;
      await writeFile(target, data, { mode });
    }
  }
}

function readField(header, start, length) {
  const raw = header.toString("utf8", start, start + length);
  const nul = raw.indexOf("\0");
  return (nul === -1 ? raw : raw.slice(0, nul)).trim();
}

function parsePaxRecords(data) {
  const records = {};
  const text = data.toString("utf8");
  let cursor = 0;
  while (cursor < text.length) {
    const space = text.indexOf(" ", cursor);
    if (space === -1) break;
    const recordLength = parseInt(text.slice(cursor, space), 10);
    if (!Number.isFinite(recordLength) || recordLength <= 0) break;
    const record = text.slice(space + 1, cursor + recordLength);
    const equals = record.indexOf("=");
    if (equals !== -1) {
      records[record.slice(0, equals)] = record.slice(equals + 1).replace(/\n$/, "");
    }
    cursor += recordLength;
  }
  return records;
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
