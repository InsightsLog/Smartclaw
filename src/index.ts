/**
 * Smartclaw — Main entry point.
 *
 * Exports the Smartclaw class which wires together the gateway,
 * channels, security, prompt engine, and skills subsystems.
 */

import { Gateway, type GatewayOptions } from "./gateway/gateway.js";
import { SessionManager } from "./gateway/session.js";
import { MessageRouter } from "./channels/router.js";
import { AuditLogger } from "./security/audit.js";
import { SandboxManager } from "./security/sandbox.js";
import { SecurityPolicy } from "./security/policy.js";
import { PromptEngine } from "./prompt/engine.js";
import { IntentTriangulator } from "./prompt/triangulator.js";
import { SkillsRegistry } from "./skills/registry.js";
import { SkillLoader } from "./skills/loader.js";
import { loadConfig, type SmartclawConfig } from "./config/config.js";

export {
  Gateway,
  SessionManager,
  MessageRouter,
  AuditLogger,
  SandboxManager,
  SecurityPolicy,
  PromptEngine,
  IntentTriangulator,
  SkillsRegistry,
  SkillLoader,
  loadConfig,
};

export type { SmartclawConfig, GatewayOptions };

/**
 * Top-level Smartclaw assistant that orchestrates all subsystems.
 */
export class Smartclaw {
  readonly gateway: Gateway;
  readonly router: MessageRouter;
  readonly audit: AuditLogger;
  readonly sandbox: SandboxManager;
  readonly policy: SecurityPolicy;
  readonly promptEngine: PromptEngine;
  readonly skills: SkillsRegistry;
  readonly skillLoader: SkillLoader;
  readonly config: SmartclawConfig;

  constructor(config?: SmartclawConfig) {
    this.config = config ?? loadConfig();

    this.gateway = new Gateway({
      port: this.config.gateway.port,
      host: this.config.gateway.host,
      maxConnections: this.config.gateway.maxConnections,
    });

    this.router = new MessageRouter();
    this.audit = new AuditLogger();
    this.sandbox = new SandboxManager();
    this.policy = SecurityPolicy.fromConfig(this.config.security);
    this.promptEngine = new PromptEngine({
      tokenBudget: this.config.prompt.tokenBudget,
      qualityGateEnabled: this.config.prompt.qualityGateEnabled,
    });
    this.skills = new SkillsRegistry();
    this.skillLoader = new SkillLoader();

    this.gateway.on("message", (msg) => {
      this.audit.info("message.received", msg.sender, {
        channelId: msg.channelId,
        sessionId: msg.sessionId,
      });
    });
  }

  /** Start the Smartclaw assistant. */
  async start(): Promise<void> {
    this.audit.info("smartclaw.starting", "system");
    await this.gateway.start();
    this.audit.info("smartclaw.started", "system", { port: this.config.gateway.port });
  }

  /** Stop the Smartclaw assistant. */
  async stop(): Promise<void> {
    this.audit.info("smartclaw.stopping", "system");
    await this.gateway.stop();
    this.audit.info("smartclaw.stopped", "system");
  }
}

// Auto-start when run directly
const isMainModule =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("/index.js") || process.argv[1].endsWith("/index.ts"));

if (isMainModule) {
  const app = new Smartclaw();
  app.start().catch((err) => {
    console.error("Failed to start Smartclaw:", err);
    process.exit(1);
  });
}
