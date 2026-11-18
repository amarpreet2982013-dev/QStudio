"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qsimAdapter = exports.QsimAdapter = void 0;
const QuantumFrameworkBridge_1 = require("./QuantumFrameworkBridge");
const StateVectorSimulator_1 = require("../../../simulator/StateVectorSimulator");
const CircuitGenerator_1 = require("../compiler/CircuitGenerator");
class QsimAdapter {
    bridge;
    nativeSimulator = new StateVectorSimulator_1.StateVectorSimulator();
    constructor(bridge = QuantumFrameworkBridge_1.defaultFrameworkBridge) {
        this.bridge = bridge;
    }
    /**
     * Run simulation using Google qsim backend if available.
     */
    async simulate(circuit, shots = 1024, seed) {
        return this.bridge.simulateQsim(circuit, shots, seed);
    }
    /**
     * Benchmark and compare execution between Native simulator, Cirq, and qsim.
     */
    async benchmark(circuit, shots = 1024) {
        // 1. Run Native Simulator
        const t0 = performance.now();
        const nativeRes = await this.nativeSimulator.runIR((0, CircuitGenerator_1.circuitModelToIR)(circuit), shots);
        const nativeTime = performance.now() - t0;
        // 2. Try qsim
        try {
            const qsimRes = await this.bridge.simulateQsim(circuit, shots);
            const fidelity = this.computeFidelity(nativeRes.probabilities, qsimRes.probabilities);
            const speedup = nativeTime > 0 && qsimRes.elapsedMs > 0 ? Number((nativeTime / qsimRes.elapsedMs).toFixed(2)) : 1.0;
            return {
                circuitName: circuit.name || "Circuit Benchmark",
                qubits: circuit.qubits,
                shots,
                nativeElapsedMs: Math.round(nativeTime),
                qsimElapsedMs: Math.round(qsimRes.elapsedMs),
                speedupRatio: speedup,
                fidelityVsNative: fidelity,
                backendUsed: "Google qsim (qsimcirq)",
            };
        }
        catch (qsimError) {
            const qsimUnavailable = qsimError instanceof Error && qsimError.message.includes("qsimcirq is not installed");
            if (!qsimUnavailable)
                throw qsimError;
            // If qsim is unavailable, compare with Cirq or report native baseline.
            try {
                const cirqRes = await this.bridge.simulateCirq(circuit, shots);
                const fidelity = this.computeFidelity(nativeRes.probabilities, cirqRes.probabilities);
                return {
                    circuitName: circuit.name || "Circuit Benchmark",
                    qubits: circuit.qubits,
                    shots,
                    nativeElapsedMs: Math.round(nativeTime),
                    cirqElapsedMs: Math.round(cirqRes.elapsedMs),
                    fidelityVsNative: fidelity,
                    backendUsed: "Google Cirq (qsim unavailable)",
                };
            }
            catch (cirqError) {
                const cirqUnavailable = cirqError instanceof Error && cirqError.message.includes("Cirq is not installed");
                if (!cirqUnavailable)
                    throw cirqError;
                return {
                    circuitName: circuit.name || "Circuit Benchmark",
                    qubits: circuit.qubits,
                    shots,
                    nativeElapsedMs: Math.round(nativeTime),
                    fidelityVsNative: 1.0,
                    backendUsed: "QStudio Native Simulator",
                };
            }
        }
    }
    /**
     * Classical Bhattacharyya coefficient / statistical fidelity between two probability distributions
     * F(P, Q) = (sum sqrt(P_i * Q_i))^2
     */
    computeFidelity(p, q) {
        const allKeys = new Set([...Object.keys(p), ...Object.keys(q)]);
        let sum = 0;
        for (const key of allKeys) {
            const valP = p[key] ?? 0;
            const valQ = q[key] ?? 0;
            sum += Math.sqrt(valP * valQ);
        }
        return Math.min(1.0, Math.max(0.0, Number((sum ** 2).toFixed(6))));
    }
}
exports.QsimAdapter = QsimAdapter;
exports.qsimAdapter = new QsimAdapter();
