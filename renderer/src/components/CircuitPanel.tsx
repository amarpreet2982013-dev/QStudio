import { useEffect, useRef, useState } from "react";
import type { CircuitModel } from "../../../backend/src/contracts";
import { StateVectorSimulator } from "../../../simulator/StateVectorSimulator";
import { useIDEStore, type ShotCount } from "../store/ideStore";
import { defaultLanguageRegistry } from "../../../backend/src/languages";
import { compileAndSimulate } from "../services/RunService";

const simulator = new StateVectorSimulator();

export function CircuitPanel(): JSX.Element {
  const {
    tabs,
    activeTab,
    log,
    setPanel,
    setSimulationOutput,
    shots,
    setShots,
    circuitZoom,
    setCircuitZoom,
    selectedGateIndex,
    setSelectedGateIndex,
    lastValidCircuit,
    compileStatus,
    setCompileStatus,
    setDiagnostics,
    setLastValidCircuit,
  } = useIDEStore();

  const tab = tabs.find((item) => item.id === activeTab);
  const source = tab?.content ?? "";
  const adapter = tab
    ? tab.language
      ? defaultLanguageRegistry.get(tab.language) ?? defaultLanguageRegistry.detect(tab.path ?? tab.title, source)
      : defaultLanguageRegistry.detect(tab.path ?? tab.title, source)
    : defaultLanguageRegistry.get("silq")!;

  const [running, setRunning] = useState(false);
  const runId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      runId.current += 1;
    };
  }, []);

  const circuit = lastValidCircuit;

  const runSimulation = async () => {
    const currentRun = ++runId.current;
    const tabId = tab?.id;
    const inputIsCurrent = () => {
      const state = useIDEStore.getState();
      const currentTab = state.tabs.find((item) => item.id === state.activeTab);
      return mounted.current && currentRun === runId.current && state.shots === shots && currentTab?.id === tabId && currentTab.content === source && currentTab.language === adapter.id;
    };

    setRunning(true);
    setSimulationOutput("");
    setCompileStatus("Compiling...");
    try {
      const runResult = await compileAndSimulate(adapter, source, shots, simulator);
      if (!inputIsCurrent()) return;
      setDiagnostics(runResult.compilation.diagnostics);
      if (!runResult.simulation) {
        setCompileStatus("Error");
        log(`Compilation failed with ${runResult.compilation.diagnostics.length} diagnostic(s).`);
        setPanel("problems");
        return;
      }

      const result = runResult.simulation;
      setCompileStatus("Compiled");
      setLastValidCircuit(runResult.compilation.circuit);
      const reportData = {
        elapsedMs: result.elapsedMs,
        shots: result.shots,
        probabilities: result.probabilities,
        stateVector: result.stateVector,
        counts: result.counts,
        measurementResults: result.measurementResults,
        registers: result.registers,
      };

      // Store formatted JSON data so OutputPanel can render sleek charts and tables
      setSimulationOutput(JSON.stringify(reportData));
      log(`Simulated ${runResult.compilation.circuit.name}: ${result.shots} shots in ${result.elapsedMs}ms.`);
      setPanel("simulation");
    } catch (error) {
      if (inputIsCurrent()) {
        setDiagnostics([
          {
            severity: "error",
            message: error instanceof Error ? error.message : String(error),
            line: 1,
            column: 1,
          },
        ]);
        setCompileStatus("Error");
        log(`Simulation error: ${error instanceof Error ? error.message : String(error)}`);
        setPanel("problems");
      }
    } finally {
      if (mounted.current && currentRun === runId.current) setRunning(false);
    }
  };

  return (
    <aside className="circuit">
      <div className="panel-title">
        <span>QUANTUM CIRCUIT</span>
        <div className="title-actions">
          <button className="primary-btn" onClick={() => void runSimulation()} disabled={running || !tab || tab.id === "welcome"}>
            {running ? "Simulating..." : "▶ Run"}
          </button>
        </div>
      </div>

      <div className="circuit-controls-bar">
        <div className="meta-info">
          <span className="circuit-name">{circuit.name || "Compiled Circuit"}</span>
          <span className="pill">{circuit.qubits} Qubit{circuit.qubits > 1 ? "s" : ""}</span>
          <span className={`pill status-${compileStatus.toLowerCase().replace(/[^a-z]/g, "")}`}>
            {compileStatus}
          </span>
        </div>

        <div className="circuit-toolbar">
          <label className="shots-selector">
            Shots:
            <select
              value={shots}
              onChange={(e) => setShots(Number(e.target.value) as ShotCount)}
              aria-label="Simulation Shot Count"
            >
              <option value={100}>100</option>
              <option value={512}>512</option>
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
              <option value={4096}>4096</option>
            </select>
          </label>

          <div className="zoom-controls">
            <button onClick={() => setCircuitZoom((z) => Math.max(0.6, z - 0.15))} title="Zoom Out">-</button>
            <span className="zoom-val">{Math.round(circuitZoom * 100)}%</span>
            <button onClick={() => setCircuitZoom((z) => Math.min(2.0, z + 0.15))} title="Zoom In">+</button>
            <button onClick={() => setCircuitZoom(1.0)} title="Reset Zoom">↺</button>
          </div>
        </div>
      </div>

      <div className="circuit-scroll-container">
        <div style={{ transform: `scale(${circuitZoom})`, transformOrigin: "top left" }}>
          <CircuitSvg
            circuit={circuit}
            selectedIndex={selectedGateIndex}
            onSelectGate={(idx) => setSelectedGateIndex(idx === selectedGateIndex ? null : idx)}
          />
        </div>
      </div>

      <div className="legend">
        <span>● Control dot</span>
        <span>⊕ CNOT target</span>
        <span>M Measure</span>
        <span>R Reset</span>
        <span>SWAP Exchange</span>
      </div>
    </aside>
  );
}

