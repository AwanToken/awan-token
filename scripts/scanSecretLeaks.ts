import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".git", "build", "dist"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(ent.name)) continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(ROOT);
const hits: string[] = [];
for (const p of files) {
  if (!/\.(json|md|ts|tsx|txt|example)$/i.test(p) && !p.endsWith(".env")) {
    continue;
  }
  // Never print .env contents — only note path
  if (p.endsWith(".env") || p.includes(`${"\\"}.env.`) || p.includes("/.env.")) {
    if (!p.endsWith(".example") && !p.includes(".env.example")) {
      hits.push("SECRET_FILE " + relative(ROOT, p));
    }
    continue;
  }
  const t = readFileSync(p, "utf8");
  if (/"mnemonic"\s*:\s*"[a-z]+(?: [a-z]+){11,}/i.test(t)) {
    hits.push("MNEMONIC_IN_FILE " + relative(ROOT, p));
  }
}

console.log(hits.length ? hits.join("\n") : "OK_NO_SCAN_HITS");
console.log(
  "env_ignored_pattern",
  existsSync(join(ROOT, ".gitignore")) &&
    /\.env/.test(readFileSync(join(ROOT, ".gitignore"), "utf8")),
);
if (existsSync(join(ROOT, ".env"))) {
  const mode = statSync(join(ROOT, ".env")).mode & 0o777;
  console.log("env_mode_octal", mode.toString(8));
}
