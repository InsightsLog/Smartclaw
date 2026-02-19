/**
 * Smartclaw — Agent registry.
 *
 * Central hub for creating, retrieving, listing, and removing
 * agents. Provides domain-based lookup so the router and prompt
 * engine can find the right agent for a given intent.
 */

import type { AgentConfig, AgentStatus, Id } from "../types.js";
import { Agent } from "./agent.js";

/**
 * Manages the full set of registered agents.
 */
export class AgentRegistry {
  private agents = new Map<Id, Agent>();

  /**
   * Register a new agent from a config object.
   *
   * @returns The created Agent instance.
   * @throws If an agent with the same id is already registered.
   */
  register(config: AgentConfig, memoryLimit?: number): Agent {
    if (this.agents.has(config.id)) {
      throw new Error(`Agent "${config.id}" is already registered`);
    }
    const agent = new Agent(config, memoryLimit);
    this.agents.set(config.id, agent);
    return agent;
  }

  /** Remove an agent by id. */
  unregister(id: Id): boolean {
    return this.agents.delete(id);
  }

  /** Retrieve an agent by id. */
  get(id: Id): Agent | undefined {
    return this.agents.get(id);
  }

  /** Check whether an agent is registered. */
  has(id: Id): boolean {
    return this.agents.has(id);
  }

  /** List all registered agent ids. */
  list(): Id[] {
    return [...this.agents.keys()];
  }

  /** Return all agents. */
  all(): Agent[] {
    return [...this.agents.values()];
  }

  /** Find agents that cover a given domain. */
  findByDomain(domain: string): Agent[] {
    return [...this.agents.values()].filter(
      (a) => a.domains.length === 0 || a.domains.includes(domain),
    );
  }

  /** Find agents that are in a specific status. */
  findByStatus(status: AgentStatus): Agent[] {
    return [...this.agents.values()].filter((a) => a.status === status);
  }

  /** Number of registered agents. */
  get size(): number {
    return this.agents.size;
  }
}
