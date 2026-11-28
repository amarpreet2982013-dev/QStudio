import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import {
  PRESET_CIRCUITS,
  renderCircuitSvg,
  renderBlochSphereSvg,
  renderSweepChartSvg,
  mountJaxStudio,
} from "../dist/renderer/jax-studio.js";

const require = createRequire(import.meta.url);
const { QuantumFrameworkBridge } = require("../dist/backend/src/frameworks/QuantumFrameworkBridge");

function createMockDom() {
  class MockElement {
    constructor(tag) {
      this.tagName = tag.toUpperCase();
      this.children = [];
      this.listeners = new Map();
      this.dataset = {};
      this.className = "";
      this.value = "";
      this._innerHTML = "";
    }
    set innerHTML(html) {
      this._innerHTML = html;
      this.children = [];
    }
    get innerHTML() {
      return this._innerHTML;
    }
    appendChild(child) {
      this.children.push(child);
      return child;
    }
    addEventListener(evt, fn) {
      this.listeners.set(evt, fn);
    }
    querySelector(sel) {
      const id = sel.startsWith("#") ? sel.slice(1) : null;
      if (id && this._innerHTML.includes(`id="${id}"`)) {
        const el = new MockElement("div");
        el.id = id;
        el.trigger = (evt, targetVal) => {
          const fn = el.listeners.get(evt);
          if (fn) return fn({ target: { value: targetVal, dataset: {} } });
        };
        this._registered = this._registered || new Map();
        this._registered.set(sel, el);
        return el;
      }
      return null;
    }
    querySelectorAll() {
      return [];
    }
  }
  const origDoc = globalThis.document;
  globalThis.document = {
    createElement: (tag) => new MockElement(tag),
  };
  return () => {
    globalThis.document = origDoc;
  };
}

test("SVG renderers produce valid circuit, Bloch sphere, and sweep SVGs", () => {
  const bellSvg = renderCircuitSvg(PRESET_CIRCUITS.bell);
  assert.ok(bellSvg.startsWith("<svg") && bellSvg.includes("q[0]") && bellSvg.includes("q[1]"));

  const varSvg = renderCircuitSvg(PRESET_CIRCUITS.variational);
  assert.ok(varSvg.includes("RY(θ0)") && varSvg.includes("RY(θ1)"));

  const blochSvg = renderBlochSphereSvg({ qubit: 0, x: 0, y: 0, z: 1 });
  assert.ok(blochSvg.includes("|0⟩") && blochSvg.includes("|1⟩"));

  const sweepSvg = renderSweepChartSvg([0, Math.PI / 2, Math.PI], [1, 0, -1]);
  assert.ok(sweepSvg.includes("<polyline") && sweepSvg.includes("points="));
});

test("mountJaxStudio executes live JAX simulation, gradient, and vmap sweep via persistent worker", async () => {
  const restoreDom = createMockDom();
  const bridge = new QuantumFrameworkBridge({ useWorker: true });
  try {
    const frameworksApi = {
      probeJax: () => bridge.probeJax(),
      simulate: (req) => bridge.simulateJax(req.circuit, req.shots, req.seed),
      jaxGradient: (req) => bridge.gradientJax(req.circuit, req.params, req.observable),
      jaxVmapSweep: (req) => bridge.vmapSweepJax(req.circuit, req.paramBatch, req.observable),
    };

    const container = globalThis.document.createElement("div");
    mountJaxStudio(container, frameworksApi);

    // Trigger simulation button
    const root = container.children[0];
    await root._registered.get("#jax-run-btn").trigger("click");
    assert.ok(root.innerHTML.includes("unitary"));
    assert.ok(root.innerHTML.includes("Bloch Sphere Representations"));
    assert.ok(root.innerHTML.includes("q[0]"));

    // Trigger gradient button
    await root._registered.get("#jax-grad-btn").trigger("click");
    assert.ok(root.innerHTML.includes("⟨O⟩ ="));
    assert.ok(root.innerHTML.includes("∇θ ="));

    // Trigger vmap sweep button
    await root._registered.get("#jax-sweep-btn").trigger("click");
    assert.ok(root.innerHTML.includes("<polyline"));

    // Verify unsupported gradient error surfaces cleanly in UI
    const brokenApi = {
      ...frameworksApi,
      jaxGradient: async () => {
        throw new Error("Non-unitary operation 'RESET' is not differentiable");
      },
    };
    const errContainer = globalThis.document.createElement("div");
    mountJaxStudio(errContainer, brokenApi);
    const errRoot = errContainer.children[0];
    await errRoot._registered.get("#jax-grad-btn").trigger("click");
    assert.ok(errRoot.innerHTML.includes("not differentiable"));
  } finally {
    bridge.shutdownWorker();
    restoreDom();
  }
});
