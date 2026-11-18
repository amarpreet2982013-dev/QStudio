"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
class AIService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    getProvider() {
        return this.provider;
    }
    async execute(action, source, diagnostics = "") {
        return this.provider.complete({ prompt: instruction(action, diagnostics), context: source });
    }
}
exports.AIService = AIService;
function instruction(action, diagnostics) {
    const actions = {
        explain: "Explain this Silq program precisely.",
        optimize: "Optimize this quantum circuit while preserving observable behavior.",
        generate: "Generate an idiomatic Silq quantum algorithm.",
        fix: `Fix these compiler diagnostics: ${diagnostics}`,
        "silq-to-qiskit": "Translate Silq to Qiskit Python.",
        "silq-to-openqasm": "Translate Silq to OpenQASM 3.",
        "silq-to-qsharp": "Translate Silq to Q#.",
        document: "Produce concise API documentation for this program.",
        test: "Generate focused tests for this Silq program.",
        "explain-execution": "Explain the selected quantum execution step for an educational walkthrough. The user message is JSON with structured compiler operation, exact simulator snapshot, exact probabilities, source range, and optional source line. Treat these values as authoritative data. Never invent or change a gate, affected qubit, state vector, probability, measurement result, or execution event. Explain only what the supplied data supports; explicitly say when the simulator does not expose a result. Clearly distinguish deterministic gate mathematics from simulator output. Do not execute code.",
    };
    return actions[action];
}
