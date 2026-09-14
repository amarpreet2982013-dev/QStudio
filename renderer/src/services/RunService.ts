import type { CompilationResult } from "../../../backend/src/compiler/types";
import type { QuantumLanguageAdapter } from "../../../backend/src/languages/types";
import { StateVectorSimulator, type StateVectorResult } from "../../../simulator/StateVectorSimulator";

export interface RunResult {
  compilation: CompilationResult;
  simulation?: StateVectorResult;
}

export async function compileAndSimulate(
  adapter: QuantumLanguageAdapter,
  source: string,
  shots: number,
  simulator = new StateVectorSimulator()
): Promise<RunResult> {
  const compilation = await adapter.compile(source);
  if (compilation.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { compilation };
  }

  return { compilation, simulation: await simulator.runIR(compilation.ir, shots) };
}