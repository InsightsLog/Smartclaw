/**
 * Smartclaw — Session management.
 *
 * Tracks active sessions across channels and agents.
 * Handles creation, lookup, activity updates, and pruning
 * of stale sessions.
 */

import type { Id } from "../types.js";

/** A live session binding a channel to an agent. */
export interface Session {
  id: Id;
  channelId: Id;
  agentId: Id;
  createdAt: number;
  lastActiveAt: number;
  metadata: Record<string, unknown>;
}

/**
 * Manages the lifecycle of sessions.
 */
export class SessionManager {
  private sessions = new Map<Id, Session>();
  private counter = 0;

  /** Create a new session and return it. */
  create(channelId: Id, agentId: Id, metadata: Record<string, unknown> = {}): Session {
    const now = Date.now();
    const id = `sess_${++this.counter}_${now}`;
    const session: Session = {
      id,
      channelId,
      agentId,
      createdAt: now,
      lastActiveAt: now,
      metadata,
    };
    this.sessions.set(id, session);
    return session;
  }

  /** Retrieve a session by id. */
  get(id: Id): Session | undefined {
    return this.sessions.get(id);
  }

  /** Mark a session as active (updates lastActiveAt). */
  touch(id: Id): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActiveAt = Date.now();
    }
  }

  /** Remove a session. */
  destroy(id: Id): boolean {
    return this.sessions.delete(id);
  }

  /** Return all sessions for a given channel. */
  getByChannel(channelId: Id): Session[] {
    return [...this.sessions.values()].filter((s) => s.channelId === channelId);
  }

  /** Prune sessions inactive for longer than `maxIdleMs`. Returns count removed. */
  prune(maxIdleMs: number): number {
    const cutoff = Date.now() - maxIdleMs;
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (session.lastActiveAt < cutoff) {
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /** Number of active sessions. */
  get size(): number {
    return this.sessions.size;
  }
}
