"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultFrameworkBridge = exports.QuantumFrameworkBridge = exports.BRIDGE_FORCE_KILL_DELAY_MS = exports.BRIDGE_MAX_STDERR_BYTES = exports.BRIDGE_MAX_STDOUT_BYTES = exports.BRIDGE_MAX_RESULT_BYTES = exports.BRIDGE_MAX_REQUEST_BYTES = void 0;
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const TerminalGuard_1 = require("../security/TerminalGuard");
exports.BRIDGE_MAX_REQUEST_BYTES = 4 * 1024 * 1024;
exports.BRIDGE_MAX_RESULT_BYTES = 4 * 1024 * 1024;
exports.BRIDGE_MAX_STDOUT_BYTES = 4 * 1024 * 1024;
exports.BRIDGE_MAX_STDERR_BYTES = 64 * 1024;
exports.BRIDGE_FORCE_KILL_DELAY_MS = 2_000;
const BRIDGE_MAX_REQUEST_NODES = 200_000;
const MAX_SIMULATION_SEED = 0xFFFFFFFF;
function validateSimulationSeed(seed) {
    if (seed !== undefined && (!Number.isInteger(seed) || seed < 0 || seed > MAX_SIMULATION_SEED)) {
        throw new Error(`Seed must be an unsigned 32-bit integer between 0 and ${MAX_SIMULATION_SEED}.`);
    }
}
function estimateJsonRequestBytes(value, limit) {
    const pending = [value];
    let bytes = 0;
    let nodes = 0;
    while (pending.length > 0) {
        const item = pending.pop();
        nodes++;
        if (nodes > BRIDGE_MAX_REQUEST_NODES)
            return limit + 1;
        if (typeof item === "string") {
            bytes += Buffer.byteLength(item, "utf8") + 2;
        }
        else if (typeof item === "number" || typeof item === "boolean" || item === null) {
            bytes += 24;
        }
        else if (Array.isArray(item)) {
            if (item.length > limit)
                return limit + 1;
            bytes += item.length + 2;
            for (const entry of item)
                pending.push(entry);
        }
        else if (typeof item === "object") {
            const entries = Object.entries(item);
            if (entries.length > limit)
                return limit + 1;
            bytes += entries.length + 2;
            for (const [key, entry] of entries) {
                bytes += Buffer.byteLength(key, "utf8") + 3;
                pending.push(entry);
            }
        }
        if (bytes > limit)
            return limit + 1;
    }
    return bytes;
}
class QuantumFrameworkBridge {
    scriptPath;
    defaultTimeoutMs;
    pythonExecutable;
    constructor(options) {
        this.scriptPath = node_path_1.default.resolve(__dirname, "../../python/qstudio_bridge.py");
        this.defaultTimeoutMs = options?.timeoutMs ?? 20_000;
        this.pythonExecutable = options?.pythonPath ?? "python3";
    }
    setPythonExecutable(executable) {
        this.pythonExecutable = executable;
    }
    /**
     * Execute an arbitrary bridge command with typed payload.
     */
    async executeCommand(command, payload = {}) {
        return new Promise((resolve, reject) => {
            if (estimateJsonRequestBytes(payload, exports.BRIDGE_MAX_REQUEST_BYTES) > exports.BRIDGE_MAX_REQUEST_BYTES) {
                reject(new Error(`Quantum framework request exceeds the ${exports.BRIDGE_MAX_REQUEST_BYTES}-byte or ${BRIDGE_MAX_REQUEST_NODES}-node limit.`));
                return;
            }
            const request = JSON.stringify(payload);
            const requestBytes = Buffer.byteLength(request, "utf8");
            if (requestBytes > exports.BRIDGE_MAX_REQUEST_BYTES) {
                reject(new Error(`Quantum framework request is ${requestBytes} bytes; maximum allowed size is ${exports.BRIDGE_MAX_REQUEST_BYTES} bytes.`));
                return;
            }
            let settled = false;
            const cleanEnv = (0, TerminalGuard_1.sanitizeEnvironment)();
            const args = [this.scriptPath, command];
            const child = (0, node_child_process_1.spawn)(this.pythonExecutable, args, {
                env: cleanEnv,
                shell: false,
            });
            const stdout = [];
            const stderr = [];
            let stdoutBytes = 0;
            let stderrBytes = 0;
            let forceKillTimer;
            const cleanup = () => {
                clearTimeout(timeoutTimer);
                if (forceKillTimer)
                    clearTimeout(forceKillTimer);
            };
            const terminate = () => {
                child.kill("SIGTERM");
                forceKillTimer = setTimeout(() => child.kill("SIGKILL"), exports.BRIDGE_FORCE_KILL_DELAY_MS);
            };
            const fail = (error) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                terminate();
                reject(error);
            };
            const timeoutTimer = setTimeout(() => {
                fail(new Error(`Quantum framework operation '${command}' timed out after ${this.defaultTimeoutMs}ms.`));
            }, this.defaultTimeoutMs);
            child.stdout.on("data", (chunk) => {
                stdoutBytes += chunk.length;
                if (stdoutBytes > exports.BRIDGE_MAX_RESULT_BYTES) {
                    fail(new Error(`Quantum framework operation '${command}' exceeded the ${exports.BRIDGE_MAX_RESULT_BYTES}-byte result limit.`));
                    return;
                }
                stdout.push(chunk);
            });
            child.stderr.on("data", (chunk) => {
                stderrBytes += chunk.length;
                if (stderrBytes > exports.BRIDGE_MAX_STDERR_BYTES) {
                    fail(new Error(`Quantum framework operation '${command}' exceeded the ${exports.BRIDGE_MAX_STDERR_BYTES}-byte stderr limit.`));
                    return;
                }
                stderr.push(chunk);
            });
            child.on("error", (err) => {
                if (settled)
                    return;
                settled = true;
                cleanup();
                reject(new Error(`Failed to launch Python quantum bridge: ${err.message}`));
            });
            child.on("close", (code) => {
                cleanup();
                if (settled)
                    return;
                settled = true;
                const stdoutText = Buffer.concat(stdout).toString("utf8");
                const stderrText = Buffer.concat(stderr).toString("utf8");
                if (code !== 0 && !stdoutText.trim()) {
                    reject(new Error(`Python bridge process exited with code ${code}. Error: ${stderrText.trim()}`));
                    return;
                }
                try {
                    const parsed = JSON.parse(stdoutText.trim());
                    if (!parsed.success) {
                        reject(new Error(parsed.error || `Command '${command}' returned an error.`));
                        return;
                    }
                    resolve(parsed.data);
                }
                catch (parseError) {
                    reject(new Error(`Failed to parse response from quantum bridge: ${parseError instanceof Error ? parseError.message : String(parseError)}\nRaw output: ${stdoutText}`));
                }
            });
            child.stdin.on("error", (error) => {
                if (!settled && error.code !== "EPIPE") {
                    fail(new Error(`Failed to send request to Python quantum bridge: ${error.message}`));
                }
            });
            child.stdin.end(request);
        });
    }
    /**
     * Probe the Python runtime and all quantum frameworks.
     */
    async probe() {
        try {
            return await this.executeCommand("probe");
        }
        catch (error) {
            return {
                python: {
                    available: false,
                    error: error instanceof Error ? error.message : String(error),
                },
                frameworks: {
                    native: {
                        id: "native",
                        name: "QStudio State-Vector Simulator",
                        category: "simulator",
                        available: true,
                        version: "1.0.0 (Built-in)",
                        description: "Seedable local state-vector simulation with ordered mid-circuit measurement and per-shot classical feed-forward.",
                        docsUrl: "https://github.com/silq-studio",
                        capabilities: [
                            "Exact complex state-vector (1-12 qubits)",
                            "Born probabilities",
                            "Bloch vectors",
                            "Mid-circuit measurement with per-shot classical storage",
                            "Conditional H, X, and Z operations",
                        ],
                        limitations: [
                            "Limited to 12 qubits in renderer context",
                            "Dynamic trajectories are limited to 4,096 shots and 256 classical bits",
                            "The step debugger does not replay dynamic per-shot trajectories",
                        ],
                    },
                    cirq: {
                        id: "cirq",
                        name: "Google Cirq",
                        category: "simulator",
                        available: false,
                        description: "Google Cirq executes gate and reset segments; QStudio manages ordered measurement collapse and classical feed-forward per shot.",
                        docsUrl: "https://quantumai.google/cirq",
                        capabilities: [
                            "Cirq simulation",
                            "Import/Export",
                            "QStudio-managed mid-circuit measurement and conditional H, X, and Z",
                        ],
                        limitations: [
                            "Requires Python environment",
                            "Dynamic control is managed by QStudio between Cirq simulation segments",
                        ],
                        error: "Python bridge unavailable",
                    },
                    qsim: {
                        id: "qsim",
                        name: "Google qsim (qsimcirq)",
                        category: "simulator",
                        available: false,
                        description: "Google qsim executes gate and reset segments through qsimcirq; QStudio manages dynamic trajectories between segments.",
                        docsUrl: "https://quantumai.google/qsim",
                        capabilities: [
                            "High performance simulation",
                            "QStudio-managed mid-circuit measurement and conditional H, X, and Z",
                        ],
                        limitations: [
                            "Requires AVX/NEON and Python",
                            "QStudio bridge limits simulations to 12 qubits",
                            "Dynamic control is managed by QStudio between qsim simulation segments",
                        ],
                        error: "Python bridge unavailable",
                    },
                    qualtran: {
                        id: "qualtran",
                        name: "Google Qualtran",
                        category: "resource_estimation",
                        available: false,
                        description: "Quantum algorithm representation and fault-tolerant resource estimation.",
                        docsUrl: "https://quantumai.google/qualtran",
                        capabilities: ["T-count estimation", "Surface code modeling"],
                        limitations: ["Requires Python"],
                        error: "Python bridge unavailable",
                    },
                    openfermion: {
                        id: "openfermion",
                        name: "Google OpenFermion",
                        category: "chemistry",
                        available: false,
                        description: "Quantum algorithms for quantum chemistry and materials science.",
                        docsUrl: "https://quantumai.google/openfermion",
                        capabilities: ["Fermionic Hamiltonian representation", "Jordan-Wigner transformation"],
                        limitations: ["Requires Python"],
                        error: "Python bridge unavailable",
                    },
                    tensorflow_quantum: {
                        id: "tensorflow_quantum",
                        name: "TensorFlow Quantum (TFQ)",
                        category: "qml",
                        available: false,
                        description: "Quantum machine learning library for hybrid quantum-classical models.",
                        docsUrl: "https://www.tensorflow.org/quantum",
                        capabilities: ["Hybrid PQC neural networks"],
                        limitations: ["Requires Python <= 3.10 and TensorFlow 2.x"],
                        error: "Python bridge unavailable",
                    },
                },
            };
        }
    }
    /**
     * Run simulation using Google Cirq backend.
     */
    async simulateCirq(circuit, shots = 1024, seed) {
        validateSimulationSeed(seed);
        return this.executeCommand("cirq:simulate", {
            circuit,
            shots,
            ...(seed === undefined ? {} : { seed }),
        });
    }
    /**
     * Run simulation using Google qsim backend.
     */
    async simulateQsim(circuit, shots = 1024, seed) {
        validateSimulationSeed(seed);
        return this.executeCommand("qsim:simulate", {
            circuit,
            shots,
            ...(seed === undefined ? {} : { seed }),
        });
    }
    /**
     * Export circuit to Cirq Python source code.
     */
    async exportCirq(circuit) {
        return this.executeCommand("cirq:export", { circuit });
    }
    /**
     * Import Cirq Python code into canonical circuit model.
     */
    async importCirq(code) {
        return this.executeCommand("cirq:import", { code });
    }
    /**
     * Estimate quantum resources using Google Qualtran bloqs.
     */
    async estimateQualtran(request) {
        return this.executeCommand("qualtran:estimate", request);
    }
    /**
     * Generate molecular Hamiltonian and trotterized circuit via Google OpenFermion.
     */
    async openfermionHamiltonian(request) {
        return this.executeCommand("openfermion:hamiltonian", request);
    }
    /**
     * Probe TensorFlow Quantum compatibility.
     */
    async probeTfq() {
        return this.executeCommand("tfq:probe");
    }
}
exports.QuantumFrameworkBridge = QuantumFrameworkBridge;
exports.defaultFrameworkBridge = new QuantumFrameworkBridge();
