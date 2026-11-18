"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateVectorSimulator = exports.MAX_DYNAMIC_RESULT_BYTES = exports.MAX_RESET_TRAJECTORY_WORK_UNITS = exports.MAX_RESET_TRAJECTORY_SHOTS = exports.SUPPORTED_STATE_VECTOR_OPCODES = void 0;
const SilqCompiler_1 = require("../backend/src/compiler/SilqCompiler");
const languages_1 = require("../backend/src/languages");
exports.SUPPORTED_STATE_VECTOR_OPCODES = [
    "h",
    "x",
    "y",
    "z",
    "s",
    "t",
    "cx",
    "cz",
    "swap",
    "measure",
    "reset",
];
exports.MAX_RESET_TRAJECTORY_SHOTS = 4_096;
exports.MAX_RESET_TRAJECTORY_WORK_UNITS = 500_000_000;
exports.MAX_DYNAMIC_RESULT_BYTES = 3 * 1024 * 1024;
const MAX_DYNAMIC_CLASSICAL_BITS = 256;
class StateVectorSimulator {
    compiler;
    registry;
    cancelled = false;
    real = new Float64Array();
    imaginary = new Float64Array();
    qubits = 0;
    maxQubits;
    maxOperations;
    maxShots;
    rng;
    samplingRng;
    constructor(compiler = new SilqCompiler_1.SilqCompiler(), registry = languages_1.defaultLanguageRegistry, options) {
        this.compiler = compiler;
        this.registry = registry;
        this.maxQubits = options?.maxQubits ?? 12;
        this.maxOperations = options?.maxOperations ?? 10000;
        this.maxShots = options?.maxShots ?? 100000;
        if (options?.rng) {
            this.rng = options.rng;
            this.samplingRng = options.rng;
        }
        else if (options?.seed != null) {
            this.rng = StateVectorSimulator.createMulberry32(options.seed);
            this.samplingRng = StateVectorSimulator.createMulberry32(options.seed ^ 0x9E3779B9);
        }
        else {
            this.rng = Math.random;
            this.samplingRng = Math.random;
        }
    }
    setSeed(seed) {
        if (seed === null) {
            this.rng = Math.random;
            this.samplingRng = Math.random;
        }
        else {
            this.rng = StateVectorSimulator.createMulberry32(seed);
            this.samplingRng = StateVectorSimulator.createMulberry32(seed ^ 0x9E3779B9);
        }
    }
    static createMulberry32(seed) {
        let s = seed >>> 0;
        return () => {
            s = (s + 0x6d2b79f5) >>> 0;
            let t = Math.imul(s ^ (s >>> 15), 1 | s);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    async compile(source, languageId) {
        if (languageId && this.registry.has(languageId)) {
            const adapter = this.registry.get(languageId);
            if (adapter) {
                return (await adapter.compile(source)).ir;
            }
        }
        const detected = this.registry.detectByContent(source);
        if (detected) {
            return (await detected.compile(source)).ir;
        }
        return (await this.compiler.analyze(source)).ir;
    }
    async run(source, shots = 1024, languageId) {
        const ir = await this.compile(source, languageId);
        return this.runIR(ir, shots);
    }
    async runIR(ir, shots = 1024) {
        if (!Number.isInteger(ir.qubits) || ir.qubits < 1 || ir.qubits > this.maxQubits) {
            throw new Error(`State-vector simulation supports 1–${this.maxQubits} qubits.`);
        }
        if (!Array.isArray(ir.operations)) {
            throw new Error("Invalid QuantumIR: operations must be an array.");
        }
        if (ir.operations.length > this.maxOperations) {
            throw new Error(`Circuit operation count (${ir.operations.length}) exceeds the maximum allowed limit of ${this.maxOperations}.`);
        }
        if (!Number.isInteger(shots) || shots < 1 || shots > this.maxShots) {
            throw new Error(`Invalid shots count: must be an integer between 1 and ${this.maxShots}.`);
        }
        if (shots > exports.MAX_RESET_TRAJECTORY_SHOTS &&
            ir.operations.some((operation) => operation.opcode === "reset")) {
            throw new Error(`Reset trajectory simulations are limited to ${exports.MAX_RESET_TRAJECTORY_SHOTS} shots per run.`);
        }
        const hasReset = ir.operations.some((operation) => operation.opcode === "reset");
        const hasDynamicOperations = ir.operations.some((operation) => operation.condition !== undefined || operation.classicalTarget !== undefined);
        if (hasDynamicOperations) {
            this.validateDynamicOperations(ir, shots);
        }
        if (hasReset || hasDynamicOperations) {
            const workUnits = BigInt(shots) *
                (1n << BigInt(ir.qubits)) *
                BigInt(ir.operations.length + 2 * ir.qubits);
            if (workUnits > BigInt(exports.MAX_RESET_TRAJECTORY_WORK_UNITS)) {
                throw new Error(`${hasReset ? "Reset trajectory" : "Dynamic trajectory"} workload (${workUnits} units) exceeds the limit of ${exports.MAX_RESET_TRAJECTORY_WORK_UNITS}.`);
            }
        }
        this.cancelled = false;
        const started = performance.now();
        if (hasDynamicOperations) {
            return this.runDynamicEnsemble(ir, shots, started);
        }
        if (hasReset) {
            return this.runResetEnsemble(ir, shots, started);
        }
        this.initialize(ir.qubits);
        for (const operation of ir.operations) {
            if (this.cancelled)
                throw new Error("Simulation stopped.");
            this.apply(operation);
        }
        const probabilities = this.probabilities();
        const counts = this.sample(probabilities, shots);
        return {
            shots,
            counts,
            probabilities,
            executionMode: "unitary",
            stateVectorAvailable: true,
            probabilitiesAreEmpirical: false,
            stateVector: this.stateVector(),
            registers: this.registers(),
            amplitudes: this.amplitudes(),
            elapsedMs: Math.round(performance.now() - started),
        };
    }
    async measure(qubit) {
        return this.measureNow(qubit);
    }
    async stop() {
        this.cancelled = true;
    }
    initialize(qubits) {
        this.qubits = qubits;
        const size = 1 << qubits;
        this.real = new Float64Array(size);
        this.imaginary = new Float64Array(size);
        this.real[0] = 1;
    }
    async runResetEnsemble(ir, shots, started) {
        const counts = {};
        const registerSums = Array.from({ length: ir.qubits }, () => ({ zero: 0, one: 0, x: 0, y: 0, z: 0 }));
        for (let shot = 0; shot < shots; shot++) {
            if (this.cancelled)
                throw new Error("Simulation stopped.");
            if (shot > 0 && shot % 64 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
            this.initialize(ir.qubits);
            for (const operation of ir.operations) {
                if (this.cancelled)
                    throw new Error("Simulation stopped.");
                this.apply(operation);
            }
            const basis = this.sampleOneState();
            counts[basis] = (counts[basis] ?? 0) + 1;
            const registers = this.registers();
            for (let qubit = 0; qubit < ir.qubits; qubit++) {
                const sum = registerSums[qubit];
                const register = registers[qubit];
                sum.zero += register.zero;
                sum.one += register.one;
                sum.x += register.bloch.x;
                sum.y += register.bloch.y;
                sum.z += register.bloch.z;
            }
        }
        const registers = registerSums.map((sum, qubit) => {
            const zero = sum.zero / shots;
            const one = sum.one / shots;
            const x = sum.x / shots;
            const y = sum.y / shots;
            const z = sum.z / shots;
            return { qubit, zero, one, bloch: { x, y, z } };
        });
        return {
            shots,
            counts,
            probabilities: Object.fromEntries(Object.entries(counts).map(([basis, count]) => [basis, count / shots])),
            executionMode: "trajectory",
            stateVectorAvailable: false,
            probabilitiesAreEmpirical: true,
            stateVector: [],
            registers,
            amplitudes: [],
            elapsedMs: Math.round(performance.now() - started),
        };
    }
    validateDynamicOperations(ir, shots) {
        if (!Number.isInteger(ir.classicalBits) ||
            ir.classicalBits < 1 ||
            ir.classicalBits > MAX_DYNAMIC_CLASSICAL_BITS) {
            throw new Error(`Dynamic circuits require 1–${MAX_DYNAMIC_CLASSICAL_BITS} allocated classical bits.`);
        }
        const writtenBits = new Set();
        let hasMeasurement = false;
        let measurementCount = 0;
        for (const [operationIndex, operation] of ir.operations.entries()) {
            if (operation.classicalTarget !== undefined) {
                if (operation.opcode !== "measure") {
                    throw new Error(`Operation ${operationIndex} assigns a classical bit but is not a measurement.`);
                }
                if (!Number.isInteger(operation.classicalTarget) ||
                    operation.classicalTarget < 0 ||
                    operation.classicalTarget >= ir.classicalBits) {
                    throw new Error(`Measurement operation ${operationIndex} has an invalid classical destination.`);
                }
                if (operation.targets.length !== 1) {
                    throw new Error(`Measurement operation ${operationIndex} must target exactly one qubit.`);
                }
                hasMeasurement = true;
                measurementCount++;
                writtenBits.add(operation.classicalTarget);
            }
            if (operation.condition !== undefined) {
                if (typeof operation.condition !== "object" ||
                    operation.condition === null ||
                    Array.isArray(operation.condition)) {
                    throw new Error(`Conditional operation ${operationIndex} has an invalid condition.`);
                }
                const { bits, equals } = operation.condition;
                if (!["h", "x", "z"].includes(operation.opcode)) {
                    throw new Error(`Conditional '${operation.opcode}' is unsupported; conditional H, X, and Z are supported.`);
                }
                if (operation.targets.length !== 1 || operation.controls.length !== 0) {
                    throw new Error(`Conditional ${operation.opcode.toUpperCase()} must target exactly one qubit.`);
                }
                if (!Array.isArray(bits) ||
                    bits.length === 0 ||
                    bits.length > MAX_DYNAMIC_CLASSICAL_BITS ||
                    new Set(bits).size !== bits.length ||
                    bits.some((bit) => !Number.isInteger(bit) || bit < 0 || bit >= ir.classicalBits)) {
                    throw new Error(`Conditional operation ${operationIndex} has invalid classical-bit references.`);
                }
                if (typeof equals !== "string" || !new RegExp(`^[01]{${bits.length}}$`).test(equals)) {
                    throw new Error(`Conditional operation ${operationIndex} requires an expected bit string of length ${bits.length}.`);
                }
                const unwritten = bits.find((bit) => !writtenBits.has(bit));
                if (unwritten !== undefined) {
                    throw new Error(`Conditional operation ${operationIndex} reads classical bit ${unwritten} before it is measured.`);
                }
            }
            if (operation.opcode === "measure" && operation.classicalTarget === undefined && operation.condition !== undefined) {
                throw new Error(`Measurement operation ${operationIndex} cannot be conditional.`);
            }
        }
        if (!hasMeasurement)
            throw new Error("Dynamic circuits require at least one measurement with a classical destination.");
        const estimatedBytes = shots * (256 + measurementCount * 128 + ir.classicalBits * 6 + ir.qubits * 2 + 105) +
            measurementCount * 96 +
            (shots === 1 ? (1 << ir.qubits) * 160 : 0);
        if (estimatedBytes > exports.MAX_DYNAMIC_RESULT_BYTES) {
            throw new Error(`Dynamic result payload is estimated at ${estimatedBytes} bytes; maximum allowed is ${exports.MAX_DYNAMIC_RESULT_BYTES}.`);
        }
        if (shots > exports.MAX_RESET_TRAJECTORY_SHOTS) {
            throw new Error(`Dynamic trajectory simulations are limited to ${exports.MAX_RESET_TRAJECTORY_SHOTS} shots per run.`);
        }
    }
    async runDynamicEnsemble(ir, shots, started) {
        const counts = {};
        const classicalCounts = {};
        const measurementRecords = [];
        const measurementCountMap = new Map();
        const registerSums = Array.from({ length: ir.qubits }, () => ({ zero: 0, one: 0, x: 0, y: 0, z: 0 }));
        let singleShotState;
        for (let shot = 0; shot < shots; shot++) {
            if (this.cancelled)
                throw new Error("Simulation stopped.");
            if (shot > 0 && shot % 64 === 0) {
                await new Promise((resolve) => setTimeout(resolve, 0));
            }
            this.initialize(ir.qubits);
            const classicalBits = Array.from({ length: ir.classicalBits }, () => null);
            const measurements = [];
            for (const [operationIndex, operation] of ir.operations.entries()) {
                if (this.cancelled)
                    throw new Error("Simulation stopped.");
                if (operation.condition) {
                    const observed = operation.condition.bits.map((bit) => classicalBits[bit]).join("");
                    if (observed !== operation.condition.equals)
                        continue;
                }
                if (operation.opcode === "measure" && operation.classicalTarget !== undefined) {
                    const qubit = operation.targets[0];
                    const value = this.measureNow(qubit);
                    const classicalBit = operation.classicalTarget;
                    classicalBits[classicalBit] = value;
                    measurements.push({ operationIndex, qubit, classicalBit, value });
                    const aggregate = measurementCountMap.get(operationIndex) ?? { classicalBit, zero: 0, one: 0 };
                    if (value === 0)
                        aggregate.zero++;
                    else
                        aggregate.one++;
                    measurementCountMap.set(operationIndex, aggregate);
                }
                else {
                    this.apply(operation);
                }
            }
            const basis = this.sampleOneState();
            counts[basis] = (counts[basis] ?? 0) + 1;
            const classicalKey = classicalBits.map((bit) => bit === null ? "?" : String(bit)).reverse().join("");
            classicalCounts[classicalKey] = (classicalCounts[classicalKey] ?? 0) + 1;
            measurementRecords.push({ shot, measurements, classicalBits });
            const registers = this.registers();
            for (let qubit = 0; qubit < ir.qubits; qubit++) {
                const sum = registerSums[qubit];
                const register = registers[qubit];
                sum.zero += register.zero;
                sum.one += register.one;
                sum.x += register.bloch.x;
                sum.y += register.bloch.y;
                sum.z += register.bloch.z;
            }
            if (shots === 1)
                singleShotState = this.stateVector();
        }
        const registers = registerSums.map((sum, qubit) => {
            const zero = sum.zero / shots;
            const one = sum.one / shots;
            return {
                qubit,
                zero,
                one,
                bloch: { x: sum.x / shots, y: sum.y / shots, z: sum.z / shots },
            };
        });
        const stateVectorAvailable = shots === 1 && !ir.operations.some((operation) => operation.opcode === "reset");
        const stateVector = stateVectorAvailable ? singleShotState ?? [] : [];
        return {
            shots,
            counts,
            probabilities: Object.fromEntries(Object.entries(counts).map(([state, count]) => [state, count / shots])),
            executionMode: "dynamic",
            stateVectorAvailable,
            probabilitiesAreEmpirical: true,
            stateVector,
            registers,
            amplitudes: stateVectorAvailable ? this.amplitudes() : [],
            measurementRecords,
            measurementCounts: Array.from(measurementCountMap, ([operationIndex, values]) => ({
                operationIndex,
                classicalBit: values.classicalBit,
                zero: values.zero,
                one: values.one,
            })),
            classicalCounts,
            ...(stateVectorAvailable ? { trajectoryState: { shot: 0, stateVector } } : {}),
            elapsedMs: Math.round(performance.now() - started),
        };
    }
    measureNow(qubit) {
        this.assertQubit(qubit);
        const one = this.probabilityOne(qubit);
        const result = this.rng() < one ? 1 : 0;
        this.collapse(qubit, result);
        return result;
    }
    sampleOneState() {
        let total = 0;
        for (let i = 0; i < this.real.length; i++) {
            total += this.real[i] ** 2 + this.imaginary[i] ** 2;
        }
        const threshold = this.samplingRng() * total;
        let cumulative = 0;
        let lastIndex = 0;
        for (let i = 0; i < this.real.length; i++) {
            const probability = this.real[i] ** 2 + this.imaginary[i] ** 2;
            if (probability <= 0)
                continue;
            lastIndex = i;
            cumulative += probability;
            if (threshold < cumulative)
                return i.toString(2).padStart(this.qubits, "0");
        }
        return lastIndex.toString(2).padStart(this.qubits, "0");
    }
    apply(operation) {
        const [a, b] = operation.targets;
        switch (operation.opcode) {
            case "h":
                this.single(a, [Math.SQRT1_2, 0], [Math.SQRT1_2, 0], [Math.SQRT1_2, 0], [-Math.SQRT1_2, 0]);
                break;
            case "x":
                this.single(a, [0, 0], [1, 0], [1, 0], [0, 0]);
                break;
            case "y":
                this.single(a, [0, 0], [0, -1], [0, 1], [0, 0]);
                break;
            case "z":
                this.single(a, [1, 0], [0, 0], [0, 0], [-1, 0]);
                break;
            case "s":
                this.single(a, [1, 0], [0, 0], [0, 0], [0, 1]);
                break;
            case "t":
                this.single(a, [1, 0], [0, 0], [0, 0], [Math.SQRT1_2, Math.SQRT1_2]);
                break;
            case "cx":
                this.controlledX(operation.controls[0] ?? a, operation.targets[operation.controls.length ? 0 : 1] ?? b);
                break;
            case "cz":
                this.controlledZ(operation.controls[0] ?? a, operation.targets[operation.controls.length ? 0 : 1] ?? b);
                break;
            case "swap":
                this.swap(a, b);
                break;
            case "reset":
                this.reset(a);
                break;
            case "measure":
                this.assertQubit(a);
                break;
            default:
                throw new Error(`Unsupported or invalid operation opcode: '${operation.opcode}'.`);
        }
    }
    single(target, m00, m01, m10, m11) {
        this.assertQubit(target);
        const bit = 1 << target;
        for (let base = 0; base < this.real.length; base += bit << 1) {
            for (let offset = 0; offset < bit; offset++) {
                const i0 = base + offset;
                const i1 = i0 + bit;
                const [r0, im0] = [this.real[i0], this.imaginary[i0]];
                const [r1, im1] = [this.real[i1], this.imaginary[i1]];
                [this.real[i0], this.imaginary[i0]] = this.multiplyAdd(m00, r0, im0, m01, r1, im1);
                [this.real[i1], this.imaginary[i1]] = this.multiplyAdd(m10, r0, im0, m11, r1, im1);
            }
        }
    }
    multiplyAdd(a, br, bi, c, dr, di) {
        return [a[0] * br - a[1] * bi + c[0] * dr - c[1] * di, a[0] * bi + a[1] * br + c[0] * di + c[1] * dr];
    }
    controlledX(control, target) {
        this.assertQubit(control);
        this.assertQubit(target);
        if (control === target)
            throw new Error("Control and target must differ.");
        for (let i = 0; i < this.real.length; i++) {
            if ((i & (1 << control)) && !(i & (1 << target))) {
                const pair = i | (1 << target);
                [this.real[i], this.real[pair]] = [this.real[pair], this.real[i]];
                [this.imaginary[i], this.imaginary[pair]] = [this.imaginary[pair], this.imaginary[i]];
            }
        }
    }
    controlledZ(control, target) {
        this.assertQubit(control);
        this.assertQubit(target);
        if (control === target)
            throw new Error("Control and target must differ.");
        for (let i = 0; i < this.real.length; i++) {
            if ((i & (1 << control)) && (i & (1 << target))) {
                this.real[i] *= -1;
                this.imaginary[i] *= -1;
            }
        }
    }
    swap(a, b) {
        this.assertQubit(a);
        this.assertQubit(b);
        if (a === b)
            throw new Error("SWAP target qubits must differ.");
        for (let i = 0; i < this.real.length; i++) {
            const bitA = Boolean(i & (1 << a));
            const bitB = Boolean(i & (1 << b));
            if (bitA === bitB)
                continue;
            const pair = i ^ (1 << a) ^ (1 << b);
            if (i < pair) {
                [this.real[i], this.real[pair]] = [this.real[pair], this.real[i]];
                [this.imaginary[i], this.imaginary[pair]] = [this.imaginary[pair], this.imaginary[i]];
            }
        }
    }
    reset(qubit) {
        this.assertQubit(qubit);
        const one = this.probabilityOne(qubit);
        if (one <= 1e-15) {
            this.collapse(qubit, 0);
            return;
        }
        if (one >= 1 - 1e-15) {
            this.collapse(qubit, 1);
            this.single(qubit, [0, 0], [1, 0], [1, 0], [0, 0]);
            return;
        }
        const outcome = this.rng() < one ? 1 : 0;
        this.collapse(qubit, outcome);
        if (outcome === 1) {
            this.single(qubit, [0, 0], [1, 0], [1, 0], [0, 0]);
        }
    }
    probabilityOne(qubit) {
        let value = 0;
        for (let i = 0; i < this.real.length; i++) {
            if (i & (1 << qubit))
                value += this.real[i] ** 2 + this.imaginary[i] ** 2;
        }
        return Math.min(1, Math.max(0, value));
    }
    collapse(qubit, result) {
        const probability = result ? this.probabilityOne(qubit) : 1 - this.probabilityOne(qubit);
        const scale = probability > 0 ? 1 / Math.sqrt(probability) : 0;
        for (let i = 0; i < this.real.length; i++) {
            if (Boolean(i & (1 << qubit)) !== Boolean(result)) {
                this.real[i] = 0;
                this.imaginary[i] = 0;
            }
            else {
                this.real[i] *= scale;
                this.imaginary[i] *= scale;
            }
        }
    }
    probabilities() {
        const result = {};
        for (let i = 0; i < this.real.length; i++) {
            const value = this.real[i] ** 2 + this.imaginary[i] ** 2;
            if (value > 1e-12)
                result[i.toString(2).padStart(this.qubits, "0")] = value;
        }
        return result;
    }
    sample(probabilities, shots) {
        const rows = Object.entries(probabilities);
        const counts = {};
        if (rows.length === 0 || shots <= 0)
            return counts;
        const totalProb = rows.reduce((acc, [, p]) => acc + p, 0);
        const cdf = [];
        let cumulative = 0;
        for (let i = 0; i < rows.length; i++) {
            cumulative += rows[i][1] / totalProb;
            cdf.push([rows[i][0], i === rows.length - 1 ? 1.0 : cumulative]);
        }
        for (let shot = 0; shot < shots; shot++) {
            const r = this.rng();
            for (const [state, threshold] of cdf) {
                if (r <= threshold) {
                    counts[state] = (counts[state] ?? 0) + 1;
                    break;
                }
            }
        }
        return counts;
    }
    stateVector() {
        const output = [];
        for (let i = 0; i < this.real.length; i++) {
            const r = this.real[i];
            const im = this.imaginary[i];
            if (Math.abs(r) > 1e-12 || Math.abs(im) > 1e-12) {
                output.push(`${r < 0 ? "− " : ""}${this.format(Math.abs(r))}${im < 0 ? " − " : " + "}${this.format(Math.abs(im))}i|${i.toString(2).padStart(this.qubits, "0")}⟩`);
            }
        }
        return output;
    }
    registers() {
        return Array.from({ length: this.qubits }, (_, qubit) => {
            const one = this.probabilityOne(qubit);
            let x = 0;
            let y = 0;
            const bit = 1 << qubit;
            for (let i = 0; i < this.real.length; i++) {
                if (!(i & bit)) {
                    const pair = i | bit;
                    x += 2 * (this.real[i] * this.real[pair] + this.imaginary[i] * this.imaginary[pair]);
                    y += 2 * (this.real[i] * this.imaginary[pair] - this.imaginary[i] * this.real[pair]);
                }
            }
            return { qubit, zero: 1 - one, one, bloch: { x, y, z: 1 - 2 * one } };
        });
    }
    amplitudes() {
        return Array.from(this.real, (real, index) => {
            const imag = this.imaginary[index];
            const magnitude = Math.hypot(real, imag);
            const phase = Math.atan2(imag, real);
            return {
                basis: index.toString(2).padStart(this.qubits, "0"),
                index,
                real,
                imag,
                magnitude,
                probability: magnitude ** 2,
                phase,
                phaseDegrees: (phase * 180) / Math.PI,
            };
        });
    }
    assertQubit(qubit) {
        if (!Number.isInteger(qubit) || qubit < 0 || qubit >= this.qubits) {
            throw new Error(`Invalid qubit index ${qubit}.`);
        }
    }
    format(value) {
        return Math.abs(value).toFixed(3);
    }
}
exports.StateVectorSimulator = StateVectorSimulator;
