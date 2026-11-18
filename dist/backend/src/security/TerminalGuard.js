"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ARG_COUNT = exports.MAX_ARG_LENGTH = exports.MAX_OUTPUT_CHARS = exports.DEFAULT_TERMINAL_TIMEOUT_MS = exports.ALLOWED_COMMANDS = void 0;
exports.sanitizeEnvironment = sanitizeEnvironment;
exports.runConstrainedTerminal = runConstrainedTerminal;
const node_child_process_1 = require("node:child_process");
const node_path_1 = __importDefault(require("node:path"));
const WorkspaceGuard_1 = require("./WorkspaceGuard");
exports.ALLOWED_COMMANDS = new Set(["git", "node", "pnpm", "python", "python3"]);
exports.DEFAULT_TERMINAL_TIMEOUT_MS = 30_000;
exports.MAX_OUTPUT_CHARS = 100_000;
exports.MAX_ARG_LENGTH = 2048;
exports.MAX_ARG_COUNT = 100;
const SENSITIVE_ENV_PATTERN = /(?:KEY|TOKEN|SECRET|PASS|AUTH|CREDENTIAL|PRIVATE|SILQ_AI|OPENAI|ANTHROPIC|GITHUB|NPM|AWS|GOOGLE|NODE_OPTIONS|ELECTRON)/i;
/**
 * Builds a sanitized environment for terminal child processes,
 * removing sensitive API keys, auth tokens, and Electron/Node debugging hooks.
 */
function sanitizeEnvironment(rawEnv = process.env) {
    const allowedKeys = new Set([
        "PATH",
        "HOME",
        "USER",
        "LOGNAME",
        "TMPDIR",
        "TEMP",
        "TMP",
        "LANG",
        "LC_ALL",
        "LC_CTYPE",
        "TERM",
        "SHELL",
        "CI",
    ]);
    const cleanEnv = {};
    for (const [key, value] of Object.entries(rawEnv)) {
        if (!value)
            continue;
        if (allowedKeys.has(key)) {
            cleanEnv[key] = value;
            continue;
        }
        // Block any variable matching sensitive patterns
        if (!SENSITIVE_ENV_PATTERN.test(key)) {
            cleanEnv[key] = value;
        }
    }
    // Ensure sensitive variables are never present
    for (const key of Object.keys(cleanEnv)) {
        if (SENSITIVE_ENV_PATTERN.test(key)) {
            delete cleanEnv[key];
        }
    }
    return cleanEnv;
}
/**
 * Validates and runs commands in the integrated terminal within workspace boundaries.
 *
 * RESIDUAL RISK NOTE:
 * Executing user-invoked interpreters such as Python or Node inside the terminal
 * grants the spawned process the operating system privileges of the current user.
 * While this guard enforces workspace path confinement, environment stripping, execution
 * timeouts, and bounded buffer outputs, it cannot prevent user scripts from executing
 * arbitrary native system calls without OS-level sandboxing (e.g., containerization or seccomp).
 */
async function runConstrainedTerminal(command, args, cwd, options = {}) {
    if (typeof command !== "string" || !command.trim()) {
        throw new Error("Invalid command: command must be a non-empty string.");
    }
    const normalizedCommand = command.trim();
    // Command must not contain path separators or traversal characters
    if (normalizedCommand.includes(node_path_1.default.sep) || normalizedCommand.includes("/") || normalizedCommand.includes("\\")) {
        throw new Error(`Command '${command}' contains path separators and is not permitted.`);
    }
    if (!exports.ALLOWED_COMMANDS.has(normalizedCommand)) {
        throw new Error(`'${normalizedCommand}' is not enabled in the integrated terminal.`);
    }
    if (!Array.isArray(args) || args.length > exports.MAX_ARG_COUNT) {
        throw new Error(`Invalid arguments: expected array with up to ${exports.MAX_ARG_COUNT} arguments.`);
    }
    for (const arg of args) {
        if (typeof arg !== "string" || arg.length > exports.MAX_ARG_LENGTH || arg.includes("\0")) {
            throw new Error("Invalid terminal arguments: argument exceeds size limit or contains null bytes.");
        }
    }
    // Validate working directory is inside an open workspace
    const validatedCwd = await WorkspaceGuard_1.workspaceGuard.validateWithinWorkspace(cwd);
    const timeoutMs = options.timeoutMs ?? exports.DEFAULT_TERMINAL_TIMEOUT_MS;
    const maxOutput = options.maxOutputChars ?? exports.MAX_OUTPUT_CHARS;
    const cleanEnv = sanitizeEnvironment(options.env ?? process.env);
    return new Promise((resolve, reject) => {
        let child;
        let forceKillTimer;
        let output = "";
        let truncated = false;
        let isSettled = false;
        // Set execution timeout
        const timer = setTimeout(() => {
            if (isSettled)
                return;
            child?.kill("SIGTERM");
            forceKillTimer = setTimeout(() => {
                try {
                    child?.kill("SIGKILL");
                }
                catch {
                    // Process already closed
                }
            }, 2000);
            settleReject(new Error(`Terminal command timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
        const cleanup = () => {
            clearTimeout(timer);
            if (forceKillTimer)
                clearTimeout(forceKillTimer);
        };
        const settleReject = (err) => {
            if (isSettled)
                return;
            isSettled = true;
            cleanup();
            reject(err);
        };
        const settleResolve = (result) => {
            if (isSettled)
                return;
            isSettled = true;
            cleanup();
            resolve(result);
        };
        if (options.signal?.aborted) {
            settleReject(new Error("Terminal command was aborted before execution."));
            return;
        }
        try {
            child = (0, node_child_process_1.spawn)(normalizedCommand, args, {
                cwd: validatedCwd,
                shell: false,
                env: cleanEnv,
            });
        }
        catch (err) {
            settleReject(err instanceof Error ? err : new Error(String(err)));
            return;
        }
        if (options.signal) {
            options.signal.addEventListener("abort", () => {
                child?.kill("SIGTERM");
                settleReject(new Error("Terminal execution cancelled by user."));
            });
        }
        const appendData = (data) => {
            if (truncated)
                return;
            const str = data.toString("utf8");
            if (output.length + str.length > maxOutput) {
                output += str.slice(0, maxOutput - output.length);
                output += "\n[Output truncated: maximum buffer limit reached]\n";
                truncated = true;
            }
            else {
                output += str;
            }
        };
        child.stdout?.on("data", appendData);
        child.stderr?.on("data", appendData);
        child.on("error", (err) => {
            settleReject(err);
        });
        child.on("close", (code) => {
            settleResolve({
                code: code ?? 1,
                output,
            });
        });
    });
}
