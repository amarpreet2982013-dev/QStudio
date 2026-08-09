export interface Diagnostic { severity: "error" | "warning" | "info"; message: string; line: number; column: number; }
export interface CircuitModel { name: string; qubits: number; operations: Array<{ gate: string; targets: number[]; moment: number }>; }
export interface SilqCompiler { parse(source: string): Promise<unknown>; compile(source: string): Promise<Uint8Array>; diagnostics(source: string): Promise<Diagnostic[]>; generateCircuit(source: string): Promise<CircuitModel>; }
export type HardwareVendor = "ibm-quantum" | "google-quantum-ai" | "ionq" | "quantinuum" | "rigetti";
export interface HardwareBackend { id: string; vendor: HardwareVendor; execute(compiled: Uint8Array): Promise<{ jobId: string }>; status(jobId: string): Promise<unknown>; cancel(jobId: string): Promise<void>; }
export interface CloudExecution { submit(source: string): Promise<string>; result(jobId: string): Promise<unknown>; }
export interface AIProvider { complete(request: { prompt: string; context?: string }): Promise<string>; }
