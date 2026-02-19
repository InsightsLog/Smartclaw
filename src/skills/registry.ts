/**
 * Smartclaw — Skills registry (from Nanoclaw).
 *
 * "Don't add features. Add skills."
 *
 * Register, discover, and invoke modular, composable skills.
 */

import type { SkillDefinition, SkillInput, SkillOutput } from "../types.js";

/**
 * Central registry for all skills available to Smartclaw.
 */
export class SkillsRegistry {
  private skills = new Map<string, SkillDefinition>();

  /** Register a new skill. Throws if a skill with the same name exists. */
  register(skill: SkillDefinition): void {
    if (this.skills.has(skill.name)) {
      throw new Error(`Skill "${skill.name}" is already registered`);
    }
    this.skills.set(skill.name, skill);
  }

  /** Unregister a skill by name. */
  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  /** Get a skill definition by name. */
  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  /** Check whether a skill is registered. */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /** List all registered skill names. */
  list(): string[] {
    return [...this.skills.keys()];
  }

  /** Find skills that match a given domain. */
  findByDomain(domain: string): SkillDefinition[] {
    return [...this.skills.values()].filter((s) => s.domain === domain);
  }

  /**
   * Execute a skill by name.
   *
   * @throws If the skill is not registered
   */
  async execute(name: string, input: SkillInput): Promise<SkillOutput> {
    const skill = this.skills.get(name);
    if (!skill) {
      throw new Error(`Skill "${name}" not found`);
    }
    return skill.execute(input);
  }

  /** Number of registered skills. */
  get size(): number {
    return this.skills.size;
  }
}
