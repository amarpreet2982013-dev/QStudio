import { useState } from "react";
import { EditorPane } from "./components/EditorPane";
import { Explorer } from "./components/Explorer";
import { CircuitPanel } from "./components/CircuitPanel";
import { OutputPanel } from "./components/OutputPanel";
import { Assistant } from "./components/Assistant";
import { useIDEStore } from "./store/ideStore";
import { defaultLanguageRegistry } from "../../backend/src/languages";

export function Studio(): JSX.Element {
  const { theme, setTheme, tabs, activeTab, closeTab, openTab, compileStatus } = useIDEStore();
  const [assistantOpen, setAssistantOpen] = useState(true);

  const activeTabObj = tabs.find((t) => t.id === activeTab);
  const activeAdapter = activeTabObj
    ? activeTabObj.language
      ? defaultLanguageRegistry.get(activeTabObj.language) ?? defaultLanguageRegistry.detect(activeTabObj.path ?? activeTabObj.title, activeTabObj.content)
      : defaultLanguageRegistry.detect(activeTabObj.path ?? activeTabObj.title, activeTabObj.content)
    : defaultLanguageRegistry.get("silq")!;

  return (
    <main className={`studio ${theme}`}>
      <header>
        <div className="brand">
          <span>◇</span> SILQ STUDIO <small>QUANTUM IDE</small>
        </div>
        <nav>
          <button onClick={setTheme}>{theme === "dark" ? "☀ Light" : "◐ Dark"}</button>
          <button onClick={() => setAssistantOpen(!assistantOpen)}>AI Assistant</button>
        </nav>
      </header>
      <section className="workspace">
        <aside className="activity">
          <button title="Explorer">▱</button>
          <button title="Search">⌕</button>
          <button title="Extensions">▦</button>
          <button title="Settings">⚙</button>
        </aside>
        <Explorer />
        <section className="center">
          <div className="tabs">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`tab ${tab.id === activeTab ? "active" : ""}`}
                onClick={() => openTab(tab)}
                style={{ cursor: "pointer" }}
              >
                <span>
                  {tab.dirty ? "● " : ""}
                  {tab.title}
                </span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <EditorPane />
          <OutputPanel />
        </section>
        <CircuitPanel />
        {assistantOpen && <Assistant />}
      </section>
      <footer>
        <span>{activeAdapter.name}</span>
        <span>UTF-8</span>
        <span>Compiler: {compileStatus}</span>
        <span>State-vector simulator (1-12 Qubits)</span>
      </footer>
    </main>
  );
}
