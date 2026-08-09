import type { CircuitModel, Diagnostic } from "../contracts";

export type TokenKind = "keyword" | "identifier" | "number" | "string" | "symbol" | "comment" | "eof";
export interface Token { kind: TokenKind; value: string; start: number; end: number; line: number; column: number; }
export interface Range { start: number; end: number; line: number; column: number; }
export interface ProgramNode { kind: "Program"; body: StatementNode[]; range: Range; }
export type StatementNode = FunctionNode | QubitDeclarationNode | GateNode | ReturnNode | VariableNode;
export interface BaseNode { kind: string; range: Range; }
export interface FunctionNode extends BaseNode { kind: "Function"; name: string; body: StatementNode[]; }
export interface QubitDeclarationNode extends BaseNode { kind: "QubitDeclaration"; name: string; size: number; }
export interface GateNode extends BaseNode { kind: "Gate"; gate: string; targets: QubitRef[]; controls: QubitRef[]; }
export interface QubitRef { name: string; index: number; range: Range; }
export interface ReturnNode extends BaseNode { kind: "Return"; }
export interface VariableNode extends BaseNode { kind: "Variable"; name: string; }
export interface SemanticModel { symbols: Map<string, { kind: "function" | "qubit" | "variable"; range: Range; references: Range[] }>; diagnostics: Diagnostic[]; }
export interface IROperation { opcode: "h" | "x" | "y" | "z" | "s" | "t" | "cx" | "cz" | "swap" | "measure" | "reset"; targets: number[]; controls: number[]; source: Range; }
export interface QuantumIR { qubits: number; operations: IROperation[]; }
export interface CompilationResult { tokens: Token[]; ast: ProgramNode; semantic: SemanticModel; ir: QuantumIR; qasm: string; circuit: CircuitModel; diagnostics: Diagnostic[]; }
