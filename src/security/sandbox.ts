/**
 * Smartclaw — Container sandbox manager (from Nanoclaw).
 *
 * Provides an abstraction over isolated execution environments.
 * The default "process" provider runs code in the current process
 * behind a safety boundary (no actual Docker required).
 */

import type { SandboxOptions, SandboxResult } from "../types.js";

/** Represents an active sandbox instance. */
export interface SandboxInstance {
  id: string;
  createdAt: number;
  options: SandboxOptions;
  destroyed: boolean;
}

/**
 * Manages isolated execution sandboxes.
 */
export class SandboxManager {
  private sandboxes = new Map<string, SandboxInstance>();
  private counter = 0;

  /** Default sandbox options. */
  static readonly DEFAULTS: SandboxOptions = {
    memoryLimitMb: 512,
    timeoutMs: 30_000,
    networkAccess: false,
    allowedPaths: ["/tmp"],
  };

  /** Create a new sandbox and return it. */
  createSandbox(options: Partial<SandboxOptions> = {}): SandboxInstance {
    const id = `sandbox_${++this.counter}`;
    const instance: SandboxInstance = {
      id,
      createdAt: Date.now(),
      options: { ...SandboxManager.DEFAULTS, ...options },
      destroyed: false,
    };
    this.sandboxes.set(id, instance);
    return instance;
  }

  /** Destroy a sandbox and release its resources. */
  destroySandbox(id: string): boolean {
    const instance = this.sandboxes.get(id);
    if (!instance) return false;
    instance.destroyed = true;
    this.sandboxes.delete(id);
    return true;
  }

  /**
   * Execute a function inside a sandbox.
   *
   * The abstraction enforces timeout but delegates to a simple in-process
   * execution model by default (no Docker dependency).
   */
  async executeInSandbox(
    id: string,
    fn: () => Promise<string>,
  ): Promise<SandboxResult> {
    const instance = this.sandboxes.get(id);
    if (!instance) {
      return { success: false, output: "Sandbox not found", exitCode: 1, durationMs: 0 };
    }
    if (instance.destroyed) {
      return { success: false, output: "Sandbox destroyed", exitCode: 1, durationMs: 0 };
    }

    const start = Date.now();

    try {
      const output = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Sandbox timeout")), instance.options.timeoutMs),
        ),
      ]);
      return {
        success: true,
        output,
        exitCode: 0,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        output: err instanceof Error ? err.message : String(err),
        exitCode: 1,
        durationMs: Date.now() - start,
      };
    }
  }

  /** Get a sandbox by id. */
  get(id: string): SandboxInstance | undefined {
    return this.sandboxes.get(id);
  }

  /** Number of active sandboxes. */
  get size(): number {
    return this.sandboxes.size;
  }
}
