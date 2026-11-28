/**
 * Interactive JAX Quantum Studio UI & SVG Visualization Module for QStudio.
 * Connects to window.silq.frameworks IPC in Electron and provides pure SVG
 * circuit, probability, histogram, Bloch sphere, and parameter sweep renderers.
 */

export const PRESET_CIRCUITS = {
  bell: {
    name: "Bell State |Φ+⟩",
    qubits: 2,
    shots: 1024,
    params: [],
    observable: [{ pauli: "Z", qubit: 0, coeff: 1.0 }],
    operations: [
      { gate: "H", targets: [0] },
      { gate: "CX", targets: [0, 1] },
    ],
  },
  ghz: {
    name: "3-Qubit GHZ State",
    qubits: 3,
    shots: 1024,
    params: [],
    observable: [{ pauli: "Z", qubit: 0, coeff: 1.0 }],
    operations: [
      { gate: "H", targets: [0] },
      { gate: "CX", targets: [0, 1] },
      { gate: "CX", targets: [1, 2] },
    ],
  },
  variational: {
    name: "Parameterized RY-CNOT Ansatz",
    qubits: 2,
    shots: 1024,
    params: [1.0472, 0.5236],
    observable: [{ pauli: "Z", qubit: 0, coeff: 1.0 }],
    operations: [
      { gate: "RY", targets: [0], paramIndex: 0 },
      { gate: "RY", targets: [1], paramIndex: 1 },
      { gate: "CX", targets: [0, 1] },
    ],
  },
  trajectory: {
    name: "Mid-Circuit Reset Trajectory",
    qubits: 2,
    shots: 512,
    params: [],
    observable: [{ pauli: "Z", qubit: 0, coeff: 1.0 }],
    operations: [
      { gate: "H", targets: [0] },
      { gate: "RESET", targets: [0] },
      { gate: "H", targets: [1] },
      { gate: "MEASURE", targets: [1] },
    ],
  },
};

