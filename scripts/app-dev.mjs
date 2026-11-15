import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(process.execPath, ["scripts/app-api.mjs"], { stdio: "inherit", env: process.env }),
  spawn(npm, ["exec", "vite", "--", "--host", "127.0.0.1"], { stdio: "inherit", env: process.env, shell: process.platform === "win32" }),
];
const stop = () => children.forEach((child) => child.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", (code) => { if (code && code !== 0) { stop(); process.exitCode = code; } });
