import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import {
  type ClientCredentials,
  credentialsPath,
  deriveKey,
  type ServerCredentials,
  saveCredentials,
} from "@fruitctl/shared";
import { Command } from "commander";

export const initCommand = new Command("init")
  .description("Initialize fruitctl credentials")
  .option("--client <token>", "Initialize as a client with the given API key")
  .option("--server <url>", "Server URL")
  .option("--force", "Overwrite existing credentials")
  .action(async (opts) => {
    const path = credentialsPath();

    if (existsSync(path) && !opts.force) {
      console.error(
        `Credentials already exist at ${path}\nUse --force to overwrite.`,
      );
      process.exit(1);
    }

    if (opts.client) {
      // Client mode
      if (!opts.server) {
        console.error("Error: --server <url> is required in client mode");
        process.exit(1);
      }
      const creds: ClientCredentials = {
        mode: "client",
        token: opts.client,
        serverUrl: opts.server,
      };
      saveCredentials(creds);
      console.log(`Client credentials saved to ${path}`);
    } else {
      // Server mode
      const secret = randomBytes(32).toString("base64");
      const adminKey = deriveKey("admin", secret);
      const agentKey = deriveKey("agent", secret);
      const serverUrl = opts.server ?? "http://127.0.0.1:3456";

      const creds: ServerCredentials = {
        mode: "server",
        secret,
        adminKey,
        agentKey,
        serverUrl,
      };
      saveCredentials(creds);

      console.log("Initialized fruitctl server credentials.\n");
      console.log(`  Admin key: ${adminKey}`);
      console.log(`  Agent key: ${agentKey}\n`);
      console.log(`Credentials saved to ${path}\n`);
      console.log("To configure a client, run on the client machine:");
      console.log(`  fruitctl init --client <agent-key> --server ${serverUrl}`);
    }
  });
