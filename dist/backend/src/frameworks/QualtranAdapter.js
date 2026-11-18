"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qualtranAdapter = exports.QualtranAdapter = void 0;
const QuantumFrameworkBridge_1 = require("./QuantumFrameworkBridge");
const types_1 = require("./types");
class QualtranAdapter {
    bridge;
    constructor(bridge = QuantumFrameworkBridge_1.defaultFrameworkBridge) {
        this.bridge = bridge;
    }
    getSupportedAlgorithms() {
        return types_1.QUALTRAN_ALGORITHMS;
    }
    async estimate(request) {
        return this.bridge.estimateQualtran(request);
    }
}
exports.QualtranAdapter = QualtranAdapter;
exports.qualtranAdapter = new QualtranAdapter();
