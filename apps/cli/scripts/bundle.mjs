import { build } from "esbuild";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";

await build({
	entryPoints: ["src/index.ts"],
	bundle: true,
	platform: "node",
	format: "cjs",
	outfile: "dist/fruitctl.cjs",
});

// Ensure shebang is present on line 1
let code = readFileSync("dist/fruitctl.cjs", "utf-8");
if (!code.startsWith("#!")) {
	code = `#!/usr/bin/env node\n${code}`;
	writeFileSync("dist/fruitctl.cjs", code);
}
chmodSync("dist/fruitctl.cjs", 0o755);
console.log("Bundled dist/fruitctl.cjs");
