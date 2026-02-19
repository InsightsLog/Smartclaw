/**
 * Smartclaw — Message router.
 *
 * Routes incoming messages to the correct agent/session
 * based on channel, group, and activation rules.
 */

import type { Id, Message } from "../types.js";

/** A routing rule that maps patterns to agent ids. */
export interface RoutingRule {
  /** Unique name for this rule. */
  name: string;
  /** Channel types this rule applies to (empty = all). */
  channels: string[];
  /** Regex pattern matched against message content to activate the rule. */
  pattern: RegExp;
  /** Agent id to route to when this rule matches. */
  agentId: Id;
  /** Priority — higher number wins when multiple rules match. */
  priority: number;
}

/** Result of routing a message. */
export interface RouteResult {
  agentId: Id;
  ruleName: string;
  priority: number;
}

/**
 * Routes messages to agents based on configurable rules.
 */
export class MessageRouter {
  private rules: RoutingRule[] = [];
  private defaultAgentId: Id;

  constructor(defaultAgentId: Id = "default-agent") {
    this.defaultAgentId = defaultAgentId;
  }

  /** Add a routing rule. */
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /** Remove a rule by name. */
  removeRule(name: string): boolean {
    const before = this.rules.length;
    this.rules = this.rules.filter((r) => r.name !== name);
    return this.rules.length < before;
  }

  /**
   * Route a message — returns the matching rule result,
   * or falls back to the default agent.
   */
  route(message: Message, channelType?: string): RouteResult {
    for (const rule of this.rules) {
      if (rule.channels.length > 0 && channelType && !rule.channels.includes(channelType)) {
        continue;
      }
      if (rule.pattern.test(message.content)) {
        return {
          agentId: rule.agentId,
          ruleName: rule.name,
          priority: rule.priority,
        };
      }
    }
    return {
      agentId: this.defaultAgentId,
      ruleName: "default",
      priority: 0,
    };
  }

  /** Number of registered rules. */
  get ruleCount(): number {
    return this.rules.length;
  }
}
