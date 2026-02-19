import { describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";

describe("loadConfig", () => {
	it("loads config from env vars", () => {
		const config = loadConfig({
			FRUITCTL_JWT_SECRET: "a-very-long-secret-key",
			FRUITCTL_PORT: "4000",
		});
		expect(config.port).toBe(4000);
		expect(config.host).toBe("127.0.0.1");
		expect(config.jwtSecret).toBe("a-very-long-secret-key");
	});

	it("throws when jwt secret is missing", () => {
		expect(() => loadConfig({})).toThrow();
	});

	it("throws when jwt secret is too short", () => {
		expect(() => loadConfig({ FRUITCTL_JWT_SECRET: "short" })).toThrow();
	});
});
