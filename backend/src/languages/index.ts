import { LanguageRegistry } from "./LanguageRegistry";
import { SilqLanguageAdapter } from "./SilqLanguageAdapter";
import { OpenQasm3LanguageAdapter } from "./openqasm3/OpenQasm3LanguageAdapter";
import { QSharpLanguageAdapter } from "./qsharp/QSharpLanguageAdapter";
import { QuilLanguageAdapter } from "./quil/QuilLanguageAdapter";
import { OpenQasm2LanguageAdapter } from "./openqasm2/OpenQasm2LanguageAdapter";

export * from "./types";
export * from "./LanguageRegistry";
export * from "./SilqLanguageAdapter";
export * from "./openqasm3/OpenQasm3LanguageAdapter";
export * from "./openqasm3/OpenQasm3Parser";
export * from "./qsharp/QSharpLanguageAdapter";
export * from "./qsharp/QSharpParser";
export * from "./quil/QuilLanguageAdapter";
export * from "./quil/QuilParser";
export * from "./openqasm2/OpenQasm2LanguageAdapter";
export * from "./openqasm2/OpenQasm2Parser";

export function createDefaultLanguageRegistry(): LanguageRegistry {
  const registry = new LanguageRegistry();
  registry.register(new SilqLanguageAdapter());
  registry.register(new OpenQasm3LanguageAdapter());
  registry.register(new QSharpLanguageAdapter());
  registry.register(new QuilLanguageAdapter());
  registry.register(new OpenQasm2LanguageAdapter());
  return registry;
}

export const defaultLanguageRegistry = createDefaultLanguageRegistry();
