"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SilqCompiler = void 0;
const CircuitGenerator_1 = require("./CircuitGenerator");
const IRGenerator_1 = require("./IRGenerator");
const Lexer_1 = require("./Lexer");
const OpenQasmGenerator_1 = require("./OpenQasmGenerator");
const Parser_1 = require("./Parser");
const SemanticAnalyzer_1 = require("./SemanticAnalyzer");
class SilqCompiler {
    lexer;
    parser;
    analyzer;
    irGenerator;
    qasmGenerator;
    circuitGenerator;
    constructor(lexer = new Lexer_1.Lexer(), parser = new Parser_1.Parser(), analyzer = new SemanticAnalyzer_1.SemanticAnalyzer(), irGenerator = new IRGenerator_1.IRGenerator(), qasmGenerator = new OpenQasmGenerator_1.OpenQasmGenerator(), circuitGenerator = new CircuitGenerator_1.CircuitGenerator()) {
        this.lexer = lexer;
        this.parser = parser;
        this.analyzer = analyzer;
        this.irGenerator = irGenerator;
        this.qasmGenerator = qasmGenerator;
        this.circuitGenerator = circuitGenerator;
    }
    async analyze(source) { const tokens = this.lexer.tokenize(source); const parsed = this.parser.parse(tokens); const semantic = this.analyzer.analyze(parsed.ast); const generated = this.irGenerator.generate(parsed.ast, semantic); const diagnostics = [...parsed.diagnostics, ...semantic.diagnostics, ...generated.diagnostics]; return { tokens, ast: parsed.ast, semantic, ir: generated.ir, qasm: this.qasmGenerator.generate(generated.ir), circuit: this.circuitGenerator.generate(generated.ir), diagnostics }; }
    async parse(source) { return (await this.analyze(source)).ast; }
    async compile(source) { return new TextEncoder().encode((await this.analyze(source)).qasm); }
    async diagnostics(source) { return (await this.analyze(source)).diagnostics; }
    async generateCircuit(source) { return (await this.analyze(source)).circuit; }
}
exports.SilqCompiler = SilqCompiler;