export function renderCircuitSvg(circuit) {
  const qubits = Math.max(1, Number(circuit?.qubits || 1));
  const ops = Array.isArray(circuit?.operations) ? circuit.operations : [];
  const colW = 58;
  const rowH = 38;
  const padL = 46;
  const padT = 20;
  const width = Math.max(260, padL + Math.max(1, ops.length) * colW + 24);
  const height = padT + qubits * rowH + 12;

  const lines = [];
  for (let q = 0; q < qubits; q++) {
    const y = padT + q * rowH + 16;
    lines.push(`<text x="10" y="${y + 4}" fill="#8b949e" font-size="11" font-family="monospace">q[${q}]</text>`);
    lines.push(`<line x1="${padL}" y1="${y}" x2="${width - 14}" y2="${y}" stroke="#30363d" stroke-width="1.5" />`);
  }

  ops.forEach((op, idx) => {
    const x = padL + idx * colW + colW / 2;
    const gate = String(op.gate || "?").toUpperCase();
    const targets = Array.isArray(op.targets) ? op.targets.map(Number) : [];
    if ((gate === "CX" || gate === "CNOT" || gate === "CZ" || gate === "SWAP") && targets.length >= 2) {
      const y0 = padT + targets[0] * rowH + 16;
      const y1 = padT + targets[1] * rowH + 16;
      lines.push(`<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#58a6ff" stroke-width="2" />`);
      lines.push(`<circle cx="${x}" cy="${y0}" r="5" fill="#58a6ff" />`);
      if (gate === "CZ") {
        lines.push(`<circle cx="${x}" cy="${y1}" r="5" fill="#58a6ff" />`);
      } else if (gate === "SWAP") {
        lines.push(`<text x="${x}" y="${y0 + 4}" text-anchor="middle" fill="#e6edf3" font-size="12">×</text>`);
        lines.push(`<text x="${x}" y="${y1 + 4}" text-anchor="middle" fill="#e6edf3" font-size="12">×</text>`);
      } else {
        lines.push(`<circle cx="${x}" cy="${y1}" r="9" fill="#0d1117" stroke="#58a6ff" stroke-width="2" />`);
        lines.push(`<line x1="${x - 5}" y1="${y1}" x2="${x + 5}" y2="${y1}" stroke="#58a6ff" stroke-width="1.5" />`);
        lines.push(`<line x1="${x}" y1="${y1 - 5}" x2="${x}" y2="${y1 + 5}" stroke="#58a6ff" stroke-width="1.5" />`);
      }
      return;
    }

    const q = targets[0] ?? 0;
    const y = padT + q * rowH + 16;
    const isNonUnitary = gate === "RESET" || gate === "MEASURE" || gate === "M";
    const fill = isNonUnitary ? "#2d1b24" : "#1f3a5f";
    const stroke = isNonUnitary ? "#f778ba" : "#58a6ff";
    const label = op.paramIndex !== undefined ? `${gate}(θ${op.paramIndex})` : gate;
    lines.push(`<rect x="${x - 22}" y="${y - 13}" width="44" height="26" rx="4" fill="${fill}" stroke="${stroke}" stroke-width="1.4" />`);
    lines.push(`<text x="${x}" y="${y + 4}" text-anchor="middle" fill="#e6edf3" font-size="10" font-family="monospace">${label}</text>`);
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${lines.join("")}</svg>`;
}

export function renderBlochSphereSvg(bloch) {
  const cx = 56;
  const cy = 56;
  const r = 40;
  // Simple orthographic projection: X horizontal, Z vertical, Y depth-tilted
  const px = cx + (bloch.x - 0.35 * bloch.y) * r * 0.85;
  const py = cy - (bloch.z - 0.2 * bloch.y) * r * 0.85;
  return `<svg width="112" height="112" viewBox="0 0 112 112" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#30363d" stroke-width="1.5" />
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="12" fill="none" stroke="#21262d" stroke-dasharray="3 3" />
    <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}" stroke="#21262d" />
    <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}" stroke="#21262d" />
    <text x="${cx}" y="11" text-anchor="middle" fill="#8b949e" font-size="9">|0⟩</text>
    <text x="${cx}" y="109" text-anchor="middle" fill="#8b949e" font-size="9">|1⟩</text>
    <line x1="${cx}" y1="${cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="#58a6ff" stroke-width="2.2" />
    <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="#3fb950" />
  </svg>`;
}

export function renderSweepChartSvg(thetas, expectations) {
  if (!Array.isArray(thetas) || !Array.isArray(expectations) || thetas.length === 0) {
    return "";
  }
  const w = 360;
  const h = 150;
  const pad = 28;
  const plotW = w - pad * 2;
  const plotH = h - pad * 2;
  const points = thetas.map((t, i) => {
    const x = pad + (i / Math.max(1, thetas.length - 1)) * plotW;
    const val = Math.max(-1, Math.min(1, Number(expectations[i] ?? 0)));
    const y = pad + ((1 - val) / 2) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const midY = pad + plotH / 2;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${h - pad}" stroke="#30363d" />
    <line x1="${pad}" y1="${midY}" x2="${w - pad}" y2="${midY}" stroke="#21262d" stroke-dasharray="3 3" />
    <text x="6" y="${pad + 4}" fill="#8b949e" font-size="9">+1</text>
    <text x="8" y="${midY + 3}" fill="#8b949e" font-size="9">0</text>
    <text x="6" y="${h - pad + 4}" fill="#8b949e" font-size="9">-1</text>
    <polyline fill="none" stroke="#58a6ff" stroke-width="2" points="${points.join(" ")}" />
    ${points.map((pt) => {
      const [px, py] = pt.split(",");
      return `<circle cx="${px}" cy="${py}" r="2.5" fill="#3fb950" />`;
    }).join("")}
  </svg>`;
}

