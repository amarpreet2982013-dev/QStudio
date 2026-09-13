import type { QuantumLanguageAdapter } from "./types";

export class LanguageRegistry {
  private readonly adapters = new Map<string, QuantumLanguageAdapter>();
  private readonly extensionMap = new Map<string, string[]>();

  register(adapter: QuantumLanguageAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`Quantum language adapter '${adapter.id}' is already registered.`);
    }
    this.adapters.set(adapter.id, adapter);

    for (const ext of adapter.extensions) {
      const normalizedExt = ext.startsWith(".") ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
      const existing = this.extensionMap.get(normalizedExt) ?? [];
      if (!existing.includes(adapter.id)) {
        existing.push(adapter.id);
        this.extensionMap.set(normalizedExt, existing);
      }
    }
  }

  get(id: string): QuantumLanguageAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): QuantumLanguageAdapter[] {
    return Array.from(this.adapters.values());
  }

  has(id: string): boolean {
    return this.adapters.has(id);
  }

  detectByExtension(filenameOrExt: string): QuantumLanguageAdapter | undefined {
    const ext = filenameOrExt.includes(".")
      ? filenameOrExt.slice(filenameOrExt.lastIndexOf(".")).toLowerCase()
      : `.${filenameOrExt.toLowerCase()}`;

    const matchingIds = this.extensionMap.get(ext);
    if (!matchingIds || matchingIds.length === 0) return undefined;
    return this.adapters.get(matchingIds[0]);
  }

  detectByContent(source: string): QuantumLanguageAdapter | undefined {
    const trimmed = source.trim();

    // Check OpenQASM 2.0 first
    if (/^\s*OPENQASM\s+2(\.0)?\s*;/i.test(trimmed)) {
      return this.adapters.get("openqasm2");
    }

    // Check OpenQASM 3.0
    if (/^\s*OPENQASM\s+3(\.0)?\s*;/i.test(trimmed) || /^\s*(qubit|bit)\[\d+\]/m.test(trimmed)) {
      return this.adapters.get("openqasm3");
    }

    // Check Quil
    if (/^\s*DECLARE\s+[A-Za-z_]\w*\s+(BIT|REAL|OCTET)/i.test(trimmed) || /^\s*(H|CNOT|CZ|SWAP|MEASURE|RESET)\s+\d+/m.test(trimmed)) {
      return this.adapters.get("quil");
    }

    // Check Microsoft Q#
    if (/^\s*namespace\b/m.test(trimmed) || /^\s*operation\b/m.test(trimmed) || /^\s*open\s+Microsoft\.Quantum/m.test(trimmed) || /use\s+[a-zA-Z_]\w*\s*=\s*Qubit/m.test(trimmed)) {
      return this.adapters.get("qsharp");
    }

    // Check Silq
    if (/^\s*fn\b/m.test(trimmed) || /new\s+Qubit\[/m.test(trimmed) || /\.controlled\(/m.test(trimmed)) {
      return this.adapters.get("silq");
    }

    return undefined;
  }

  detect(filenameOrExt?: string, source?: string): QuantumLanguageAdapter {
    if (source) {
      const byContent = this.detectByContent(source);
      if (byContent) return byContent;
    }

    if (filenameOrExt) {
      const byExt = this.detectByExtension(filenameOrExt);
      if (byExt) return byExt;
    }

    // Default fallback to Silq
    return this.adapters.get("silq") ?? this.list()[0];
  }
}
