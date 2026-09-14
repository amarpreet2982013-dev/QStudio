import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { AIService, type AssistantAction } from "../ai/AIService";
import { OpenAICompatibleProvider } from "../ai/OpenAICompatibleProvider";

let windowRef: BrowserWindow | undefined;
const workspaceRoots = new Set<string>();
const isDev = !app.isPackaged;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TREE_DEPTH = 20;
const MAX_TREE_ENTRIES = 10_000;
const MAX_TERMINAL_ARG_LENGTH = 2048;
const MAX_TERMINAL_OUTPUT = 50_000;
const TERMINAL_TIMEOUT_MS = 30_000;

async function createWindow(): Promise<void> {
  windowRef = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "Silq Studio",
    backgroundColor: "#10131a",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true }
  });
  windowRef.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  const allowedUrls = new Set<string>([pathToFileURL(path.join(__dirname, "../renderer/index.html")).toString()]);
  if (isDev) allowedUrls.add("http://127.0.0.1:5173/");
  if (developmentUrl) {
    try {
      const url = new URL(developmentUrl);
      if (url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "localhost")) allowedUrls.add(url.toString());
    } catch {
      // Fall back to the packaged renderer when the development URL is invalid.
    }
  }
  windowRef.webContents.on("will-navigate", (event, url) => {
    if (![...allowedUrls].some((allowed) => url === allowed || url.startsWith(`${allowed}/`))) event.preventDefault();
  });
  if (isDev && developmentUrl && allowedUrls.has(developmentUrl)) {
    await windowRef.loadURL(developmentUrl);
  } else if (isDev) {
    try {
      await windowRef.loadURL("http://127.0.0.1:5173");
    } catch {
      await windowRef.loadFile(path.join(__dirname, "../renderer/index.html"));
    }
  } else {
    await windowRef.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(async () => {
  ipcMain.handle("project:open", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    const selected = result.canceled ? undefined : result.filePaths[0];
    if (!selected) return undefined;
    const root = await assertWorkspaceRoot(selected);
    workspaceRoots.add(root);
    return root;
  });
  ipcMain.handle("project:files", async (_, root: unknown) => { const safeRoot = await assertWorkspace(typeof root === "string" ? root : ""); return readTree(safeRoot); });
  ipcMain.handle("file:read", async (_, file: unknown) => { const safeFile = await safeWorkspaceFile(file, false); const stat = await fs.stat(safeFile); if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("File is unavailable or exceeds the size limit."); return fs.readFile(safeFile, "utf8"); });
  ipcMain.handle("file:write", async (_, file: unknown, contents: unknown) => { if (typeof contents !== "string" || Buffer.byteLength(contents, "utf8") > MAX_FILE_BYTES) throw new Error("File contents are invalid or exceed the size limit."); const safeFile = await safeWorkspaceFile(file, true); return fs.writeFile(safeFile, contents, "utf8"); });
  ipcMain.handle("terminal:run", async (_, command: unknown, args: unknown, cwd: unknown) => runTerminal(command, args, cwd));
  ipcMain.handle("ai:complete", async (_, action: unknown, source: unknown, diagnostics?: unknown) => {
    if (!isAssistantAction(action) || typeof source !== "string" || (diagnostics !== undefined && typeof diagnostics !== "string")) throw new Error("Invalid AI request.");
    return new AIService(new OpenAICompatibleProvider()).execute(action, source, diagnostics);
  });
  await createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

async function readTree(root: string, depth = 0, count = { value: 0 }): Promise<FileNode[]> {
  if (depth > MAX_TREE_DEPTH) throw new Error("Project is too deeply nested.");
  const entries = await fs.readdir(root, { withFileTypes: true });
  const visible = entries.filter((entry) => !entry.name.startsWith(".") && !entry.isSymbolicLink());
  count.value += visible.length;
  if (count.value > MAX_TREE_ENTRIES) throw new Error("Project contains too many entries.");
  return Promise.all(visible.map(async (entry): Promise<FileNode> => {
    const itemPath = path.join(root, entry.name);
    return { name: entry.name, path: itemPath, kind: entry.isDirectory() ? "directory" : "file", children: entry.isDirectory() ? await readTree(itemPath, depth + 1, count) : undefined };
  }));
}

interface FileNode { name: string; path: string; kind: "file" | "directory"; children?: FileNode[]; }

async function runTerminal(command: unknown, args: unknown, cwd: unknown): Promise<{ code: number; output: string }> {
  const allowed = new Set(["git", "node", "pnpm", "python", "python3"]);
  if (typeof command !== "string" || !allowed.has(command) || !Array.isArray(args) || !args.every((arg): arg is string => typeof arg === "string" && arg.length < MAX_TERMINAL_ARG_LENGTH) || typeof cwd !== "string") throw new Error("Invalid terminal request.");
  const root = await assertWorkspace(cwd);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, shell: false, env: safeChildEnvironment() });
    let output = "";
    const append = (data: Buffer): void => { output = `${output}${data.toString()}`.slice(-MAX_TERMINAL_OUTPUT); };
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("Terminal command timed out.")); }, TERMINAL_TIMEOUT_MS);
    child.stdout.on("data", append); child.stderr.on("data", append);
    child.on("error", (error) => { clearTimeout(timer); reject(new Error(`Terminal command failed: ${error.message}`)); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code: code ?? 1, output }); });
  });
}

async function assertWorkspace(target: string): Promise<string> {
  if (!target || target.includes("\0")) throw new Error("Invalid workspace path.");
  const resolved = await fs.realpath(target).catch(() => { throw new Error("Workspace path is unavailable."); });
  if (![...workspaceRoots].some((workspace) => resolved === workspace || resolved.startsWith(`${workspace}${path.sep}`))) throw new Error("Access is restricted to an open workspace.");
  return resolved;
}

async function safeWorkspaceFile(file: unknown, forWrite: boolean): Promise<string> {
  if (typeof file !== "string" || !file || file.includes("\0")) throw new Error("Invalid file path.");
  if (forWrite) {
    const parent = await assertWorkspace(path.dirname(file));
    const candidate = path.join(parent, path.basename(file));
    const existing = await fs.lstat(candidate).catch(() => undefined);
    if (existing?.isSymbolicLink() || existing?.isDirectory()) throw new Error("File path is unavailable.");
    return candidate;
  }
  return assertWorkspace(file);
}

async function assertWorkspaceRoot(target: string): Promise<string> {
  if (!target || target.includes("\0")) throw new Error("Invalid workspace path.");
  const root = await fs.realpath(target).catch(() => { throw new Error("Workspace path is unavailable."); });
  const stat = await fs.stat(root);
  if (!stat.isDirectory()) throw new Error("Workspace path is not a directory.");
  return root;
}

function safeChildEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, HOME: process.env.HOME, USER: process.env.USER, LANG: process.env.LANG, LC_ALL: process.env.LC_ALL };
  return env;
}

function isAssistantAction(value: unknown): value is AssistantAction {
  return typeof value === "string" && ["explain", "optimize", "generate", "fix", "silq-to-qiskit", "silq-to-openqasm", "silq-to-qsharp", "document", "test"].includes(value);
}
