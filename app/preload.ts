import { contextBridge, ipcRenderer } from "electron";
import type { AssistantAction } from "../ai/AIService";

contextBridge.exposeInMainWorld("silq", {
  openProject: (): Promise<string | undefined> => ipcRenderer.invoke("project:open"),
  files: (root: string) => ipcRenderer.invoke("project:files", root),
  readFile: (file: string): Promise<string> => ipcRenderer.invoke("file:read", file),
  writeFile: (file: string, contents: string): Promise<void> => ipcRenderer.invoke("file:write", file, contents),
  runTerminal: (command: string, args: string[], cwd: string): Promise<{ code: number; output: string }> => ipcRenderer.invoke("terminal:run", command, args, cwd),
  completeAI: (action: AssistantAction, source: string, diagnostics?: string): Promise<string> => ipcRenderer.invoke("ai:complete", action, source, diagnostics)
});
