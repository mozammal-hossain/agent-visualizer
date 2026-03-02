import type { AgentProvider, ProviderContext } from './types.js';

/**
 * ProviderRegistry - Manages all LLM providers and their activation.
 */
export class ProviderRegistry {
  private providers = new Map<string, AgentProvider>();
  private activated = new Set<string>();

  register(provider: AgentProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregister(providerId: string): void {
    const p = this.providers.get(providerId);
    if (p && this.activated.has(providerId)) {
      p.deactivate();
      this.activated.delete(providerId);
    }
    this.providers.delete(providerId);
  }

  get(id: string): AgentProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): AgentProvider[] {
    return Array.from(this.providers.values());
  }

  getLaunchable(): AgentProvider[] {
    return this.getAll().filter((p) => p.canLaunch());
  }

  async activateAll(context: ProviderContext): Promise<void> {
    for (const provider of this.providers.values()) {
      if (this.activated.has(provider.id)) continue;
      try {
        await provider.activate(context);
        this.activated.add(provider.id);
      } catch (err) {
        console.error(`[Agent Visualizer] Failed to activate provider ${provider.id}:`, err);
      }
    }
  }

  deactivateAll(): void {
    for (const id of this.activated) {
      const p = this.providers.get(id);
      if (p) p.deactivate();
    }
    this.activated.clear();
  }
}
