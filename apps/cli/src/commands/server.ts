import { spawn } from "node:child_process";
import { Command } from "commander";

export const serverCommand = new Command("server");

serverCommand
	.command("start")
	.description("Start the fruitctl server")
	.option("--port <port>", "Port", "3456")
	.option("--host <host>", "Host", "127.0.0.1")
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
		child.on("exit", (code) => process.exit(code ?? 0));
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