export function mountJaxStudio(container, frameworksApi = (typeof window !== "undefined" ? window.silq?.frameworks : null)) {
  if (!container) return;
  container.innerHTML = "";
  const root = document.createElement("div");
  root.className = "jax-studio";
  container.appendChild(root);

  let currentPresetKey = "variational";
  let currentCircuit = structuredClone(PRESET_CIRCUITS[currentPresetKey]);
  let probeInfo = null;
  let simResult = null;
  let gradResult = null;
  let sweepResult = null;
  let errorMsg = null;

  function render() {
    const hasBridge = Boolean(frameworksApi && typeof frameworksApi.simulate === "function");
    const jaxAvailable = Boolean(probeInfo?.available);
    const pills = [
      `<span class="jax-pill ${jaxAvailable ? "ok" : "warn"}">JAX: ${jaxAvailable ? `v${probeInfo.version || "ready"}` : (hasBridge ? "unavailable" : "preview mode")}</span>`,
      `<span class="jax-pill">Backend: ${(simResult?.xlaBackend || probeInfo?.backend || "cpu").toUpperCase()}</span>`,
      `<span class="jax-pill">Device: ${simResult?.device || probeInfo?.devices?.[0] || "n/a"}</span>`,
      `<span class="jax-pill">Mode: ${simResult?.executionMode || "unitary"}</span>`,
    ];

    const probs = Array.isArray(simResult?.probabilities) ? simResult.probabilities : [];
    const nQ = Number(currentCircuit.qubits || 1);
    const probsHtml = probs.length
      ? probs.map((p, idx) => {
          const basis = idx.toString(2).padStart(nQ, "0");
          const pct = (p * 100).toFixed(2);
          return `<div class="jax-bar-row"><code>|${basis}⟩</code><div class="jax-bar-track"><div class="jax-bar-fill" style="width:${pct}%"></div></div><span>${pct}%</span></div>`;
        }).join("")
      : `<div style="color:#8b949e">Run simulation to inspect state probabilities.</div>`;

    const countsEntries = Object.entries(simResult?.counts || {});
    const totalShots = countsEntries.reduce((acc, [, c]) => acc + Number(c), 0) || 1;
    const countsHtml = countsEntries.length
      ? countsEntries.map(([basis, cnt]) => {
          const pct = ((Number(cnt) / totalShots) * 100).toFixed(1);
          return `<div class="jax-bar-row"><code>${basis}</code><div class="jax-bar-track"><div class="jax-bar-fill counts" style="width:${pct}%"></div></div><span>${cnt}</span></div>`;
        }).join("")
      : `<div style="color:#8b949e">No shot samples yet.</div>`;

    const blochList = Array.isArray(simResult?.blochVectors) ? simResult.blochVectors : [];
    const blochHtml = simResult?.executionMode === "trajectory"
      ? `<div class="jax-notice">Bloch spheres are omitted in trajectory mode (state vector collapses per shot).</div>`
      : blochList.length
        ? `<div class="jax-bloch-grid">${blochList.map((b) => `<div class="jax-bloch-item"><strong>q[${b.qubit}]</strong>${renderBlochSphereSvg(b)}<span>(${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)})</span></div>`).join("")}</div>`
        : `<div style="color:#8b949e">Run a unitary simulation to view per-qubit Bloch spheres.</div>`;

    const paramCount = Array.isArray(currentCircuit.params) ? currentCircuit.params.length : 0;
    const paramsHtml = paramCount > 0
      ? currentCircuit.params.map((val, idx) => `
          <label style="display:flex;align-items:center;gap:8px;font-size:12px">
            <span>θ${idx}:</span>
            <input type="range" min="0" max="6.2832" step="0.05" value="${val}" data-param-idx="${idx}" />
            <code>${Number(val).toFixed(3)}</code>
          </label>
        `).join("")
      : `<div style="color:#8b949e">No parameters in this circuit (select Parameterized Ansatz to explore autodiff).</div>`;

    const gradHtml = gradResult
      ? `<div><strong>⟨O⟩ = ${gradResult.expectation.toFixed(6)}</strong> | ∇θ = [${gradResult.gradients.map((g) => g.toFixed(6)).join(", ")}] (${gradResult.elapsedMs.toFixed(2)} ms)</div>`
      : "";

    const sweepHtml = sweepResult
      ? `<div class="jax-svg-wrap">${renderSweepChartSvg(sweepResult.thetas, sweepResult.expectations)}</div>`
      : "";

    root.innerHTML = `
      <div class="jax-studio-header">
        <div class="jax-studio-title">◇ JAX Quantum Studio</div>
        <div class="jax-status-pills">${pills.join("")}</div>
      </div>
      ${!hasBridge ? `<div class="jax-notice">Running in static web preview. Launch QStudio via Electron (<code>./node_modules/.bin/electron .</code>) to execute live JAX simulations and gradients.</div>` : ""}
      ${errorMsg ? `<div class="jax-error" role="alert">${errorMsg}</div>` : ""}
      <div class="jax-card">
        <h5>Circuit Builder & Gate Diagram</h5>
        <div class="jax-controls">
          <select id="jax-preset-select">
            ${Object.entries(PRESET_CIRCUITS).map(([k, v]) => `<option value="${k}" ${k === currentPresetKey ? "selected" : ""}>${v.name}</option>`).join("")}
          </select>
          <label>Shots: <input id="jax-shots-input" type="number" min="1" max="4096" value="${currentCircuit.shots || 1024}" style="width:76px" /></label>
          <button class="jax-btn primary" id="jax-run-btn">Run JAX Simulation</button>
          <button class="jax-btn" id="jax-probe-btn">Refresh Backend</button>
        </div>
        <div class="jax-svg-wrap">${renderCircuitSvg(currentCircuit)}</div>
        <textarea class="jax-textarea" id="jax-ops-json">${JSON.stringify(currentCircuit.operations, null, 2)}</textarea>
      </div>
      <div class="jax-grid">
        <div class="jax-card">
          <h5>State Probabilities ${simResult ? `(${simResult.elapsedMs.toFixed(2)} ms)` : ""}</h5>
          ${probsHtml}
        </div>
        <div class="jax-card">
          <h5>Measurement Outcomes</h5>
          ${countsHtml}
        </div>
      </div>
      <div class="jax-card">
        <h5>Bloch Sphere Representations</h5>
        ${blochHtml}
      </div>
      <div class="jax-card">
        <h5>Interactive Autodifferentiation & Parameter Sweep</h5>
        ${paramsHtml}
        <div class="jax-controls">
          <button class="jax-btn primary" id="jax-grad-btn">Compute Expectation & Gradient</button>
          <button class="jax-btn" id="jax-sweep-btn">Run jax.vmap Sweep (0 → 2π)</button>
        </div>
        ${gradHtml}
        ${sweepHtml}
      </div>
    `;

    root.querySelector("#jax-preset-select")?.addEventListener("change", (e) => {
      currentPresetKey = e.target.value;
      currentCircuit = structuredClone(PRESET_CIRCUITS[currentPresetKey]);
      simResult = null;
      gradResult = null;
      sweepResult = null;
      errorMsg = null;
      render();
    });

    root.querySelector("#jax-shots-input")?.addEventListener("change", (e) => {
      currentCircuit.shots = Number(e.target.value) || 1024;
    });

    root.querySelector("#jax-ops-json")?.addEventListener("change", (e) => {
      try {
        currentCircuit.operations = JSON.parse(e.target.value);
        errorMsg = null;
        render();
      } catch (err) {
        errorMsg = `Invalid operations JSON: ${err.message}`;
        render();
      }
    });

    root.querySelectorAll("input[data-param-idx]").forEach((el) => {
      el.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.paramIdx);
        currentCircuit.params[idx] = Number(e.target.value);
      });
      el.addEventListener("change", () => render());
    });

    root.querySelector("#jax-probe-btn")?.addEventListener("click", async () => {
      if (!hasBridge) return;
      try {
        probeInfo = await frameworksApi.probeJax();
        errorMsg = null;
      } catch (err) {
        errorMsg = err?.message || String(err);
      }
      render();
    });

    root.querySelector("#jax-run-btn")?.addEventListener("click", async () => {
      if (!hasBridge) {
        errorMsg = "Electron IPC bridge is required to run JAX simulations.";
        render();
        return;
      }
      try {
        errorMsg = null;
        const payloadOps = currentCircuit.operations.map((op) =>
          op.paramIndex !== undefined && currentCircuit.params[op.paramIndex] !== undefined
            ? { ...op, angle: currentCircuit.params[op.paramIndex] }
            : op
        );
        simResult = await frameworksApi.simulate({
          backend: "jax_quantum",
          circuit: { name: currentCircuit.name, qubits: currentCircuit.qubits, operations: payloadOps },
          shots: currentCircuit.shots || 1024,
          seed: 42,
        });
      } catch (err) {
        errorMsg = err?.message || String(err);
      }
      render();
    });

    root.querySelector("#jax-grad-btn")?.addEventListener("click", async () => {
      if (!hasBridge) {
        errorMsg = "Electron IPC bridge is required to compute JAX gradients.";
        render();
        return;
      }
      try {
        errorMsg = null;
        gradResult = await frameworksApi.jaxGradient({
          circuit: { name: currentCircuit.name, qubits: currentCircuit.qubits, operations: currentCircuit.operations },
          params: currentCircuit.params || [],
          observable: currentCircuit.observable || [{ pauli: "Z", qubit: 0, coeff: 1.0 }],
        });
      } catch (err) {
        errorMsg = err?.message || String(err);
      }
      render();
    });

    root.querySelector("#jax-sweep-btn")?.addEventListener("click", async () => {
      if (!hasBridge) {
        errorMsg = "Electron IPC bridge is required to run jax.vmap sweeps.";
        render();
        return;
      }
      try {
        errorMsg = null;
        const steps = 25;
        const thetas = Array.from({ length: steps }, (_, i) => (i / (steps - 1)) * 2 * Math.PI);
        const base = currentCircuit.params?.length ? currentCircuit.params : [0];
        const paramBatch = thetas.map((t) => [t, ...base.slice(1)]);
        const res = await frameworksApi.jaxVmapSweep({
          circuit: { name: currentCircuit.name, qubits: currentCircuit.qubits, operations: currentCircuit.operations },
          paramBatch,
          observable: currentCircuit.observable || [{ pauli: "Z", qubit: 0, coeff: 1.0 }],
        });
        sweepResult = { thetas, expectations: res.expectations };
      } catch (err) {
        errorMsg = err?.message || String(err);
      }
      render();
    });
  }

  if (frameworksApi?.probeJax) {
    frameworksApi.probeJax().then((info) => {
      probeInfo = info;
      render();
    }).catch(() => render());
  }
  render();
}

function initBrowserIntegration() {
  if (typeof document === "undefined") return;

  const enhancePane = () => {
    const pane = document.querySelector(".tfq-pane");
    if (pane && !pane.dataset.jaxMounted) {
      pane.dataset.jaxMounted = "true";
      mountJaxStudio(pane);
    }
  };

  const observer = new MutationObserver(enhancePane);
  observer.observe(document.body, { childList: true, subtree: true });
  enhancePane();

  if (!document.getElementById("jax-studio-launcher")) {
    const btn = document.createElement("button");
    btn.id = "jax-studio-launcher";
    btn.className = "jax-launcher-btn";
    btn.textContent = "◇ JAX Studio";
    btn.addEventListener("click", () => {
      const backdrop = document.createElement("div");
      backdrop.className = "jax-drawer-backdrop";
      const panel = document.createElement("div");
      panel.className = "jax-drawer-panel";
      backdrop.appendChild(panel);
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) backdrop.remove();
      });
      document.body.appendChild(backdrop);
      mountJaxStudio(panel);
    });
    document.body.appendChild(btn);
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBrowserIntegration);
  } else {
    initBrowserIntegration();
  }
}
