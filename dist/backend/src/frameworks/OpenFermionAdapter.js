"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openfermionAdapter = exports.OpenFermionAdapter = void 0;
const QuantumFrameworkBridge_1 = require("./QuantumFrameworkBridge");
const types_1 = require("./types");
class OpenFermionAdapter {
    bridge;
    constructor(bridge = QuantumFrameworkBridge_1.defaultFrameworkBridge) {
        this.bridge = bridge;
    }
    getPreconfiguredMolecules() {
        return types_1.MOLECULAR_SYSTEMS;
    }
    async generateHamiltonianAndCircuit(request) {
        return this.bridge.openfermionHamiltonian(request);
    }
}
exports.OpenFermionAdapter = OpenFermionAdapter;
exports.openfermionAdapter = new OpenFermionAdapter();
