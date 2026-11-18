"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectIndexer = void 0;
const node_path_1 = __importDefault(require("node:path"));
const SilqCompiler_1 = require("./compiler/SilqCompiler");
class ProjectIndexer {
    compiler;
    files = new Map();
    symbols = new Map();
    constructor(compiler = new SilqCompiler_1.SilqCompiler()) {
        this.compiler = compiler;
    }
    async indexFile(file, source) { this.removeFile(file); this.files.set(file, source); const analysis = await this.compiler.analyze(source); for (const [name, symbol] of analysis.semantic.symbols) {
        const entry = { name, kind: symbol.kind, file, line: symbol.range.line, column: symbol.range.column, references: symbol.references.map((reference) => ({ file, line: reference.line, column: reference.column })) };
        this.symbols.set(name, [...(this.symbols.get(name) ?? []), entry]);
    } }
    removeFile(file) { this.files.delete(file); for (const [name, items] of this.symbols) {
        const remaining = items.filter((item) => item.file !== file);
        if (remaining.length)
            this.symbols.set(name, remaining);
        else
            this.symbols.delete(name);
    } }
    workspaceSymbols(query = "") { return [...this.symbols.values()].flat().filter((symbol) => symbol.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name)); }
    findReferences(name) { return this.symbols.get(name) ?? []; }
    search(query) { const results = []; for (const [file, source] of this.files)
        source.split("\n").forEach((line, index) => { if (line.toLowerCase().includes(query.toLowerCase()))
            results.push({ file, line: index + 1, preview: line.trim() }); }); return results; }
    relativePath(root, file) { return node_path_1.default.relative(root, file); }
}
exports.ProjectIndexer = ProjectIndexer;
