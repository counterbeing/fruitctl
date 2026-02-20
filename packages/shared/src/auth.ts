import { createHmac } from "node:crypto";

export type Role = "admin" | "agent";

export function deriveKey(role: Role, secret: string): string {
  const hash = createHmac("sha256", secret).update(role).digest("hex");
  return `fctl_${role}_${hash}`;
}
