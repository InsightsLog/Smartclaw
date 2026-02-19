import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config/config.js";

describe("loadConfig", () => {
  it("returns defaults when no env vars are set", () => {
    const config = loadConfig({});
    expect(config.gateway.port).toBe(3000);
    expect(config.gateway.host).toBe("0.0.0.0");
    expect(config.gateway.maxConnections).toBe(100);
    expect(config.security.networkIsolation).toBe(false);
    expect(config.security.filesystemRestrict).toBe(true);
    expect(config.security.rateLimitRpm).toBe(60);
    expect(config.sandbox.provider).toBe("process");
    expect(config.sandbox.memoryLimitMb).toBe(512);
    expect(config.prompt.tokenBudget).toBe(4096);
    expect(config.logLevel).toBe("info");
  });

  it("reads values from env", () => {
    const config = loadConfig({
      GATEWAY_PORT: "8080",
      GATEWAY_HOST: "localhost",
      GATEWAY_MAX_CONNECTIONS: "50",
      SECURITY_NETWORK_ISOLATION: "true",
      SECURITY_RATE_LIMIT_RPM: "120",
      SANDBOX_PROVIDER: "docker",
      SANDBOX_MEMORY_LIMIT_MB: "1024",
      PROMPT_TOKEN_BUDGET: "8192",
      LOG_LEVEL: "debug",
    });
    expect(config.gateway.port).toBe(8080);
    expect(config.gateway.host).toBe("localhost");
    expect(config.gateway.maxConnections).toBe(50);
    expect(config.security.networkIsolation).toBe(true);
    expect(config.security.rateLimitRpm).toBe(120);
    expect(config.sandbox.provider).toBe("docker");
    expect(config.sandbox.memoryLimitMb).toBe(1024);
    expect(config.prompt.tokenBudget).toBe(8192);
    expect(config.logLevel).toBe("debug");
  });

  it("parses allowed paths as comma-separated list", () => {
    const config = loadConfig({ SECURITY_ALLOWED_PATHS: "/tmp, /home, /var" });
    expect(config.security.allowedPaths).toEqual(["/tmp", "/home", "/var"]);
  });

  it("rejects invalid port", () => {
    expect(() => loadConfig({ GATEWAY_PORT: "99999" })).toThrow();
  });

  it("rejects invalid log level", () => {
    expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrow();
  });

  it("rejects invalid sandbox provider", () => {
    expect(() => loadConfig({ SANDBOX_PROVIDER: "kubernetes" })).toThrow();
  });
});
