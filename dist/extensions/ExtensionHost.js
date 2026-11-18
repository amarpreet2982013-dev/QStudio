"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionHost = exports.ExtensionPermissionError = void 0;
class ExtensionPermissionError extends Error {
    constructor(extensionId, capability) {
        super(`Permission denied: extension '${extensionId}' requested capability '${capability}', which is not declared in its manifest permissions.`);
        this.name = "ExtensionPermissionError";
    }
}
exports.ExtensionPermissionError = ExtensionPermissionError;
/**
 * ExtensionHost manages registration and capability grants for IDE extensions.
 *
 * ARCHITECTURAL LIMITATION NOTICE:
 * QStudio extensions currently execute within the host JavaScript execution environment.
 * The permission model below enforces API-level capability checks and restricts IDE feature
 * registration to explicitly declared capabilities. However, because extensions share the runtime
 * thread, full VM/isolate sandboxing (e.g. V8 isolates or out-of-process workers) is not yet implemented.
 * Extensions should only be installed from trusted sources.
 */
class ExtensionHost {
    registered = {
        commands: new Map(),
        languages: new Set(),
        themes: new Map(),
        snippets: new Map(),
        panels: new Map(),
        debuggers: new Map(),
        simulators: new Map(),
        hardwareProviders: new Map(),
    };
    commands = {
        register: (id, handler) => {
            this.registered.commands.set(id, handler);
        },
    };
    languages = {
        register: (id) => {
            this.registered.languages.add(id);
        },
    };
    themes = {
        register: (id, definition) => {
            this.registered.themes.set(id, definition);
        },
    };
    snippets = {
        register: (language, snippets) => {
            this.registered.snippets.set(language, snippets);
        },
    };
    panels = {
        register: (id, title) => {
            this.registered.panels.set(id, title);
        },
    };
    debuggers = {
        register: (id, factory) => {
            this.registered.debuggers.set(id, factory);
        },
    };
    simulators = {
        register: (id, factory) => {
            this.registered.simulators.set(id, factory);
        },
    };
    hardwareProviders = {
        register: (id, provider) => {
            this.registered.hardwareProviders.set(id, provider);
        },
    };
    /**
     * Creates a scoped ExtensionApi wrapper for an extension based on its declared permissions.
     */
    createScopedApi(manifest) {
        const extensionId = manifest?.id ?? "anonymous";
        const allowed = new Set(manifest?.permissions ?? []);
        const requireCapability = (cap) => {
            if (!allowed.has(cap)) {
                throw new ExtensionPermissionError(extensionId, cap);
            }
        };
        return {
            commands: {
                register: (id, handler) => {
                    requireCapability("commands");
                    this.commands.register(id, handler);
                },
            },
            languages: {
                register: (id) => {
                    requireCapability("languages");
                    this.languages.register(id);
                },
            },
            themes: {
                register: (id, definition) => {
                    requireCapability("themes");
                    this.themes.register(id, definition);
                },
            },
            snippets: {
                register: (language, snippets) => {
                    requireCapability("snippets");
                    this.snippets.register(language, snippets);
                },
            },
            panels: {
                register: (id, title) => {
                    requireCapability("panels");
                    this.panels.register(id, title);
                },
            },
            debuggers: {
                register: (id, factory) => {
                    requireCapability("debuggers");
                    this.debuggers.register(id, factory);
                },
            },
            simulators: {
                register: (id, factory) => {
                    requireCapability("simulators");
                    this.simulators.register(id, factory);
                },
            },
            hardwareProviders: {
                register: (id, provider) => {
                    requireCapability("hardwareProviders");
                    this.hardwareProviders.register(id, provider);
                },
            },
        };
    }
    async load(extension, manifest) {
        const scopedApi = this.createScopedApi(manifest);
        await extension.activate(scopedApi);
    }
}
exports.ExtensionHost = ExtensionHost;
