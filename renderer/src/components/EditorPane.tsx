import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { useIDEStore } from "../store/ideStore";
import { registerAllQuantumLanguages, updateQuantumDiagnostics } from "../language/QuantumMonacoService";
import { defaultLanguageRegistry } from "../../../backend/src/languages";
import { EXAMPLES } from "../examples/examplePrograms";

export function EditorPane(): JSX.Element {
  const {
    tabs,
    activeTab,
    theme,
    updateTab,
    setTabLanguage,
    astSelection,
    selectedDiagnostic,
    setCompileStatus,
    setDiagnostics,
    setLastValidCircuit,
  } = useIDEStore();

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor>();
  const tab = tabs.find((item) => item.id === activeTab);
  const source = tab?.content ?? "";

  const adapter = tab
    ? tab.language
      ? defaultLanguageRegistry.get(tab.language) ?? defaultLanguageRegistry.detect(tab.path ?? tab.title, source)
      : defaultLanguageRegistry.detect(tab.path ?? tab.title, source)
    : defaultLanguageRegistry.get("silq")!;

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    (window as unknown as { monaco: typeof Monaco }).monaco = monaco;
    registerAllQuantumLanguages(monaco);
    const model = editor.getModel();
    if (model) {
      void updateQuantumDiagnostics(monaco, model, adapter);
    }
  };

  // Debounced compilation pipeline
  useEffect(() => {
    if (!tab || tab.id === "welcome") return;

    setCompileStatus("Compiling...");
    const timer = window.setTimeout(async () => {
      try {
        const result = await adapter.compile(source);
        setDiagnostics(result.diagnostics);

        if (editorRef.current) {
          const model = editorRef.current.getModel();
          if (model && (window as unknown as { monaco?: typeof Monaco }).monaco) {
            void updateQuantumDiagnostics((window as unknown as { monaco: typeof Monaco }).monaco, model, adapter);
          }
        }

        if (result.diagnostics.length === 0) {
          setCompileStatus("Compiled");
          setLastValidCircuit(result.circuit);
        } else {
          setCompileStatus("Error");
        }
      } catch {
        setCompileStatus("Error");
      }
    }, 200);

    return () => window.clearTimeout(timer);
  }, [source, tab, adapter, setCompileStatus, setDiagnostics, setLastValidCircuit]);

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
    const endCol = selectedDiagnostic.endColumn ?? col + 1;

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

  const supportedLanguages = defaultLanguageRegistry.list();

  return (
    <div className="editor" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {tab && (
        <div
          className="editor-header-bar"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "4px 12px",
            background: theme === "dark" ? "#141822" : "#f1f5f9",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            fontSize: "12px",
          }}
        >
          <span style={{ opacity: 0.8 }}>{tab.title}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ opacity: 0.7 }}>Language:</label>
            <select
              value={adapter.id}
              onChange={(e) => setTabLanguage(tab.id, e.target.value)}
              style={{
                background: theme === "dark" ? "#1e2433" : "#ffffff",
                color: "inherit",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "4px",
                padding: "2px 6px",
                fontSize: "12px",
              }}
              aria-label="Quantum Language Selector"
            >
              {supportedLanguages.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.name} ({lang.extensions.join(", ")})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>
        {tab ? (
          <Editor
            height="100%"
            language={adapter.monacoLanguageId}
            theme={theme === "dark" ? "silq-dark" : "silq-light"}
            value={tab.content}
            onChange={(value) => updateTab(tab.id, value ?? "")}
            onMount={onMount}
            options={{
              minimap: { enabled: true },
              fontSize: 14,
              tabSize: 2,
              automaticLayout: true,
              padding: { top: 12 },
              scrollBeyondLastLine: false,
              bracketPairColorization: { enabled: true },
            }}
          />
        ) : (
          <div className="empty">Open a file to begin.</div>
        )}
      </div>
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

  const createNew = (langId = "silq") => {
    const adapter = defaultLanguageRegistry.get(langId) ?? defaultLanguageRegistry.get("silq")!;
    const ext = adapter.extensions[0] ?? ".silq";
    const example = adapter.examplePrograms?.[0];
    openTab({
      id: `untitled${ext}`,
      title: `untitled${ext}`,
      language: adapter.id,
      content:
        example?.code ??
        `// A Bell-state program in ${adapter.name}\nfn bell() {\n  let q = new Qubit[2];\n  H(q[0]);\n  X(q[1]).controlled(q[0]);\n  return measure(q);\n}`,
    });
  };

  const loadExample = (title: string, code: string, langId = "silq") => {
    const adapter = defaultLanguageRegistry.get(langId) ?? defaultLanguageRegistry.detect(undefined, code);
    const ext = adapter.extensions[0] ?? ".silq";
    openTab({
      id: `example-${title.toLowerCase().replace(/\s+/g, "-")}${ext}`,
      title: `${title}${ext}`,
      language: adapter.id,
      content: code,
    });
  };

  // Multi-language Bell State Examples
  const bellExamples = [
    {
      id: "bell-silq",
      name: "Bell State (Silq)",
      lang: "silq",
      desc: "Silq quantum function with controlled-X gate",
      code: `fn bell() {\n  let q = new Qubit[2];\n  H(q[0]);\n  X(q[1]).controlled(q[0]);\n  return measure(q);\n}`,
    },
    {
      id: "bell-qasm3",
      name: "Bell State (OpenQASM 3.0)",
      lang: "openqasm3",
      desc: "OpenQASM 3.0 syntax with stdgates.inc and measure statement",
      code: `OPENQASM 3.0;\ninclude "stdgates.inc";\n\nqubit[2] q;\nbit[2] c;\n\nh q[0];\ncx q[0], q[1];\n\nmeasure q[0] -> c[0];\nmeasure q[1] -> c[1];\n`,
    },
    {
      id: "bell-qsharp",
      name: "Bell State (Microsoft Q#)",
      lang: "qsharp",
      desc: "Q# operation with use qubit allocation and ResetAll",
      code: `namespace QStudio.Examples {\n    open Microsoft.Quantum.Intrinsic;\n\n    operation BellState() : Result[] {\n        use q = Qubit[2];\n\n        H(q[0]);\n        CNOT(q[0], q[1]);\n\n        let results = [M(q[0]), M(q[1])];\n\n        ResetAll(q);\n        return results;\n    }\n}\n`,
    },
    {
      id: "bell-quil",
      name: "Bell State (Quil)",
      lang: "quil",
      desc: "Rigetti Quil syntax with DECLARE and integer qubit indexing",
      code: `DECLARE ro BIT[2]\n\nH 0\nCNOT 0 1\n\nMEASURE 0 ro[0]\nMEASURE 1 ro[1]\n`,
    },
    {
      id: "bell-qasm2",
      name: "Bell State (OpenQASM 2.0)",
      lang: "openqasm2",
      desc: "OpenQASM 2.0 syntax with qreg and creg declarations",
      code: `OPENQASM 2.0;\ninclude "qelib1.inc";\n\nqreg q[2];\ncreg c[2];\n\nh q[0];\ncx q[0],q[1];\n\nmeasure q[0] -> c[0];\nmeasure q[1] -> c[1];\n`,
    },
  ];

  return (
    <section className="welcome">
      <div className="welcome-header">
        <div className="welcome-mark">◇</div>
        <h1>QStudio</h1>
        <p className="welcome-tagline">
          Quantum development environment supporting Silq, OpenQASM 3.0, Microsoft Q#, Quil, and OpenQASM 2.0 with unified simulation and visualization.
        </p>
      </div>

      <div className="welcome-grid">
        <div className="welcome-card">
          <h3>Quick Start</h3>
          <div className="welcome-actions">
            <button className="primary" onClick={() => createNew("silq")}>
              New Project (.silq)
            </button>
            <button onClick={() => createNew("openqasm3")}>New OpenQASM 3</button>
            <button onClick={() => createNew("qsharp")}>New Q#</button>
            <button onClick={() => createNew("quil")}>New Quil</button>
            <button onClick={open}>Open Folder</button>
          </div>
        </div>

        <div className="welcome-card">
          <h3>Environment Status</h3>
          <div className="status-pills">
            <span className="pill">
              Compiler: <strong>{compileStatus}</strong>
            </span>
            <span className="pill">
              Simulator: <strong>State-Vector (1–12 Qubits)</strong>
            </span>
            <span className="pill">
              Languages: <strong>5 Quantum Languages</strong>
            </span>
            <span className="pill">
              Debugger: <strong>Quantum IR Step Debugger</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="welcome-card examples-card">
        <h3>Multi-Language Bell State Benchmarks</h3>
        <p className="muted">Run the canonical Bell state in any supported quantum language:</p>
        <div className="examples-grid" style={{ marginBottom: "20px" }}>
          {bellExamples.map((ex) => (
            <button
              key={ex.id}
              className="example-btn"
              onClick={() => loadExample(ex.name, ex.code, ex.lang)}
              title={ex.desc}
            >
              <span className="ex-title">{ex.name}</span>
              <span className="ex-desc">{ex.desc}</span>
            </button>
          ))}
        </div>

        <h3>Silq Quantum Examples</h3>
        <p className="muted">Click any example to load it directly into the editor:</p>
        <div className="examples-grid">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.id}
              className="example-btn"
              onClick={() => loadExample(ex.name, ex.code, "silq")}
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
