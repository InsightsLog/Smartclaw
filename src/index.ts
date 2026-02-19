/**
 * Smartclaw — Main entry point.
 *
 * Exports the Smartclaw class which wires together the gateway,
 * channels, security, prompt engine, and skills subsystems.
 */

import { Gateway, type GatewayOptions } from "./gateway/gateway.js";
import { SessionManager } from "./gateway/session.js";
import { Channel, LocalChannel } from "./channels/channel.js";
import { MessageRouter } from "./channels/router.js";
import { AuditLogger } from "./security/audit.js";
import { SandboxManager } from "./security/sandbox.js";
import { SecurityPolicy } from "./security/policy.js";
import { PromptEngine, type PipelineResult } from "./prompt/engine.js";
import { IntentTriangulator } from "./prompt/triangulator.js";
import { SkillsRegistry } from "./skills/registry.js";
import { SkillLoader } from "./skills/loader.js";
import { getBuiltinFactories } from "./skills/builtins.js";
import { loadConfig, type SmartclawConfig } from "./config/config.js";
import type { Message, MessageResult, SkillOutput } from "./types.js";

export {
  Gateway,
  SessionManager,
  Channel,
  LocalChannel,
  MessageRouter,
  AuditLogger,
  SandboxManager,
  SecurityPolicy,
  PromptEngine,
  IntentTriangulator,
  SkillsRegistry,
  SkillLoader,
  getBuiltinFactories,
  loadConfig,
};

export type { SmartclawConfig, GatewayOptions, PipelineResult };

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

    // Register built-in skill factories
    const builtins = getBuiltinFactories(() =>
      this.skills.list().map((name) => {
        const s = this.skills.get(name);
        return { name, description: s?.description ?? "" };
      }),
    );
    for (const factory of builtins) {
      this.skillLoader.registerFactory(factory);
    }

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

  /**
   * Process a message end-to-end through all subsystems:
   *  1. Route the message to an agent
   *  2. Check security policies (rate limit)
   *  3. Triage intent & load matching skills
   *  4. Run the five-stage prompt pipeline
   *  5. Execute relevant skills
   *  6. Return a unified MessageResult
   */
  async processMessage(message: Message): Promise<MessageResult> {
    const startTime = Date.now();
    this.audit.info("message.processing", message.sender, { messageId: message.id });

    // 1. Route
    const route = this.router.route(message);
    this.audit.info("message.routed", message.sender, {
      agentId: route.agentId,
      ruleName: route.ruleName,
    });

    // 2. Rate-limit check
    const rateCheck = this.policy.checkRateLimit();
    if (!rateCheck.allowed) {
      this.audit.warn("message.rate_limited", message.sender);
      return {
        messageId: message.id,
        response: "Rate limit exceeded. Please try again later.",
        skillsUsed: [],
        tokenCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // 3. Triage intent and load skills
    const intent = this.promptEngine.triageIntent(message.content);
    const loaded = this.skillLoader.loadForIntent(intent, this.skills);

    // Also register loaded skills with the prompt engine for injection
    for (const name of loaded) {
      const skill = this.skills.get(name);
      if (skill) this.promptEngine.registerSkill(skill);
    }

    // 4. Pipeline
    const pipeline = this.promptEngine.processMessage(message.content);

    // 5. Execute injected skills and collect results
    const skillOutputs: Array<{ name: string; output: SkillOutput }> = [];
    for (const skillName of pipeline.injectedSkills) {
      if (this.skills.has(skillName)) {
        try {
          const output = await this.skills.execute(skillName, {
            query: message.content,
            context: { intent, route },
          });
          skillOutputs.push({ name: skillName, output });
        } catch (err) {
          this.audit.error("skill.execution_failed", message.sender, {
            skill: skillName,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    // 6. Build response
    const responseParts: string[] = [];
    if (skillOutputs.length > 0) {
      for (const { name, output } of skillOutputs) {
        responseParts.push(`[${name}] ${output.result}`);
      }
    } else {
      responseParts.push(pipeline.prompt);
    }

    const response = responseParts.join("\n");
    const durationMs = Date.now() - startTime;

    this.audit.info("message.processed", message.sender, {
      messageId: message.id,
      skillsUsed: skillOutputs.map((s) => s.name),
      tokenEstimate: pipeline.tokenEstimate,
      durationMs,
    });

    return {
      messageId: message.id,
      response,
      skillsUsed: skillOutputs.map((s) => s.name),
      tokenCount: pipeline.tokenEstimate,
      durationMs,
    };
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
