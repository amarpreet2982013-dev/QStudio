"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const ALLOWED_CHANNELS = new Set([
    "project:open",
    "project:files",
    "file:read",
    "file:write",
    "terminal:run",
    "ai:complete",
    "frameworks:probe",
    "frameworks:simulate",
    "frameworks:exportCirq",
    "frameworks:importCirq",
    "frameworks:estimateQualtran",
    "frameworks:openfermion",
    "frameworks:benchmark",
    "frameworks:probeTfq",
]);
function invokeAllowed(channel, ...args) {
    if (!ALLOWED_CHANNELS.has(channel)) {
        return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
    }
    return electron_1.ipcRenderer.invoke(channel, ...args);
}
electron_1.contextBridge.exposeInMainWorld("silq", Object.freeze({
    openProject: () => invokeAllowed("project:open"),
    files: (root) => {
        if (typeof root !== "string")
            throw new TypeError("Expected string for root path.");
        return invokeAllowed("project:files", root);
    },
    readFile: (file) => {
        if (typeof file !== "string")
            throw new TypeError("Expected string for file path.");
        return invokeAllowed("file:read", file);
    },
    writeFile: (file, contents) => {
        if (typeof file !== "string" || typeof contents !== "string") {
            throw new TypeError("Expected string for file path and contents.");
        }
        return invokeAllowed("file:write", file, contents);
    },
    runTerminal: (command, args, cwd) => {
        if (typeof command !== "string" || !Array.isArray(args) || typeof cwd !== "string") {
            throw new TypeError("Invalid terminal arguments.");
        }
        return invokeAllowed("terminal:run", command, args, cwd);
    },
    completeAI: (action, source, diagnostics) => {
        if (typeof action !== "string" || typeof source !== "string") {
            throw new TypeError("Invalid AI completion arguments.");
        }
        return invokeAllowed("ai:complete", action, source, diagnostics);
    },
    frameworks: {
        probe: () => invokeAllowed("frameworks:probe"),
        simulate: (req) => {
            if (!req || typeof req !== "object")
                throw new TypeError("Invalid simulation request.");
            return invokeAllowed("frameworks:simulate", req);
        },
        exportCirq: (circuit) => {
            if (!circuit || typeof circuit !== "object")
                throw new TypeError("Invalid circuit model.");
            return invokeAllowed("frameworks:exportCirq", circuit);
        },
        importCirq: (code) => {
            if (typeof code !== "string")
                throw new TypeError("Expected string code.");
            return invokeAllowed("frameworks:importCirq", code);
        },
        estimateQualtran: (req) => {
            if (!req || typeof req !== "object")
                throw new TypeError("Invalid Qualtran request.");
            return invokeAllowed("frameworks:estimateQualtran", req);
        },
        openfermion: (req) => {
            if (!req || typeof req !== "object")
                throw new TypeError("Invalid OpenFermion request.");
            return invokeAllowed("frameworks:openfermion", req);
        },
        benchmark: (circuit, shots) => {
            if (!circuit || typeof circuit !== "object")
                throw new TypeError("Invalid circuit model.");
            return invokeAllowed("frameworks:benchmark", circuit, shots);
        },
        probeTfq: () => invokeAllowed("frameworks:probeTfq"),
    },
}));
