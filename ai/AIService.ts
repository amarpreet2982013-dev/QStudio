import type { AIProvider } from "../backend/src/contracts";
export type AssistantAction = "explain" | "optimize" | "generate" | "fix" | "silq-to-qiskit" | "silq-to-openqasm" | "silq-to-qsharp" | "document" | "test";
const actions = new Set<AssistantAction>(["explain", "optimize", "generate", "fix", "silq-to-qiskit", "silq-to-openqasm", "silq-to-qsharp", "document", "test"]);
const MAX_AI_INPUT = 1_000_000;
export class AIService {
	constructor(private readonly provider: AIProvider) {}
	async execute(action: AssistantAction, source: string, diagnostics = ""): Promise<string> {
		if (!actions.has(action) || typeof source !== "string" || source.length > MAX_AI_INPUT || diagnostics.length > MAX_AI_INPUT) throw new Error("Invalid AI request.");
		return this.provider.complete({ prompt: instruction(action, diagnostics), context: source });
	}
}
function instruction(action: AssistantAction, diagnostics: string): string { const actions: Record<AssistantAction, string> = { explain: "Explain this Silq program precisely.", optimize: "Optimize this quantum circuit while preserving observable behavior.", generate: "Generate an idiomatic Silq quantum algorithm.", fix: `Fix these compiler diagnostics: ${diagnostics}`, "silq-to-qiskit": "Translate Silq to Qiskit Python.", "silq-to-openqasm": "Translate Silq to OpenQASM 3.", "silq-to-qsharp": "Translate Silq to Q#.", document: "Produce concise API documentation for this program.", test: "Generate focused tests for this Silq program." }; return actions[action]; }
