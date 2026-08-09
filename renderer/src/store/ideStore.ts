import { create } from "zustand";

export interface EditorTab { id: string; title: string; path?: string; content: string; dirty?: boolean; }
interface IDEState { theme: "dark" | "light"; tabs: EditorTab[]; activeTab?: string; projectRoot?: string; files: FileNode[]; panel: "console" | "problems" | "terminal" | "simulation"; console: string[]; simulationOutput: string; astSelection?: { start: number; end: number }; setTheme(): void; openTab(tab: EditorTab): void; updateTab(id: string, content: string): void; closeTab(id: string): void; setProject(root: string, files: FileNode[]): void; setPanel(panel: IDEState["panel"]): void; setSimulationOutput(output: string): void; selectAst(range: { start: number; end: number }): void; log(message: string): void; }
export const starterCode = `// A Bell-state program in Silq\nfn bell() {\n  let q = new Qubit[2];\n  H(q[0]);\n  X(q[1]).controlled(q[0]);\n  return measure(q);\n}\n`;
export const useIDEStore = create<IDEState>((set) => ({
  theme: "dark", tabs: [{ id: "welcome", title: "Welcome", content: starterCode }], activeTab: "welcome", files: [], panel: "console", console: ["Silq Studio ready."], simulationOutput: "Run a circuit to inspect state-vector results.",
  setTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
  openTab: (tab) => set((state) => ({ tabs: state.tabs.some((item) => item.id === tab.id) ? state.tabs : [...state.tabs, tab], activeTab: tab.id })),
  updateTab: (id, content) => set((state) => ({ tabs: state.tabs.map((tab) => tab.id === id ? { ...tab, content, dirty: true } : tab) })),
  closeTab: (id) => set((state) => ({ tabs: state.tabs.filter((tab) => tab.id !== id), activeTab: state.activeTab === id ? state.tabs.find((tab) => tab.id !== id)?.id : state.activeTab })),
  setProject: (projectRoot, files) => set({ projectRoot, files }), setPanel: (panel) => set({ panel }), setSimulationOutput: (simulationOutput) => set({ simulationOutput }), selectAst: (astSelection) => set({ astSelection }), log: (message) => set((state) => ({ console: [...state.console, message] }))
}));
