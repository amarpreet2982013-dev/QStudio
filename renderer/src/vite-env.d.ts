/// <reference types="vite/client" />
interface FileNode { name: string; path: string; kind: "file" | "directory"; children?: FileNode[]; }
type AssistantAction = "explain" | "optimize" | "generate" | "fix" | "silq-to-qiskit" | "silq-to-openqasm" | "silq-to-qsharp" | "document" | "test";
interface Window { silq?: { openProject(): Promise<string | undefined>; files(root: string): Promise<FileNode[]>; readFile(file: string): Promise<string>; writeFile(file: string, contents: string): Promise<void>; runTerminal(command: string, args: string[], cwd: string): Promise<{ code: number; output: string }>; completeAI(action: AssistantAction, source: string, diagnostics?: string): Promise<string>; }; }
