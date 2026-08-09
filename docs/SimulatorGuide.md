# Simulator guide

`StateVectorSimulator` simulates one through twelve qubits using a normalized complex amplitude vector. It supports H, X, Y, Z, S, T, CNOT, CZ, SWAP, measurement, and reset; `runIR` permits testing compiled circuits without reparsing source.

Simulation output includes an exact probability distribution, state vector, shot counts, single-qubit marginals, and Bloch coordinates. The debugger executes IR prefixes for forward and backward stepping.
