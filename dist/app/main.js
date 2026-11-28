"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const AIService_1 = require("../ai/AIService");
const OpenAICompatibleProvider_1 = require("../ai/OpenAICompatibleProvider");
const WorkspaceGuard_1 = require("../backend/src/security/WorkspaceGuard");
const TerminalGuard_1 = require("../backend/src/security/TerminalGuard");
const QuantumFrameworkBridge_1 = require("../backend/src/frameworks/QuantumFrameworkBridge");
const QsimAdapter_1 = require("../backend/src/frameworks/QsimAdapter");
const CircuitGenerator_1 = require("../backend/src/compiler/CircuitGenerator");
const StateVectorSimulator_1 = require("../simulator/StateVectorSimulator");
let windowRef;
const isDev = !electron_1.app.isPackaged;
const nativeSimulator = new StateVectorSimulator_1.StateVectorSimulator();
const MAX_SIMULATION_QUBITS = 12;
const MAX_SIMULATION_OPERATIONS = 10_000;
const MAX_SIMULATION_SHOTS = 100_000;
const MAX_RESET_TRAJECTORY_SHOTS = 4_096;
const MAX_SIMULATION_CIRCUIT_BYTES = 4 * 1024 * 1024;
const MAX_SIMULATION_SEED = 0xFFFFFFFF;
function validateSimulationSeed(seed) {
    if (seed !== undefined &&
        (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0 || seed > MAX_SIMULATION_SEED)) {
        throw new Error(`Seed must be an unsigned 32-bit integer between 0 and ${MAX_SIMULATION_SEED}.`);
    }
}
function validateSimulationRequest(circuit, shots) {
    if (!Number.isInteger(circuit.qubits) || circuit.qubits < 1 || circuit.qubits > MAX_SIMULATION_QUBITS) {
        throw new Error(`Simulation supports 1–${MAX_SIMULATION_QUBITS} qubits.`);
    }
    if (!Array.isArray(circuit.operations)) {
        throw new Error("Invalid circuit model: operations must be an array.");
    }
    if (circuit.operations.length > MAX_SIMULATION_OPERATIONS) {
        throw new Error(`Circuit operation count (${circuit.operations.length}) exceeds the maximum allowed limit of ${MAX_SIMULATION_OPERATIONS}.`);
    }
    if (!Number.isInteger(shots) || shots < 1 || shots > MAX_SIMULATION_SHOTS) {
        throw new Error(`Shots must be an integer between 1 and ${MAX_SIMULATION_SHOTS}.`);
    }
    const circuitBytes = Buffer.byteLength(JSON.stringify(circuit), "utf8");
    if (circuitBytes > MAX_SIMULATION_CIRCUIT_BYTES) {
        throw new Error(`Serialized circuit exceeds the ${MAX_SIMULATION_CIRCUIT_BYTES}-byte limit.`);
    }
    for (const [index, operation] of circuit.operations.entries()) {
        if (!operation || typeof operation.gate !== "string" || !Array.isArray(operation.targets)) {
            throw new Error(`Invalid circuit operation at index ${index}.`);
        }
        if (operation.targets.some((target) => !Number.isInteger(target) || target < 0 || target >= circuit.qubits)) {
            throw new Error(`Circuit operation ${index} contains a qubit index outside the register.`);
        }
    }
    if (shots > MAX_RESET_TRAJECTORY_SHOTS &&
        circuit.operations.some((operation) => operation.gate.toUpperCase() === "RESET")) {
        throw new Error(`Reset trajectory simulations are limited to ${MAX_RESET_TRAJECTORY_SHOTS} shots per run.`);
    }
    const resetOperations = circuit.operations.filter((operation) => operation.gate.toUpperCase() === "RESET").length;
    if (resetOperations > 0) {
        const workUnits = BigInt(shots) * (1n << BigInt(circuit.qubits)) * BigInt(circuit.operations.length + 2 * circuit.qubits);
        if (workUnits > 500000000n) {
            throw new Error(`Reset trajectory workload (${workUnits} units) exceeds the limit of 500000000.`);
        }
    }
}
async function simulateNativeCircuit(circuit, shots, seed) {
    if (!Array.isArray(circuit.operations)) {
        throw new Error("Invalid circuit model: operations must be an array.");
    }
    const simulator = seed === undefined ? nativeSimulator : new StateVectorSimulator_1.StateVectorSimulator(undefined, undefined, { seed });
    const result = await simulator.runIR((0, CircuitGenerator_1.circuitModelToIR)(circuit), shots);
    const registers = result.registers.map((register) => {
        const bloch = register.bloch;
        const radius = Math.sqrt(bloch.x ** 2 + bloch.y ** 2 + bloch.z ** 2);
        const theta = Math.acos(Math.max(-1, Math.min(1, bloch.z / Math.max(radius, 1e-12))));
        const phi = Math.atan2(bloch.y, bloch.x);
        const lambda1 = Math.max(1e-15, (1 + radius) / 2);
        const lambda2 = Math.max(1e-15, (1 - Math.min(1, radius)) / 2);
        const vonNeumannEntropy = -(lambda1 * Math.log2(lambda1) + (lambda2 > 1e-14 ? lambda2 * Math.log2(lambda2) : 0));
        return {
            qubit: register.qubit,
            zero: register.zero,
            one: register.one,
            bloch: { ...bloch, radius, theta, phi },
            purity: (1 + radius ** 2) / 2,
            vonNeumannEntropy,
        };
    });
    return {
        backend: "QStudio Native State-Vector",
        shots: result.shots,
        ...(seed === undefined ? {} : { seed }),
        ...(result.executionMode === undefined ? {} : { executionMode: result.executionMode }),
        counts: result.counts,
        probabilities: result.probabilities,
        stateVector: result.stateVector ?? [],
        stateVectorAvailable: result.stateVectorAvailable,
        probabilitiesAreEmpirical: result.probabilitiesAreEmpirical,
        registers,
        ...(result.measurementRecords === undefined ? {} : { measurementRecords: result.measurementRecords }),
        ...(result.measurementCounts === undefined ? {} : { measurementCounts: result.measurementCounts }),
        ...(result.classicalCounts === undefined ? {} : { classicalCounts: result.classicalCounts }),
        ...(result.trajectoryState === undefined ? {} : { trajectoryState: result.trajectoryState }),
        amplitudes: result.amplitudes,
        elapsedMs: result.elapsedMs,
    };
}
function validateSender(event) {
    const frame = event.senderFrame;
    if (!frame) {
        throw new Error("Invalid IPC invocation: missing sender frame.");
    }
    const frameUrl = frame.url;
    const isAllowed = isDev
        ? frameUrl.startsWith("http://127.0.0.1:5173") ||
            frameUrl.startsWith("http://localhost:5173") ||
            frameUrl.startsWith("file://")
        : frameUrl.startsWith("file://");
    if (!isAllowed) {
        throw new Error(`Unauthorized IPC invocation from origin: ${frameUrl}`);
    }
}
async function createWindow() {
    // Enforce Content Security Policy via HTTP / load session headers
    electron_1.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        // Monaco editor web workers require 'worker-src self blob:;'
        // Development mode requires Vite HMR websocket and eval for source mapping.
        const csp = isDev
            ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' ws://127.0.0.1:5173 http://127.0.0.1:5173 ws://localhost:5173 http://localhost:5173;"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self';";
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                "Content-Security-Policy": [csp],
                "X-Content-Type-Options": ["nosniff"],
                "X-Frame-Options": ["DENY"],
            },
        });
    });
    windowRef = new electron_1.BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 680,
        title: "Silq Studio",
        backgroundColor: "#10131a",
        webPreferences: {
            preload: node_path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            sandbox: true,
            nodeIntegration: false,
            nodeIntegrationInWorker: false,
            nodeIntegrationInSubFrames: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
    });
    // Restrict navigation: prevent the renderer from being navigated away to untrusted origins
    windowRef.webContents.on("will-navigate", (event, navigationUrl) => {
        try {
            const parsedUrl = new URL(navigationUrl);
            const isAllowed = isDev
                ? (parsedUrl.protocol === "http:" &&
                    (parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost") &&
                    parsedUrl.port === "5173") ||
                    parsedUrl.protocol === "file:"
                : parsedUrl.protocol === "file:";
            if (!isAllowed) {
                event.preventDefault();
            }
        }
        catch {
            event.preventDefault();
        }
    });
    // Restrict window creation: open verified external links in system browser, block arbitrary popups
    windowRef.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const parsed = new URL(url);
            if (parsed.protocol === "https:" || parsed.protocol === "http:") {
                void electron_1.shell.openExternal(url);
            }
        }
        catch {
            // Reject malformed URLs
        }
        return { action: "deny" };
    });
    if (isDev && process.env.VITE_DEV_SERVER_URL) {
        await windowRef.loadURL(process.env.VITE_DEV_SERVER_URL);
    }
    else if (isDev) {
        try {
            await windowRef.loadURL("http://127.0.0.1:5173");
        }
        catch {
            await windowRef.loadFile(node_path_1.default.join(__dirname, "../renderer/index.html"));
        }
    }
    else {
        await windowRef.loadFile(node_path_1.default.join(__dirname, "../renderer/index.html"));
    }
}
electron_1.app.whenReady().then(async () => {
    electron_1.ipcMain.handle("project:open", async (event) => {
        validateSender(event);
        const result = await electron_1.dialog.showOpenDialog({
            properties: ["openDirectory", "createDirectory"],
        });
        if (result.canceled || result.filePaths.length === 0) {
            return undefined;
        }
        const root = result.filePaths[0];
        const canonical = await WorkspaceGuard_1.workspaceGuard.addWorkspace(root);
        return canonical;
    });
    electron_1.ipcMain.handle("project:files", async (event, root) => {
        validateSender(event);
        if (typeof root !== "string") {
            throw new Error("Invalid root directory: expected string.");
        }
        return WorkspaceGuard_1.workspaceGuard.readTree(root);
    });
    electron_1.ipcMain.handle("file:read", async (event, file) => {
        validateSender(event);
        if (typeof file !== "string") {
            throw new Error("Invalid file path: expected string.");
        }
        return WorkspaceGuard_1.workspaceGuard.readFile(file);
    });
    electron_1.ipcMain.handle("file:write", async (event, file, contents) => {
        validateSender(event);
        if (typeof file !== "string" || typeof contents !== "string") {
            throw new Error("Invalid file write arguments: expected string file path and contents.");
        }
        return WorkspaceGuard_1.workspaceGuard.writeFile(file, contents);
    });
    electron_1.ipcMain.handle("terminal:run", async (event, command, args, cwd) => {
        validateSender(event);
        return (0, TerminalGuard_1.runConstrainedTerminal)(command, args, cwd);
    });
    electron_1.ipcMain.handle("ai:complete", async (event, action, source, diagnostics) => {
        validateSender(event);
        if (typeof action !== "string" || typeof source !== "string") {
            throw new Error("Invalid arguments for AI completion.");
        }
        const provider = new OpenAICompatibleProvider_1.OpenAICompatibleProvider({
            consentResolver: async (disclosure) => {
                if (!windowRef)
                    return false;
                const response = await electron_1.dialog.showMessageBox(windowRef, {
                    type: "question",
                    buttons: ["Allow", "Deny"],
                    defaultId: 0,
                    cancelId: 1,
                    title: "External AI Service Consent",
                    message: action === "explain-execution"
                        ? "Transmit the selected source line and simulator trace data to an external AI provider?"
                        : "Transmit source code and request context to external AI provider?",
                    detail: action === "explain-execution"
                        ? `QStudio is preparing to send structured data for the selected step, including its source line, compiled operation, actual simulator state vector, probabilities, and your question. The full source file is not included.\n\nEndpoint: ${disclosure.endpoint}\nModel: ${disclosure.model}\n\nDo you authorize this transmission?`
                        : `QStudio is preparing to send your active source code and any included request text to an external service:\n\nEndpoint: ${disclosure.endpoint}\nModel: ${disclosure.model}\n\nDo you authorize this transmission?`,
                });
                return response.response === 0;
            },
        });
        return new AIService_1.AIService(provider).execute(action, source, diagnostics);
    });
    // Quantum Framework Integrations IPC Channels
    electron_1.ipcMain.handle("frameworks:probe", async (event) => {
        validateSender(event);
        return QuantumFrameworkBridge_1.defaultFrameworkBridge.probe();
    });
    electron_1.ipcMain.handle("frameworks:simulate", async (event, req) => {
        validateSender(event);
        if (!req || typeof req !== "object") {
            throw new Error("Invalid framework simulation request: expected object.");
        }
        if (!["native", "cirq", "qsim", "jax_quantum"].includes(req.backend)) {
            throw new Error(`Unsupported simulation backend: '${req.backend}'.`);
        }
        if (!req.circuit || typeof req.circuit.qubits !== "number") {
            throw new Error("Invalid circuit model provided.");
        }
        const shots = req.shots ?? 1024;
        validateSimulationSeed(req.seed);
        validateSimulationRequest(req.circuit, shots);
        if (req.backend === "cirq") {
            return QuantumFrameworkBridge_1.defaultFrameworkBridge.simulateCirq(req.circuit, shots, req.seed);
        }
        else if (req.backend === "qsim") {
            return QuantumFrameworkBridge_1.defaultFrameworkBridge.simulateQsim(req.circuit, shots, req.seed);
        }
        else if (req.backend === "jax_quantum") {
            return QuantumFrameworkBridge_1.defaultFrameworkBridge.simulateJax(req.circuit, shots, req.seed);
        }
        else {
            return simulateNativeCircuit(req.circuit, shots, req.seed);
        }
    });
    electron_1.ipcMain.handle("frameworks:exportCirq", async (event, circuit) => {
        validateSender(event);
        if (!circuit || typeof circuit !== "object" || typeof circuit.qubits !== "number") {
            throw new Error("Invalid circuit model for Cirq export.");
        }
        return QuantumFrameworkBridge_1.defaultFrameworkBridge.exportCirq(circuit);
    });
    electron_1.ipcMain.handle("frameworks:importCirq", async (event, code) => {
        validateSender(event);
        if (typeof code !== "string" || code.length > 500_000) {
            throw new Error("Invalid code string for Cirq import (exceeds size limit).");
        }
        return QuantumFrameworkBridge_1.defaultFrameworkBridge.importCirq(code);
    });
    electron_1.ipcMain.handle("frameworks:estimateQualtran", async (event, request) => {
        validateSender(event);
        if (!request || typeof request.algorithm !== "string") {
            throw new Error("Invalid Qualtran estimation request: algorithm must be a string.");
        }
        return QuantumFrameworkBridge_1.defaultFrameworkBridge.estimateQualtran(request);
    });
    electron_1.ipcMain.handle("frameworks:openfermion", async (event, request) => {
        validateSender(event);
        if (!request || typeof request.molecule !== "string" || !["jordan_wigner", "bravyi_kitaev"].includes(request.mapping)) {
            throw new Error("Invalid OpenFermion request: valid molecule and mapping required.");
        }
        return QuantumFrameworkBridge_1.defaultFrameworkBridge.openfermionHamiltonian(request);
    });
    electron_1.ipcMain.handle("frameworks:benchmark", async (event, circuit, shots) => {
        validateSender(event);
        if (!circuit || typeof circuit.qubits !== "number") {
            throw new Error("Invalid circuit model for benchmarking.");
        }
        const safeShots = Number.isInteger(shots) && shots > 0 ? shots : 1024;
        return QsimAdapter_1.qsimAdapter.benchmark(circuit, safeShots);
    });
    electron_1.ipcMain.handle("frameworks:probeJax", async (event) => {
        validateSender(event);
        return QuantumFrameworkBridge_1.defaultFrameworkBridge.probeJax();
    });
    electron_1.ipcMain.handle("frameworks:jaxGradient", async (event, request) => {
        validateSender(event);
        if (!request || typeof request !== "object" || !request.circuit || !Array.isArray(request.params)) {
            throw new Error("Invalid JAX gradient request: circuit and params array required.");
        }
        return QuantumFrameworkBridge_1.defaultFrameworkBridge.gradientJax(request.circuit, request.params, request.observable);
    });
    electron_1.ipcMain.handle("frameworks:jaxVmapSweep", async (event, request) => {
        validateSender(event);
        if (!request || typeof request !== "object" || !request.circuit || !Array.isArray(request.paramBatch)) {
            throw new Error("Invalid JAX vmap sweep request: circuit and paramBatch array required.");
        }
        return QuantumFrameworkBridge_1.defaultFrameworkBridge.vmapSweepJax(request.circuit, request.paramBatch, request.observable);
    });
    electron_1.ipcMain.handle("frameworks:probeTfq", async (event) => {
        validateSender(event);
        return QuantumFrameworkBridge_1.defaultFrameworkBridge.probeTfq();
    });
    await createWindow();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            void createWindow();
        }
    });
});
electron_1.app.on("before-quit", () => {
    QuantumFrameworkBridge_1.defaultFrameworkBridge.shutdownWorker();
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
