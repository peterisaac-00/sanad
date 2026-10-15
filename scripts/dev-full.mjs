// Runs backend (tsx server/index.ts) + frontend (vite) together.
// Usage: npm run dev:full
import { spawn } from "node:child_process";

const jobs = [
  { name: "backend ", cmd: "npx", args: ["tsx", "--watch", "server/index.ts"], color: "\x1b[32m" },
  { name: "frontend", cmd: "npx", args: ["vite", "--port=3000", "--host=0.0.0.0"], color: "\x1b[36m" },
];

for (const j of jobs) {
  const p = spawn(j.cmd, j.args, { stdio: "pipe", shell: true });
  p.stdout.on("data", (d) => process.stdout.write(`${j.color}[${j.name}]\x1b[0m ${d}`));
  p.stderr.on("data", (d) => process.stderr.write(`${j.color}[${j.name}]\x1b[0m ${d}`));
  p.on("exit", (code) => {
    console.error(`[${j.name}] exited with code ${code}`);
    process.exit(code ?? 1);
  });
}

process.on("SIGINT", () => process.exit(0));
