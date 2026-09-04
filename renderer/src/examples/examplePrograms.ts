export interface ExampleProgram {
  id: string;
  name: string;
  description: string;
  code: string;
}

export const EXAMPLES: ExampleProgram[] = [
  {
    id: "hello-qubit",
    name: "Hello Qubit",
    description: "Create a single qubit and put it into superposition with Hadamard.",
    code: `fn main() {\n  let q = new Qubit[1];\n  H(q[0]);\n  return measure(q);\n}`,
  },
  {
    id: "x-gate",
    name: "X Gate",
    description: "Apply Pauli-X bit-flip gate to invert |0⟩ to |1⟩.",
    code: `fn main() {\n  let q = new Qubit[1];\n  X(q[0]);\n  return measure(q);\n}`,
  },
  {
    id: "h-gate",
    name: "H Gate",
    description: "Place a qubit into equal superposition state (|0⟩ + |1⟩)/√2.",
    code: `fn main() {\n  let q = new Qubit[1];\n  H(q[0]);\n}`,
  },
  {
    id: "bell-state",
    name: "Bell State",
    description: "Generate maximum two-qubit entanglement (|00⟩ + |11⟩)/√2.",
    code: `fn bell() {\n  let q = new Qubit[2];\n  H(q[0]);\n  X(q[1]).controlled(q[0]);\n  return measure(q);\n}`,
  },
  {
    id: "s-phase",
    name: "S Phase",
    description: "Apply a π/2 phase shift to a superposition qubit.",
    code: `fn main() {\n  let q = new Qubit[1];\n  H(q[0]);\n  S(q[0]);\n}`,
  },
  {
    id: "t-phase",
    name: "T Phase",
    description: "Apply a π/4 phase shift (T gate) to a superposition qubit.",
    code: `fn main() {\n  let q = new Qubit[1];\n  H(q[0]);\n  T(q[0]);\n}`,
  },
  {
    id: "cnot",
    name: "CNOT Gate",
    description: "Controlled-NOT operation between control and target qubits.",
    code: `fn main() {\n  let q = new Qubit[2];\n  X(q[0]);\n  CNOT(q[0], q[1]);\n  return measure(q);\n}`,
  },
  {
    id: "swap",
    name: "SWAP Gate",
    description: "Exchange quantum state between two qubits.",
    code: `fn main() {\n  let q = new Qubit[2];\n  X(q[0]);\n  SWAP(q[0], q[1]);\n  return measure(q);\n}`,
  },
  {
    id: "measurement",
    name: "Measurement",
    description: "Measure qubit in Z-basis and collapse state vector.",
    code: `fn main() {\n  let q = new Qubit[2];\n  H(q[0]);\n  measure(q[0]);\n}`,
  },
  {
    id: "reset",
    name: "Reset Gate",
    description: "Reset active qubit back to pure ground state |0⟩.",
    code: `fn main() {\n  let q = new Qubit[1];\n  X(q[0]);\n  reset(q[0]);\n  return measure(q);\n}`,
  },
];
