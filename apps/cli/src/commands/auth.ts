import { createHmac } from "node:crypto";
import { saveCredentials } from "@fruitctl/shared";
import { Command } from "commander";

export const authCommand = new Command("auth");

authCommand
  .command("token")
  .description("Generate and save a JWT token")
  .option("--secret <secret>", "JWT secret (or set FRUITCTL_JWT_SECRET)")
  .option("--server <url>", "Server URL", "http://127.0.0.1:3456")
  .action(async (opts) => {
    const secret = opts.secret ?? process.env.FRUITCTL_JWT_SECRET;
    if (!secret) {
      console.error("Error: --secret or FRUITCTL_JWT_SECRET required");
      process.exit(1);
    }
    const header = Buffer.from(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        sub: "fruitctl-cli",
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const token = `${header}.${payload}.${signature}`;

    saveCredentials({ token, serverUrl: opts.server });
    console.log("Token saved to ~/.config/fruitctl/credentials.json");
  });
