export interface ExtensionApi { commands: { register(id: string, handler: () => void): void }; languages: { register(id: string): void }; themes: { register(id: string, definition: unknown): void }; snippets: { register(language: string, snippets: Record<string, string>): void }; panels: { register(id: string, title: string): void }; debuggers: { register(id: string, factory: unknown): void }; simulators: { register(id: string, factory: unknown): void }; hardwareProviders: { register(id: string, provider: unknown): void }; }
export interface SilqExtension { activate(api: ExtensionApi): void | Promise<void>; deactivate?(): void | Promise<void>; }

export class ExtensionHost implements ExtensionApi {
  readonly registered = { commands: new Map<string, () => void>(), languages: new Set<string>(), themes: new Map<string, unknown>(), snippets: new Map<string, Record<string, string>>(), panels: new Map<string, string>(), debuggers: new Map<string, unknown>(), simulators: new Map<string, unknown>(), hardwareProviders: new Map<string, unknown>() };
  commands = { register: (id: string, handler: () => void) => this.registered.commands.set(id, handler) };
  languages = { register: (id: string) => this.registered.languages.add(id) };
  themes = { register: (id: string, definition: unknown) => this.registered.themes.set(id, definition) };
  snippets = { register: (language: string, snippets: Record<string, string>) => this.registered.snippets.set(language, snippets) };
  panels = { register: (id: string, title: string) => this.registered.panels.set(id, title) };
  debuggers = { register: (id: string, factory: unknown) => this.registered.debuggers.set(id, factory) };
  simulators = { register: (id: string, factory: unknown) => this.registered.simulators.set(id, factory) };
  hardwareProviders = { register: (id: string, provider: unknown) => this.registered.hardwareProviders.set(id, provider) };
  async load(extension: SilqExtension): Promise<void> { await extension.activate(this); }
}
