"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOLECULAR_SYSTEMS = exports.QUALTRAN_ALGORITHMS = exports.CIRQ_COMPATIBILITY_MATRIX = void 0;
exports.CIRQ_COMPATIBILITY_MATRIX = [
    { gate: "H", category: "1-qubit", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.H" },
    { gate: "X", category: "1-qubit", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.X" },
    { gate: "Y", category: "1-qubit", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.Y" },
    { gate: "Z", category: "1-qubit", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.Z" },
    { gate: "S", category: "1-qubit", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.S" },
    { gate: "T", category: "1-qubit", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.T" },
    { gate: "RX", category: "parametric", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.rx(rad)" },
    { gate: "RY", category: "parametric", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.ry(rad)" },
    { gate: "RZ", category: "parametric", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.rz(rad)" },
    { gate: "CX / CNOT", category: "2-qubit", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.CNOT" },
    { gate: "CZ", category: "2-qubit", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.CZ" },
    { gate: "SWAP", category: "2-qubit", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.SWAP" },
    { gate: "ISWAP", category: "2-qubit", supportedInQStudio: false, supportedInCirq: true, cirqSymbol: "cirq.ISWAP", notes: "Decomposed to CX-H-CX in QStudio simulator" },
    { gate: "CCX / Toffoli", category: "3-qubit", supportedInQStudio: false, supportedInCirq: true, cirqSymbol: "cirq.TOFFOLI", notes: "Decomposed to T/Clifford basis" },
    {
        gate: "MEASURE",
        category: "measurement",
        supportedInQStudio: true,
        supportedInCirq: true,
        cirqSymbol: "cirq.measure",
        notes: "Terminal full-register sampling only; circuit marker does not collapse state or map classical bits.",
    },
    { gate: "RESET", category: "measurement", supportedInQStudio: true, supportedInCirq: true, cirqSymbol: "cirq.reset" },
];
exports.QUALTRAN_ALGORITHMS = [
    {
        id: "Adder",
        name: "Quantum Ripple-Carry Adder",
        description: "Low-T-complexity modular ripple-carry addition based on Gidney & Craig / Cuccaro constructions.",
        parameters: [{ name: "bits", label: "Bit Precision (n)", default: 4, min: 2, max: 32 }],
    },
    {
        id: "ModularExponentiation",
        name: "Modular Exponentiation (Shor's Algorithm)",
        description: "Controlled modular multiplier a^x mod N, dominant bottleneck of integer factorization.",
        parameters: [{ name: "bits", label: "Modulus Size (bits)", default: 4, min: 2, max: 16 }],
    },
    {
        id: "QPE",
        name: "Quantum Phase Estimation",
        description: "Eigenvalue estimation with an inverse QFT readout register.",
        parameters: [{ name: "bits", label: "Readout Register (bits)", default: 4, min: 2, max: 16 }],
    },
    {
        id: "SurfaceCodeOverhead",
        name: "Surface Code Fault-Tolerant Compiler",
        description: "Calculates physical qubit count, code distance d, and execution time under threshold noise.",
        parameters: [{ name: "bits", label: "Logical Qubits", default: 4, min: 1, max: 64 }],
    },
];
exports.MOLECULAR_SYSTEMS = [
    {
        id: "H2",
        name: "Hydrogen Molecule",
        formula: "H₂",
        activeElectrons: 2,
        activeSpinOrbitals: 4,
        equilibriumBondDistance: 0.7414,
        groundStateEnergyHartree: -1.137,
    },
    {
        id: "LiH",
        name: "Lithium Hydride",
        formula: "LiH",
        activeElectrons: 4,
        activeSpinOrbitals: 6,
        equilibriumBondDistance: 1.595,
        groundStateEnergyHartree: -7.882,
    },
    {
        id: "BeH2",
        name: "Beryllium Dihydride",
        formula: "BeH₂",
        activeElectrons: 6,
        activeSpinOrbitals: 10,
        equilibriumBondDistance: 1.326,
        groundStateEnergyHartree: -15.595,
    },
];
