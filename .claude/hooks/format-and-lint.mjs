// PostToolUse hook: formats every file Claude creates or edits with Prettier and lints
// JS/TS files with ESLint (--fix). Remaining lint errors are reported back to
// Claude through stderr with exit code 2 so they get fixed.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const LINTABLE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
]);
const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".git",
  "out",
  "build",
]);

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const filePath = input.tool_input?.file_path ?? input.tool_response?.filePath;

if (!filePath) process.exit(0);

const absolutePath = path.resolve(projectDir, filePath);
const relativePath = path.relative(projectDir, absolutePath);
const isOutsideProject =
  relativePath.startsWith("..") || path.isAbsolute(relativePath);
const firstSegment = relativePath.split(path.sep)[0];

if (
  isOutsideProject ||
  SKIPPED_DIRECTORIES.has(firstSegment) ||
  !existsSync(absolutePath)
) {
  process.exit(0);
}

const run = (binRelativePath, args) => {
  const bin = path.join(projectDir, binRelativePath);
  if (!existsSync(bin)) return { skipped: true };
  const result = spawnSync(process.execPath, [bin, ...args], {
    cwd: projectDir,
    encoding: "utf8",
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
};

const problems = [];

const prettier = run("node_modules/prettier/bin/prettier.cjs", [
  "--write",
  "--ignore-unknown",
  "--log-level",
  "warn",
  absolutePath,
]);
if (!prettier.skipped && prettier.status !== 0) {
  problems.push(`Prettier failed on ${relativePath}:\n${prettier.output}`);
}

if (LINTABLE_EXTENSIONS.has(path.extname(absolutePath))) {
  const eslint = run("node_modules/eslint/bin/eslint.js", [
    "--fix",
    "--no-warn-ignored",
    absolutePath,
  ]);
  if (!eslint.skipped && eslint.status !== 0) {
    problems.push(
      `ESLint found problems in ${relativePath} that --fix could not resolve:\n${eslint.output}`,
    );
  }
}

if (problems.length > 0) {
  process.stderr.write(problems.join("\n\n"));
  process.exit(2);
}