function CircuitSvg({
  circuit,
  selectedIndex,
  onSelectGate,
}: {
  circuit: CircuitModel;
  selectedIndex: number | null;
  onSelectGate(idx: number): void;
}): JSX.Element {
  const wireSpacing = 48;
  const gateSpacing = 52;
  const startX = 64;
  const startY = 36;
  const width = Math.max(240, startX + circuit.operations.length * gateSpacing + 40);
  const height = Math.max(100, startY + circuit.qubits * wireSpacing + 20);

  return (
    <svg className="circuit-svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="Quantum Circuit Diagram">
      <g className="wires">
        {Array.from({ length: circuit.qubits }, (_, qubit) => {
          const y = startY + qubit * wireSpacing;
          return (
            <g key={`wire-${qubit}`}>
              <text x="12" y={y + 4} className="qubit-label">
                q[{qubit}]
              </text>
              <line x1="48" x2={width - 20} y1={y} y2={y} className="wire-line" />
            </g>
          );
        })}
      </g>

      <g className="operations">
        {circuit.operations.map((operation: CircuitModel["operations"][number], index: number) => {
          const x = startX + index * gateSpacing;
          const isSelected = selectedIndex === index;
          return (
            <GateItem
              key={`op-${operation.moment}-${index}`}
              operation={operation}
              x={x}
              startY={startY}
              wireSpacing={wireSpacing}
              isSelected={isSelected}
              onClick={() => onSelectGate(index)}
            />
          );
        })}
      </g>
    </svg>
  );
}

function GateItem({
  operation,
  x,
  startY,
  wireSpacing,
  isSelected,
  onClick,
}: {
  operation: CircuitModel["operations"][number];
  x: number;
  startY: number;
  wireSpacing: number;
  isSelected: boolean;
  onClick(): void;
}): JSX.Element {
  const gateName = operation.gate.toUpperCase();
  const targets = operation.targets;

  if (gateName === "SWAP" && targets.length >= 2) {
    const y1 = startY + targets[0] * wireSpacing;
    const y2 = startY + targets[1] * wireSpacing;
    return (
      <g className={`gate-group ${isSelected ? "selected" : ""}`} onClick={onClick} style={{ cursor: "pointer" }}>
        <line x1={x} x2={x} y1={y1} y2={y2} className="gate-link-line" />
        <g transform={`translate(${x}, ${y1})`}>
          <line x1="-6" y1="-6" x2="6" y2="6" className="swap-x" />
          <line x1="-6" y1="6" x2="6" y2="-6" className="swap-x" />
        </g>
        <g transform={`translate(${x}, ${y2})`}>
          <line x1="-6" y1="-6" x2="6" y2="6" className="swap-x" />
          <line x1="-6" y1="6" x2="6" y2="-6" className="swap-x" />
        </g>
      </g>
    );
  }

  const primaryTarget = targets[targets.length - 1] ?? 0;
  const targetY = startY + primaryTarget * wireSpacing;
  const hasControl = (gateName === "CX" || gateName === "CZ" || gateName === "CNOT") && targets.length > 1;
  const controlY = hasControl ? startY + targets[0] * wireSpacing : targetY;

  return (
    <g className={`gate-group ${isSelected ? "selected" : ""}`} onClick={onClick} style={{ cursor: "pointer" }}>
      {hasControl && (
        <>
          <line x1={x} x2={x} y1={controlY} y2={targetY} className="gate-link-line" />
          <circle cx={x} cy={controlY} r="5" className="control-dot" />
        </>
      )}

      {gateName === "CX" || gateName === "CNOT" ? (
        <g transform={`translate(${x}, ${targetY})`}>
          <circle cx="0" cy="0" r="12" className="target-circle" />
          <line x1="-8" y1="0" x2="8" y2="0" className="target-cross" />
          <line x1="0" y1="-8" x2="0" y2="8" className="target-cross" />
        </g>
      ) : (
        <g transform={`translate(${x}, ${targetY})`}>
          <rect x="-15" y="-15" width="30" height="30" rx="4" className={`gate-box ${isSelected ? "gate-box-active" : ""}`} />
          <text x="0" y="4" textAnchor="middle" className="gate-text">
            {gateName === "MEASURE" ? "M" : gateName === "RESET" ? "R" : gateName}
          </text>
        </g>
      )}
    </g>
  );
}
