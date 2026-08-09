import Editor, { type OnMount } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";
import { useEffect, useRef } from "react";
import { useIDEStore } from "../store/ideStore";
import { registerSilqLanguage, updateSilqDiagnostics } from "../language/SilqLanguageService";

export function EditorPane(): JSX.Element {
  const { tabs, activeTab, theme, updateTab, astSelection } = useIDEStore();
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor>();
  const tab = tabs.find((item) => item.id === activeTab);
  const onMount: OnMount = (editor, monaco) => { editorRef.current = editor; configureSilq(monaco, editor); };
  useEffect(() => { const editor = editorRef.current; const model = editor?.getModel(); if (!editor || !model || !astSelection) return; const start = model.getPositionAt(astSelection.start), end = model.getPositionAt(astSelection.end); editor.setSelection({ startLineNumber: start.lineNumber, startColumn: start.column, endLineNumber: end.lineNumber, endColumn: end.column }); editor.revealPositionInCenter(start); }, [astSelection]);
  if (tab?.id === "welcome") return <Welcome />;
  return <div className="editor">{tab ? <Editor height="100%" language="silq" theme={theme === "dark" ? "silq-dark" : "silq-light"} value={tab.content} onChange={(value) => updateTab(tab.id, value ?? "")} onMount={onMount} options={{ minimap: { enabled: true }, fontSize: 14, tabSize: 2, automaticLayout: true, padding: { top: 16 }, scrollBeyondLastLine: false, bracketPairColorization: { enabled: true } }} /> : <div className="empty">Open a file to begin.</div>}</div>;
}

function Welcome(): JSX.Element {
  const { openTab, setProject, log } = useIDEStore();
  const open = async () => { const root = await window.silq?.openProject(); if (!root) return; setProject(root, await window.silq?.files(root) ?? []); log(`Opened workspace: ${root}`); };
  const create = () => openTab({ id: "untitled.silq", title: "untitled.silq", content: "fn main() {\n  let q = new Qubit[1];\n  H(q[0]);\n  return measure(q);\n}" });
  return <section className="welcome"><div className="welcome-mark">◇</div><h1>Silq Studio</h1><p>A focused workspace for quantum programming.</p><div className="welcome-actions"><button className="primary" onClick={create}>New Project</button><button onClick={open}>Open Project</button></div><div className="welcome-links"><button onClick={create}>Open Bell State sample</button><button onClick={() => window.open("https://docs.silq-lang.org")}>Documentation</button><button onClick={() => alert("Settings are available from the activity bar.")}>Settings</button></div></section>;
}

function configureSilq(monaco: typeof Monaco, editor: Monaco.editor.IStandaloneCodeEditor): void {
  registerSilqLanguage(monaco);
  void updateSilqDiagnostics(monaco, editor.getModel()!);
  editor.onDidChangeModelContent(() => { const model = editor.getModel(); if (model) void updateSilqDiagnostics(monaco, model); });
  editor.addAction({ id: "silq.run", label: "Run Silq Simulation", keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter], run: () => editor.focus() });
}
