import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";

const PID_DIR = join(homedir(), ".config", "fruitctl");
const PID_PATH = join(PID_DIR, "server.pid");

function writePid(pid: number): void {
  mkdirSync(PID_DIR, { recursive: true });
  writeFileSync(PID_PATH, String(pid));
}

function readPid(): number | null {
  try {
    const raw = readFileSync(PID_PATH, "utf-8").trim();
    const pid = Number(raw);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function removePid(): void {
  try {
    unlinkSync(PID_PATH);
  } catch {
    // Already gone
  }
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export const serverCommand = new Command("server");

serverCommand
  .command("start")
  .description("Start the fruitctl server")
  .option("--port <port>", "Port", "3456")
  .option("--host <host>", "Host", "0.0.0.0")
  .action(async (opts) => {
    console.log(`Starting fruitctl server on ${opts.host}:${opts.port}...`);
    const child = spawn("pnpm", ["--filter", "@fruitctl/core", "dev"], {
      stdio: "inherit",
      env: {
        ...process.env,
        FRUITCTL_PORT: opts.port,
        FRUITCTL_HOST: opts.host,
      },
    });
    writePid(child.pid!);
    child.on("exit", (code) => {
      removePid();
      process.exit(code ?? 0);
    });
  });

serverCommand
  .command("stop")
  .description("Stop the fruitctl server")
  .action(async () => {
    const pid = readPid();
    if (!pid) {
      console.log("No PID file found. Is the server running?");
      process.exit(1);
    }
    if (!isProcessRunning(pid)) {
      console.log(`Server process ${pid} is not running. Cleaning up PID file.`);
      removePid();
      return;
    }
    process.kill(pid, "SIGTERM");
    console.log(`Sent SIGTERM to server (PID ${pid}).`);
    removePid();
  });

serverCommand
  .command("status")
  .description("Check if the server is running")
  .action(async () => {
    try {
      const res = await fetch("http://127.0.0.1:3456/health");
      const data = await res.json();
      console.log(`Server status: ${(data as any).status}`);
    } catch {
      console.log("Server is not running");
    }
  });
