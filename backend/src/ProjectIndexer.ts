import path from "node:path";
import { SilqCompiler } from "./compiler/SilqCompiler";

export interface IndexedSymbol { name: string; kind: string; file: string; line: number; column: number; references: Array<{ file: string; line: number; column: number }>; }
export class ProjectIndexer {
  private readonly files = new Map<string, string>(); private readonly symbols = new Map<string, IndexedSymbol[]>();
  constructor(private readonly compiler = new SilqCompiler()) {}
  async indexFile(file: string, source: string): Promise<void> { this.removeFile(file); this.files.set(file, source); const analysis = await this.compiler.analyze(source); for (const [name, symbol] of analysis.semantic.symbols) { const entry: IndexedSymbol = { name, kind: symbol.kind, file, line: symbol.range.line, column: symbol.range.column, references: symbol.references.map((reference) => ({ file, line: reference.line, column: reference.column })) }; this.symbols.set(name, [...(this.symbols.get(name) ?? []), entry]); } }
  removeFile(file: string): void { this.files.delete(file); for (const [name, items] of this.symbols) { const remaining = items.filter((item) => item.file !== file); if (remaining.length) this.symbols.set(name, remaining); else this.symbols.delete(name); } }
  workspaceSymbols(query = ""): IndexedSymbol[] { return [...this.symbols.values()].flat().filter((symbol) => symbol.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)); }
  findReferences(name: string): IndexedSymbol[] { return this.symbols.get(name) ?? []; }
  search(query: string): Array<{ file: string; line: number; preview: string }> { const results: Array<{ file: string; line: number; preview: string }> = []; for (const [file, source] of this.files) source.split("\n").forEach((line, index) => { if (line.toLowerCase().includes(query.toLowerCase())) results.push({ file, line: index + 1, preview: line.trim() }); }); return results; }
  relativePath(root: string, file: string): string { return path.relative(root, file); }
}
