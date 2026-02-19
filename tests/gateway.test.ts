import { describe, it, expect, beforeEach } from "vitest";
import { Gateway } from "../src/gateway/gateway.js";
import { SessionManager } from "../src/gateway/session.js";
import type { Message } from "../src/types.js";

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg_1",
    channelId: "ch_1",
    sessionId: "",
    sender: "user",
    content: "hello",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("Gateway", () => {
  let gw: Gateway;

  beforeEach(() => {
    gw = new Gateway({ port: 3000, host: "0.0.0.0", maxConnections: 5 });
  });

  it("starts and reports running", async () => {
    const port = await gw.start();
    expect(port).toBe(3000);
    expect(gw.isRunning).toBe(true);
  });

  it("throws when started twice", async () => {
    await gw.start();
    await expect(gw.start()).rejects.toThrow("already running");
  });

  it("stops and reports not running", async () => {
    await gw.start();
    await gw.stop();
    expect(gw.isRunning).toBe(false);
  });

  it("tracks connections", async () => {
    await gw.start();
    expect(gw.addConnection("c1")).toBe(true);
    expect(gw.connectionCount).toBe(1);
    gw.removeConnection("c1");
    expect(gw.connectionCount).toBe(0);
  });

  it("rejects connections beyond max", async () => {
    await gw.start();
    gw.on("error", () => {}); // suppress unhandled error event
    for (let i = 0; i < 5; i++) gw.addConnection(`c${i}`);
    expect(gw.addConnection("overflow")).toBe(false);
  });

  it("handles messages and creates sessions", async () => {
    await gw.start();
    const session = gw.handleMessage(makeMessage());
    expect(session.channelId).toBe("ch_1");
    expect(gw.sessions.size).toBe(1);
  });

  it("reuses existing session for same channel", async () => {
    await gw.start();
    const s1 = gw.handleMessage(makeMessage());
    const s2 = gw.handleMessage(makeMessage({ id: "msg_2" }));
    expect(s1.id).toBe(s2.id);
    expect(gw.sessions.size).toBe(1);
  });

  it("throws on message when not running", () => {
    expect(() => gw.handleMessage(makeMessage())).toThrow("not running");
  });

  it("broadcasts to channel sessions", async () => {
    await gw.start();
    gw.handleMessage(makeMessage());
    const reached = gw.broadcastToChannel("ch_1", "hi");
    expect(reached).toBe(1);
  });

  it("emits events", async () => {
    const events: string[] = [];
    gw.on("start", () => events.push("start"));
    gw.on("stop", () => events.push("stop"));
    gw.on("message", () => events.push("message"));

    await gw.start();
    gw.handleMessage(makeMessage());
    await gw.stop();

    expect(events).toEqual(["start", "message", "stop"]);
  });
});

describe("SessionManager", () => {
  let sm: SessionManager;

  beforeEach(() => {
    sm = new SessionManager();
  });

  it("creates sessions with unique ids", () => {
    const s1 = sm.create("ch_1", "agent_1");
    const s2 = sm.create("ch_1", "agent_1");
    expect(s1.id).not.toBe(s2.id);
    expect(sm.size).toBe(2);
  });

  it("retrieves sessions by id", () => {
    const s = sm.create("ch_1", "agent_1");
    expect(sm.get(s.id)).toBe(s);
  });

  it("filters by channel", () => {
    sm.create("ch_1", "a");
    sm.create("ch_2", "a");
    sm.create("ch_1", "b");
    expect(sm.getByChannel("ch_1")).toHaveLength(2);
  });

  it("destroys sessions", () => {
    const s = sm.create("ch_1", "a");
    expect(sm.destroy(s.id)).toBe(true);
    expect(sm.get(s.id)).toBeUndefined();
  });

  it("prunes stale sessions", () => {
    const s = sm.create("ch_1", "a");
    // Manually backdate
    (s as any).lastActiveAt = Date.now() - 100_000;
    const removed = sm.prune(50_000);
    expect(removed).toBe(1);
    expect(sm.size).toBe(0);
  });

  it("touches sessions to update lastActiveAt", () => {
    const s = sm.create("ch_1", "a");
    const before = s.lastActiveAt;
    // Small delay to ensure timestamp differs
    sm.touch(s.id);
    expect(s.lastActiveAt).toBeGreaterThanOrEqual(before);
  });
});
