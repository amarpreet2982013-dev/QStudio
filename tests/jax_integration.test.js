"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

const {
    defaultFrameworkBridge,
    jaxAdapter,
    tfqAdapter,
    cirqAdapter,
    qsimAdapter,
} = require("../dist/backend/src/frameworks");
const { StateVectorSimulator } = require("../dist/simulator/StateVectorSimulator");
const { QuantumDebugger } = require("../dist/simulator/QuantumDebugger");
const { SilqCompiler } = require("../dist/backend/src/compiler/SilqCompiler");
const { circuitModelToIR } = require("../dist/backend/src/compiler/CircuitGenerator");

test("QuantumFrameworkBridge.probe detects JAX Quantum and Python runtime", async () => {
    const probe = await defaultFrameworkBridge.probe();
    assert.equal(probe.python.available, true);
    assert.equal(probe.frameworks.jax_quantum.available, true);
    assert.ok(probe.frameworks.jax_quantum.version);
    assert.ok(Array.isArray(probe.frameworks.jax_quantum.devices));
    assert.ok(probe.frameworks.jax_quantum.devices.length >= 1);
    assert.equal(probe.frameworks.tensorflow_quantum.available, false);
});

test("JaxQuantumAdapter.simulate matches native StateVectorSimulator on Bell state", async () => {
    const bellCircuit = {
        name: "Bell State",
        qubits: 2,
        operations: [
            { gate: "H", targets: [0] },
            { gate: "CX", targets: [0, 1] },
        ],
    };

    const nativeSim = new StateVectorSimulator();
    const nativeRes = await nativeSim.runIR(circuitModelToIR(bellCircuit), 1024);
    const jaxRes = await jaxAdapter.simulate(bellCircuit, 1024, 42);

    assert.equal(jaxRes.backend, "jax_quantum");
    assert.equal(jaxRes.executionMode, "unitary");
    assert.equal(jaxRes.probabilities.length, 4);
    for (let i = 0; i < 4; i++) {
        const bitstr = i.toString(2).padStart(2, "0");
        const nativeProb = nativeRes.probabilities[bitstr] ?? 0;
        assert.ok(
            Math.abs(nativeProb - jaxRes.probabilities[i]) < 1e-9,
            `Probability mismatch at ${bitstr}: ${nativeProb} vs ${jaxRes.probabilities[i]}`
        );
    }
});

test("JaxQuantumAdapter.simulate supports mid-circuit RESET trajectory", async () => {
    const resetCircuit = {
        name: "Reset Circuit",
        qubits: 1,
        operations: [
            { gate: "H", targets: [0] },
            { gate: "RESET", targets: [0] },
        ],
    };
    const jaxRes = await jaxAdapter.simulate(resetCircuit, 128, 7);
    assert.equal(jaxRes.executionMode, "trajectory");
    assert.equal(jaxRes.probabilitiesAreEmpirical, true);
    assert.deepEqual(jaxRes.counts, { "0": 128 });
});

test("JaxQuantumAdapter.gradient computes exact analytic gradient", async () => {
    const pqc = {
        name: "RY PQC",
        qubits: 1,
        operations: [{ gate: "RY", targets: [0], paramIndex: 0 }],
    };
    const theta = Math.PI / 4;
    const res = await jaxAdapter.gradient(pqc, [theta], [{ pauli: "Z", qubit: 0, coeff: 1.0 }]);
    assert.ok(Math.abs(res.expectation - Math.cos(theta)) < 1e-9);
    assert.ok(Math.abs(res.gradients[0] - (-Math.sin(theta))) < 1e-9);
});

test("JaxQuantumAdapter.vmapSweep evaluates parameter batch", async () => {
    const pqc = {
        name: "RY PQC",
        qubits: 1,
        operations: [{ gate: "RY", targets: [0], paramIndex: 0 }],
    };
    const res = await jaxAdapter.vmapSweep(pqc, [[0], [Math.PI / 2], [Math.PI]], [{ pauli: "Z", qubit: 0, coeff: 1.0 }]);
    assert.equal(res.batchSize, 3);
    assert.ok(Math.abs(res.expectations[0] - 1.0) < 1e-9);
    assert.ok(Math.abs(res.expectations[1] - 0.0) < 1e-9);
    assert.ok(Math.abs(res.expectations[2] - (-1.0)) < 1e-9);
});

test("Legacy TensorFlowQuantumAdapter remains backward-compatible", async () => {
    const docs = tfqAdapter.getDocumentation();
    assert.ok(docs.title.includes("Legacy"));
    const probe = await tfqAdapter.probe();
    assert.equal(probe.id, "tensorflow_quantum");
    assert.equal(probe.available, false);
});

test("Existing QStudio features (SilqCompiler, QuantumDebugger, Cirq, qsim) remain functional", async () => {
    const compiler = new SilqCompiler();
    const compiled = await compiler.analyze("fn bell() {\n  let q = new Qubit[2];\n  H(q[0]);\n  X(q[1]).controlled(q[0]);\n  return measure(q);\n}");
    assert.equal(compiled.ir.qubits, 2);

    const dbg = new QuantumDebugger(compiled.ir);
    assert.ok(dbg.totalSteps > 0);
    const snap = await dbg.goToStep(1);
    assert.equal(snap.step, 1);

    const bellCircuit = {
        name: "Bell State",
        qubits: 2,
        operations: [
            { gate: "H", targets: [0] },
            { gate: "CX", targets: [0, 1] },
        ],
    };
    const cirqRes = await cirqAdapter.simulate(bellCircuit, 256, 11);
    assert.equal(cirqRes.backend, "cirq");
    assert.ok(Math.abs(cirqRes.probabilities[0] - 0.5) < 1e-6);

    const bench = await qsimAdapter.benchmark(bellCircuit, 256);
    assert.equal(bench.qubits, 2);
    assert.ok(bench.fidelityVsNative > 0.99);
});
