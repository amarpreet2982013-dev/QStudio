import { create } from "zustand";
import type { CircuitModel, Diagnostic } from "../../../backend/src/contracts";
import { defaultLanguageRegistry } from "../../../backend/src/languages";

export interface EditorTab {
  id: string;
  title: string;
  path?: string;
  content: string;
  language?: string;
  dirty?: boolean;
}

export type ShotCount = 100 | 512 | 1024 | 2048 | 4096;
export type CompileStatus = "Ready" | "Compiling..." | "Compiled" | "Error";

interface IDEState {
  theme: "dark" | "light";
  tabs: EditorTab[];
  activeTab?: string;
  projectRoot?: string;
  files: FileNode[];
  panel: "console" | "problems" | "terminal" | "simulation" | "debugger";
  console: string[];
  simulationOutput: string;
  astSelection?: { start: number; end: number };
  compileStatus: CompileStatus;
  diagnostics: Diagnostic[];
  shots: ShotCount;
  circuitZoom: number;
  selectedGateIndex: number | null;
  selectedDiagnostic: Diagnostic | null;
  lastValidCircuit: CircuitModel;
  setTheme(): void;
  openTab(tab: EditorTab): void;
  updateTab(id: string, content: string): void;
  setTabLanguage(id: string, language: string): void;
  closeTab(id: string): void;
  setProject(root: string, files: FileNode[]): void;
  setPanel(panel: IDEState["panel"]): void;
  setSimulationOutput(output: string): void;
  selectAst(range: { start: number; end: number }): void;
  log(message: string): void;
  setCompileStatus(status: CompileStatus): void;
  setDiagnostics(diagnostics: Diagnostic[]): void;
  setShots(shots: ShotCount): void;
  setCircuitZoom(zoom: number | ((prev: number) => number)): void;
  setSelectedGateIndex(index: number | null): void;
  setSelectedDiagnostic(diagnostic: Diagnostic | null): void;
  setLastValidCircuit(circuit: CircuitModel): void;
}

export const starterCode = `// A Bell-state program in Silq
fn bell() {
  let q = new Qubit[2];
  H(q[0]);
  X(q[1]).controlled(q[0]);
  return measure(q);
}
`;

const defaultCircuit: CircuitModel = {
  name: "Bell State",
  qubits: 2,
  operations: [
    { gate: "H", targets: [0], moment: 0 },
    { gate: "CX", targets: [0, 1], moment: 1 },
  ],
};

export const useIDEStore = create<IDEState>((set) => ({
  theme: "dark",
  tabs: [{ id: "welcome", title: "Welcome", content: starterCode, language: "silq" }],
  activeTab: "welcome",
  files: [],
  panel: "console",
  console: ["QStudio Quantum IDE ready."],
  simulationOutput: "Run a circuit to inspect state-vector results.",
  compileStatus: "Ready",
  diagnostics: [],
  shots: 1024,
  circuitZoom: 1.0,
  selectedGateIndex: null,
  selectedDiagnostic: null,
  lastValidCircuit: defaultCircuit,
  setTheme: () => set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
  openTab: (tab) =>
    set((state) => {
      const language = tab.language ?? defaultLanguageRegistry.detect(tab.path ?? tab.title, tab.content).id;
      const normalizedTab = { ...tab, language };
      return {
        tabs: state.tabs.some((item) => item.id === tab.id)
          ? state.tabs.map((item) => (item.id === tab.id ? { ...item, ...normalizedTab } : item))
          : [...state.tabs, normalizedTab],
        activeTab: tab.id,
      };
    }),
  updateTab: (id, content) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              content,
              dirty: true,
              // If language is not manually forced, allow auto detection on header change
              language: tab.language ?? defaultLanguageRegistry.detect(tab.path ?? tab.title, content).id,
            }
          : tab
      ),
    })),
  setTabLanguage: (id, language) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, language } : tab)),
    })),
  closeTab: (id) =>
    set((state) => ({
      tabs: state.tabs.filter((tab) => tab.id !== id),
      activeTab: state.activeTab === id ? state.tabs.find((tab) => tab.id !== id)?.id : state.activeTab,
    })),
  setProject: (projectRoot, files) => set({ projectRoot, files }),
  setPanel: (panel) => set({ panel }),
  setSimulationOutput: (simulationOutput) => set({ simulationOutput }),
  selectAst: (astSelection) => set({ astSelection }),
  log: (message) => set((state) => ({ console: [...state.console, message] })),
  setCompileStatus: (compileStatus) => set({ compileStatus }),
  setDiagnostics: (diagnostics) => set({ diagnostics }),
  setShots: (shots) => set({ shots }),
  setCircuitZoom: (zoom) => set((state) => ({ circuitZoom: typeof zoom === "function" ? zoom(state.circuitZoom) : zoom })),
  setSelectedGateIndex: (selectedGateIndex) => set({ selectedGateIndex }),
  setSelectedDiagnostic: (selectedDiagnostic) => set({ selectedDiagnostic }),
  setLastValidCircuit: (lastValidCircuit) => set({ lastValidCircuit }),
}));
