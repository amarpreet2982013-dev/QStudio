"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultLanguageRegistry = void 0;
exports.createDefaultLanguageRegistry = createDefaultLanguageRegistry;
const LanguageRegistry_1 = require("./LanguageRegistry");
const SilqLanguageAdapter_1 = require("./SilqLanguageAdapter");
const OpenQasm3LanguageAdapter_1 = require("./openqasm3/OpenQasm3LanguageAdapter");
const QSharpLanguageAdapter_1 = require("./qsharp/QSharpLanguageAdapter");
const QuilLanguageAdapter_1 = require("./quil/QuilLanguageAdapter");
const OpenQasm2LanguageAdapter_1 = require("./openqasm2/OpenQasm2LanguageAdapter");
__exportStar(require("./types"), exports);
__exportStar(require("./LanguageRegistry"), exports);
__exportStar(require("./SilqLanguageAdapter"), exports);
__exportStar(require("./openqasm3/OpenQasm3LanguageAdapter"), exports);
__exportStar(require("./openqasm3/OpenQasm3Parser"), exports);
__exportStar(require("./qsharp/QSharpLanguageAdapter"), exports);
__exportStar(require("./qsharp/QSharpParser"), exports);
__exportStar(require("./quil/QuilLanguageAdapter"), exports);
__exportStar(require("./quil/QuilParser"), exports);
__exportStar(require("./openqasm2/OpenQasm2LanguageAdapter"), exports);
__exportStar(require("./openqasm2/OpenQasm2Parser"), exports);
function createDefaultLanguageRegistry() {
    const registry = new LanguageRegistry_1.LanguageRegistry();
    registry.register(new SilqLanguageAdapter_1.SilqLanguageAdapter());
    registry.register(new OpenQasm3LanguageAdapter_1.OpenQasm3LanguageAdapter());
    registry.register(new QSharpLanguageAdapter_1.QSharpLanguageAdapter());
    registry.register(new QuilLanguageAdapter_1.QuilLanguageAdapter());
    registry.register(new OpenQasm2LanguageAdapter_1.OpenQasm2LanguageAdapter());
    return registry;
}
exports.defaultLanguageRegistry = createDefaultLanguageRegistry();
