/**
 * Smartclaw — Abstract channel interface.
 *
 * Defines the contract for all communication channels
 * (WhatsApp, Telegram, Slack, Discord, WebSocket, etc.).
 */

import { EventEmitter } from "node:events";
import type { ChannelType, Id, Message } from "../types.js";

/** Events emitted by a Channel. */
export interface ChannelEvents {
  connected: [];
  disconnected: [];
  message: [message: Message];
  error: [error: Error];
}

/** Configuration for a channel instance. */
export interface ChannelConfig {
  id: Id;
  type: ChannelType;
  name: string;
  options?: Record<string, unknown>;
}

/**
 * Abstract base class for all channels.
 *
 * Subclass this and implement the four abstract methods
 * to add a new communication channel to Smartclaw.
 */
export abstract class Channel extends EventEmitter<ChannelEvents> {
  readonly id: Id;
  readonly type: ChannelType;
  readonly name: string;
  protected connected = false;

  constructor(config: ChannelConfig) {
    super();
    this.id = config.id;
    this.type = config.type;
    this.name = config.name;
  }

  /** Whether the channel is currently connected. */
  get isConnected(): boolean {
    return this.connected;
  }

  /** Connect to the channel's backing service. */
  abstract connect(): Promise<void>;

  /** Disconnect from the channel. */
  abstract disconnect(): Promise<void>;

  /** Send a message through this channel. */
  abstract sendMessage(content: string, recipientId: Id): Promise<void>;

  /** Called when a raw message arrives from the backing service. */
  protected onMessage(message: Message): void {
    this.emit("message", message);
  }
}

/**
 * A simple in-memory channel useful for testing and local development.
 */
export class LocalChannel extends Channel {
  private outbox: Array<{ content: string; recipientId: Id }> = [];

  constructor(id: Id = "local", name: string = "Local") {
    super({ id, type: "custom", name });
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.emit("connected");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.emit("disconnected");
  }

  async sendMessage(content: string, recipientId: Id): Promise<void> {
    if (!this.connected) throw new Error("Channel not connected");
    this.outbox.push({ content, recipientId });
  }

  /** Inject a message as if it came from a user (for testing). */
  simulateIncoming(message: Message): void {
    this.onMessage(message);
  }

  /** Read messages that were sent out. */
  getOutbox(): Array<{ content: string; recipientId: Id }> {
    return [...this.outbox];
  }
}
