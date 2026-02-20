import { deriveKey, type Role, saveCredentials } from "@fruitctl/shared";
import { Command } from "commander";

export const authCommand = new Command("auth");

authCommand
	.command("token")
	.description("Generate and save an API key")
	.option("--secret <secret>", "Master secret (or set FRUITCTL_SECRET)")
	.option("--role <role>", "Key role: admin or agent", "admin")
	.option("--server <url>", "Server URL", "http://127.0.0.1:3456")
	.action(async (opts) => {
		const secret = opts.secret ?? process.env.FRUITCTL_SECRET;
		if (!secret) {
			console.error("Error: --secret or FRUITCTL_SECRET required");
			process.exit(1);
		}
		if (opts.role !== "admin" && opts.role !== "agent") {
			console.error("Error: --role must be 'admin' or 'agent'");
			process.exit(1);
		}
		const token = deriveKey(opts.role as Role, secret);
		saveCredentials({ token, serverUrl: opts.server });
		console.log(
			`${opts.role} key saved to ~/.config/fruitctl/credentials.json`,
		);
	});
