/**
 * Smartclaw — Agent (from Nanoclaw agent-swarm concept).
 *
 * An Agent is a living entity with identity, personality,
 * memory, status, and a lifecycle. Agents are routed to by
 * the message router and carry context through the prompt
 * pipeline so each conversation feels personal and consistent.
 */

import type {
  AgentConfig,
  AgentMemoryEntry,
  AgentStatus,
  Id,
} from "../types.js";

/**
 * A living agent that maintains state across interactions.
 */
export class Agent {
  readonly id: Id;
  readonly name: string;
  readonly description: string;
  readonly systemPrompt: string;
  readonly domains: string[];
  readonly allowedSkills: string[];
  readonly personality: Record<string, unknown>;

  private _status: AgentStatus = "idle";
  private _memory: AgentMemoryEntry[] = [];
  private _memoryLimit: number;
  private _messagesHandled = 0;
  private _createdAt: number;
  private _lastActiveAt: number;
  private memoryCounter = 0;

  constructor(config: AgentConfig, memoryLimit = 200) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.systemPrompt = config.systemPrompt;
    this.domains = config.domains ?? [];
    this.allowedSkills = config.allowedSkills ?? [];
    this.personality = config.personality ?? {};
    this._memoryLimit = memoryLimit;
    this._createdAt = Date.now();
    this._lastActiveAt = this._createdAt;
  }

  // ── Status ──────────────────────────────────────────────

  /** Current operational status. */
  get status(): AgentStatus {
    return this._status;
  }

  /** Transition to a new status. */
  setStatus(status: AgentStatus): void {
    this._status = status;
  }

  /** Mark the agent as active and record activity time. */
  activate(): void {
    this._status = "active";
    this._lastActiveAt = Date.now();
  }

  /** Return the agent to idle when it finishes work. */
  deactivate(): void {
    if (this._status !== "offline") {
      this._status = "idle";
    }
  }

  /** Take the agent offline. */
  goOffline(): void {
    this._status = "offline";
  }

  /** Bring the agent back online (to idle). */
  goOnline(): void {
    this._status = "idle";
    this._lastActiveAt = Date.now();
  }

  // ── Memory ──────────────────────────────────────────────

  /** Full memory list (most-recent last). */
  get memory(): readonly AgentMemoryEntry[] {
    return this._memory;
  }

  /** Number of memory entries. */
  get memorySize(): number {
    return this._memory.length;
  }

  /** Record a new memory entry. Evicts the oldest when limit is reached. */
  remember(
    role: AgentMemoryEntry["role"],
    content: string,
    metadata?: Record<string, unknown>,
  ): AgentMemoryEntry {
    const entry: AgentMemoryEntry = {
      id: `mem_${++this.memoryCounter}_${Date.now()}`,
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };
    this._memory.push(entry);
    if (this._memory.length > this._memoryLimit) {
      this._memory.shift();
    }
    return entry;
  }

  /** Retrieve the most recent N memories. */
  recentMemory(count: number): AgentMemoryEntry[] {
    return this._memory.slice(-count);
  }

  /** Forget (clear) all memories. */
  clearMemory(): void {
    this._memory = [];
  }

  // ── Skill Access ────────────────────────────────────────

  /** Check whether this agent may use a given skill. */
  canUseSkill(skillName: string): boolean {
    if (this.allowedSkills.length === 0) return true; // empty = all
    return this.allowedSkills.includes(skillName);
  }

  // ── Stats / Meta ────────────────────────────────────────

  /** When the agent was created. */
  get createdAt(): number {
    return this._createdAt;
  }

  /** When the agent was last active. */
  get lastActiveAt(): number {
    return this._lastActiveAt;
  }

  /** Total messages this agent has handled. */
  get messagesHandled(): number {
    return this._messagesHandled;
  }

  /** Increment the handled-message counter. */
  recordInteraction(): void {
    this._messagesHandled++;
    this._lastActiveAt = Date.now();
  }

  /** Build a context-window–friendly summary of this agent's recent memory. */
  buildContext(recentCount = 10): string {
    const entries = this.recentMemory(recentCount);
    if (entries.length === 0) return "";
    return entries.map((e) => `[${e.role}] ${e.content}`).join("\n");
  }
}
