import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { AIService, type AssistantAction } from "../ai/AIService";
import { OpenAICompatibleProvider } from "../ai/OpenAICompatibleProvider";

let windowRef: BrowserWindow | undefined;
const workspaceRoots = new Set<string>();
const isDev = !app.isPackaged;

async function createWindow(): Promise<void> {
  windowRef = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: "Silq Studio",
    backgroundColor: "#10131a",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true }
  });
  if (isDev) await windowRef.loadURL("http://127.0.0.1:5173");
  else await windowRef.loadFile(path.join(__dirname, "../renderer/index.html"));
}

app.whenReady().then(async () => {
  ipcMain.handle("project:open", async () => {
    const result = await dialog.showOpenDialog({ properties: ["openDirectory", "createDirectory"] });
    const root = result.canceled ? undefined : result.filePaths[0]; if (root) workspaceRoots.add(path.resolve(root)); return root;
  });
  ipcMain.handle("project:files", async (_, root: string) => { assertWorkspace(root); return readTree(root); });
  ipcMain.handle("file:read", (_, file: string) => { assertWorkspace(file); return fs.readFile(file, "utf8"); });
  ipcMain.handle("file:write", (_, file: string, contents: string) => { assertWorkspace(file); return fs.writeFile(file, contents, "utf8"); });
  ipcMain.handle("terminal:run", async (_, command: string, args: string[], cwd: string) => runTerminal(command, args, cwd));
  ipcMain.handle("ai:complete", async (_, action: AssistantAction, source: string, diagnostics?: string) => new AIService(new OpenAICompatibleProvider()).execute(action, source, diagnostics));
  await createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

async function readTree(root: string): Promise<FileNode[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return Promise.all(entries.filter((entry) => !entry.name.startsWith(".")).map(async (entry): Promise<FileNode> => {
    const itemPath = path.join(root, entry.name);
    return { name: entry.name, path: itemPath, kind: entry.isDirectory() ? "directory" : "file", children: entry.isDirectory() ? await readTree(itemPath) : undefined };
  }));
}

interface FileNode { name: string; path: string; kind: "file" | "directory"; children?: FileNode[]; }

function runTerminal(command: string, args: string[], cwd: string): Promise<{ code: number; output: string }> {
  const allowed = new Set(["git", "node", "pnpm", "python", "python3"]); const root = path.resolve(cwd);
  if (!allowed.has(command)) return Promise.reject(new Error(`'${command}' is not enabled in the integrated terminal.`));
  try { assertWorkspace(root); } catch (error) { return Promise.reject(error); }
  if (!args.every((arg) => typeof arg === "string" && arg.length < 2048)) return Promise.reject(new Error("Invalid terminal arguments."));
  return new Promise((resolve, reject) => { const child = spawn(command, args, { cwd: root, shell: false, env: process.env }); let output = ""; child.stdout.on("data", (data: Buffer) => { output += data.toString(); }); child.stderr.on("data", (data: Buffer) => { output += data.toString(); }); child.on("error", reject); child.on("close", (code) => resolve({ code: code ?? 1, output: output.slice(-50_000) })); });
}

function assertWorkspace(target: string): void { const resolved = path.resolve(target); if (![...workspaceRoots].some((workspace) => resolved === workspace || resolved.startsWith(`${workspace}${path.sep}`))) throw new Error("Access is restricted to an open workspace."); }
