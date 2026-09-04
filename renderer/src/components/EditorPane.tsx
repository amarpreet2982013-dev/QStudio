import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { useIDEStore } from "../store/ideStore";
import { registerSilqLanguage, updateSilqDiagnostics } from "../language/SilqLanguageService";
import { SilqCompiler } from "../../../backend/src/compiler/SilqCompiler";
import { EXAMPLES } from "../examples/examplePrograms";

const compiler = new SilqCompiler();

export function EditorPane(): JSX.Element {
  const {
    tabs,
    activeTab,
    theme,
    updateTab,
    astSelection,
    selectedDiagnostic,
    setCompileStatus,
    setDiagnostics,
    setLastValidCircuit,
  } = useIDEStore();

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor>();
  const tab = tabs.find((item) => item.id === activeTab);
  const source = tab?.content ?? "";

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    configureSilq(monaco, editor);
  };

  // Debounced compilation pipeline
  useEffect(() => {
    if (!tab || tab.id === "welcome") return;

    setCompileStatus("Compiling...");
    const timer = window.setTimeout(async () => {
      try {
        const result = await compiler.analyze(source);
        setDiagnostics(result.diagnostics);

        if (editorRef.current) {
          const model = editorRef.current.getModel();
          if (model && (window as unknown as { monaco?: typeof Monaco }).monaco) {
            void updateSilqDiagnostics((window as unknown as { monaco: typeof Monaco }).monaco, model);
          }
        }

        if (result.diagnostics.length === 0) {
          setCompileStatus("Compiled");
          setLastValidCircuit(result.circuit);
        } else {
          setCompileStatus("Error");
        }
      } catch (err) {
        setCompileStatus("Error");
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [source, tab, setCompileStatus, setDiagnostics, setLastValidCircuit]);

  // Jump to AST selection
  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !astSelection) return;

    const start = model.getPositionAt(astSelection.start);
    const end = model.getPositionAt(astSelection.end);
    editor.setSelection({
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
    });
    editor.revealPositionInCenter(start);
  }, [astSelection]);

  // Jump to selected diagnostic location
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !selectedDiagnostic) return;

    const line = selectedDiagnostic.line;
    const col = selectedDiagnostic.column;
    const endLine = selectedDiagnostic.endLine ?? line;
    const endCol = selectedDiagnostic.endColumn ?? (col + 1);

    editor.setSelection({
      startLineNumber: line,
      startColumn: col,
      endLineNumber: endLine,
      endColumn: endCol,
    });
    editor.revealLineInCenter(line);
    editor.focus();
  }, [selectedDiagnostic]);

  if (tab?.id === "welcome") return <Welcome />;

  return (
    <div className="editor">
      {tab ? (
        <Editor
          height="100%"
          language="silq"
          theme={theme === "dark" ? "silq-dark" : "silq-light"}
          value={tab.content}
          onChange={(value) => updateTab(tab.id, value ?? "")}
          onMount={onMount}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 16 },
            scrollBeyondLastLine: false,
            bracketPairColorization: { enabled: true },
          }}
        />
      ) : (
        <div className="empty">Open a file to begin.</div>
      )}
    </div>
  );
}

function Welcome(): JSX.Element {
  const { openTab, setProject, log, compileStatus } = useIDEStore();

  const open = async () => {
    const root = await window.silq?.openProject();
    if (!root) return;
    setProject(root, (await window.silq?.files(root)) ?? []);
    log(`Opened workspace: ${root}`);
  };

  const createNew = () =>
    openTab({
      id: "untitled.silq",
      title: "untitled.silq",
      content: `fn main() {\n  let q = new Qubit[2];\n  H(q[0]);\n  X(q[1]).controlled(q[0]);\n  return measure(q);\n}`,
    });

  const loadExample = (title: string, code: string) => {
    openTab({
      id: `example-${title.toLowerCase().replace(/\s+/g, "-")}.silq`,
      title: `${title}.silq`,
      content: code,
    });
  };

  return (
    <section className="welcome">
      <div className="welcome-header">
        <div className="welcome-mark">◇</div>
        <h1>Silq Studio</h1>
        <p className="welcome-tagline">
          Quantum development environment for writing, visualizing, simulating, and debugging quantum programs.
        </p>
      </div>

      <div className="welcome-grid">
        <div className="welcome-card">
          <h3>Quick Start</h3>
          <div className="welcome-actions">
            <button className="primary" onClick={createNew}>
              New Project
            </button>
            <button onClick={open}>Open Project</button>
            <button onClick={() => window.open("https://docs.silq-lang.org")}>Documentation</button>
          </div>
        </div>

        <div className="welcome-card">
          <h3>Environment Status</h3>
          <div className="status-pills">
            <span className="pill">Compiler: <strong>{compileStatus}</strong></span>
            <span className="pill">Simulator: <strong>State-Vector (1–12 Qubits)</strong></span>
            <span className="pill">Debugger: <strong>Quantum IR Step Debugger</strong></span>
          </div>
        </div>
      </div>

      <div className="welcome-card examples-card">
        <h3>Built-in Quantum Examples</h3>
        <p className="muted">Click any example to load it directly into the editor:</p>
        <div className="examples-grid">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              className="example-btn"
              onClick={() => loadExample(ex.name, ex.code)}
              title={ex.description}
            >
              <span className="ex-title">{ex.name}</span>
              <span className="ex-desc">{ex.description}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function configureSilq(monaco: typeof Monaco, editor: Monaco.editor.IStandaloneCodeEditor): void {
  (window as unknown as { monaco: typeof Monaco }).monaco = monaco;
  registerSilqLanguage(monaco);
  void updateSilqDiagnostics(monaco, editor.getModel()!);
  editor.onDidChangeModelContent(() => {
    const model = editor.getModel();
    if (model) void updateSilqDiagnostics(monaco, model);
  });
  editor.addAction({
    id: "silq.run",
    label: "Run Silq Simulation",
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => editor.focus(),
  });
}
