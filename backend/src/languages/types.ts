import type { CircuitModel, Diagnostic } from "../contracts";
import type { CompilationResult, QuantumIR } from "../compiler/types";

export interface LanguageCapabilities {
  gates: string[];
  measurement: boolean;
  reset: boolean;
  controlledGates: boolean;
  multiQubitGates: boolean;
}

export interface ExampleCode {
  id: string;
  name: string;
  description: string;
  code: string;
}

export interface QuantumLanguageAdapter {
  readonly id: string;
  readonly name: string;
  readonly extensions: string[];
  readonly monacoLanguageId: string;
  readonly capabilities: LanguageCapabilities;
  readonly examplePrograms?: ExampleCode[];

  compile(source: string): Promise<CompilationResult>;
  diagnostics(source: string): Promise<Diagnostic[]>;
  format?(source: string): string;
  generateCircuit?(source: string): Promise<CircuitModel>;
  generateIR?(source: string): Promise<QuantumIR>;
}

export interface LanguageDetectionResult {
  adapter: QuantumLanguageAdapter;
  confidence: number;
}
