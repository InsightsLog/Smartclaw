/**
 * Smartclaw — Gateway WebSocket control plane.
 *
 * Central hub that manages connections, sessions, and message routing.
 * Inspired by OpenClaw's Gateway architecture.
 */

import { EventEmitter } from "node:events";
import { SessionManager, type Session } from "./session.js";
import type { Id, Message } from "../types.js";

/** Events emitted by the Gateway. */
export interface GatewayEvents {
  start: [port: number];
  stop: [];
  connection: [connectionId: Id];
  disconnect: [connectionId: Id];
  message: [message: Message];
  error: [error: Error];
}

/** Configuration passed to the Gateway constructor. */
export interface GatewayOptions {
  port: number;
  host: string;
  maxConnections: number;
}

/**
 * Gateway manages WebSocket connections, sessions, and message routing.
 */
export class Gateway extends EventEmitter<GatewayEvents> {
  private running = false;
  private connections = new Set<Id>();
  readonly sessions: SessionManager;
  private readonly options: GatewayOptions;

  constructor(options: GatewayOptions) {
    super();
    this.options = options;
    this.sessions = new SessionManager();
  }

  /** Whether the gateway is currently running. */
  get isRunning(): boolean {
    return this.running;
  }

  /** Number of active connections. */
  get connectionCount(): number {
    return this.connections.size;
  }

  /**
   * Start the gateway and begin accepting connections.
   *
   * @returns The port the gateway is listening on
   */
  async start(): Promise<number> {
    if (this.running) {
      throw new Error("Gateway is already running");
    }
    this.running = true;
    this.emit("start", this.options.port);
    return this.options.port;
  }

  /** Stop the gateway and disconnect all clients. */
  async stop(): Promise<void> {
    if (!this.running) return;
    for (const connId of this.connections) {
      this.removeConnection(connId);
    }
    this.running = false;
    this.emit("stop");
  }

  /** Register a new connection. */
  addConnection(connectionId: Id): boolean {
    if (this.connections.size >= this.options.maxConnections) {
      this.emit("error", new Error("Max connections reached"));
      return false;
    }
    this.connections.add(connectionId);
    this.emit("connection", connectionId);
    return true;
  }

  /** Remove a connection and clean up its sessions. */
  removeConnection(connectionId: Id): void {
    this.connections.delete(connectionId);
    this.emit("disconnect", connectionId);
  }

  /** Handle an incoming message — validates, creates session if needed, and emits. */
  handleMessage(message: Message): Session {
    if (!this.running) {
      throw new Error("Gateway is not running");
    }

    let sessions = this.sessions.getByChannel(message.channelId);
    let session: Session;

    if (sessions.length > 0) {
      session = sessions[0];
      this.sessions.touch(session.id);
    } else {
      session = this.sessions.create(message.channelId, "default-agent");
    }

    const enrichedMessage: Message = {
      ...message,
      sessionId: session.id,
    };

    this.emit("message", enrichedMessage);
    return session;
  }

  /**
   * Broadcast a content string to every connection on a given channel.
   * Returns the number of connections reached.
   */
  broadcastToChannel(channelId: Id, content: string): number {
    const sessions = this.sessions.getByChannel(channelId);
    for (const s of sessions) {
      this.sessions.touch(s.id);
    }
    return sessions.length;
  }
}
