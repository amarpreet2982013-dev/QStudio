import { useState } from "react";
import { EditorPane } from "./components/EditorPane";
import { Explorer } from "./components/Explorer";
import { CircuitPanel } from "./components/CircuitPanel";
import { OutputPanel } from "./components/OutputPanel";
import { Assistant } from "./components/Assistant";
import { useIDEStore } from "./store/ideStore";

export function Studio(): JSX.Element {
  const { theme, setTheme, tabs, activeTab, closeTab } = useIDEStore();
  const [assistantOpen, setAssistantOpen] = useState(true);
  return <main className={`studio ${theme}`}>
    <header><div className="brand"><span>◇</span> SILQ STUDIO <small>QUANTUM IDE</small></div><nav><button onClick={setTheme}>{theme === "dark" ? "☀ Light" : "◐ Dark"}</button><button onClick={() => setAssistantOpen(!assistantOpen)}>AI Assistant</button></nav></header>
    <section className="workspace">
      <aside className="activity"><button title="Explorer">▱</button><button title="Search">⌕</button><button title="Extensions">▦</button><button title="Settings">⚙</button></aside>
      <Explorer />
      <section className="center"><div className="tabs">{tabs.map((tab) => <div key={tab.id} className={`tab ${tab.id === activeTab ? "active" : ""}`}><span>{tab.dirty ? "● " : ""}{tab.title}</span>{tabs.length > 1 && <button onClick={() => closeTab(tab.id)}>×</button>}</div>)}</div><EditorPane /><OutputPanel /></section>
      <CircuitPanel />
      {assistantOpen && <Assistant />}
    </section>
    <footer><span>Silq</span><span>UTF-8</span><span>Ln 1, Col 1</span><span>State-vector simulator connected</span></footer>
  </main>;
}
