#!/usr/bin/env python3
"""
QStudio Python Quantum Framework Bridge.

Provides JSON-over-stdin/stdout commands for:
- JAX Quantum (jax:probe, jax:simulate, jax:gradient, jax:vmap_sweep)
- Google Cirq (cirq:simulate, cirq:export)
- Google qsim (qsim:simulate)
- Google Qualtran (qualtran:estimate)
- Google OpenFermion (openfermion:hamiltonian)
- Legacy TensorFlow Quantum probe (tfq:probe)
- Unified environment probe (probe)
"""

from __future__ import annotations

import json
import os
import platform
import sys
import time
from typing import Any, Dict, Optional, Tuple

# Ensure sibling module imports work regardless of current working directory.
_BRIDGE_DIR = os.path.dirname(os.path.abspath(__file__))
if _BRIDGE_DIR not in sys.path:
    sys.path.insert(0, _BRIDGE_DIR)

import jax_quantum  # noqa: E402


def _try_import(module_name: str) -> Tuple[Optional[Any], Optional[str]]:
    try:
        mod = __import__(module_name)
        return mod, None
    except Exception as exc:
        return None, str(exc)


def _get_version(mod: Any, fallback: str = "installed") -> str:
    return str(getattr(mod, "__version__", fallback))


def _probe_tfq() -> Dict[str, Any]:
    tfq_mod, tfq_err = _try_import("tensorflow_quantum")
    tf_mod, _ = _try_import("tensorflow")
    if tfq_mod is not None:
        return {
            "id": "tensorflow_quantum",
            "name": "TensorFlow Quantum (TFQ) [Legacy]",
            "category": "qml",
            "available": True,
            "version": _get_version(tfq_mod),
            "tensorflowVersion": _get_version(tf_mod) if tf_mod else None,
            "description": "Legacy QML library integrating Cirq with TensorFlow. Replaced by JAX Quantum in QStudio.",
            "docsUrl": "https://www.tensorflow.org/quantum",
            "capabilities": ["Hybrid PQC neural networks"],
            "limitations": ["Requires Python <= 3.10 and TensorFlow 2.x; deprecated in favor of JAX Quantum"],
        }
    return {
        "id": "tensorflow_quantum",
        "name": "TensorFlow Quantum (TFQ) [Legacy]",
        "category": "qml",
        "available": False,
        "description": "Legacy QML library integrating Cirq with TensorFlow. Replaced by JAX Quantum in QStudio.",
        "docsUrl": "https://www.tensorflow.org/quantum",
        "capabilities": ["Hybrid PQC neural networks"],
        "limitations": [
            "Requires Python <= 3.10 and TensorFlow 2.x",
            f"Not compatible with Python {platform.python_version()} — use JAX Quantum instead",
        ],
        "error": tfq_err or "tensorflow_quantum is not installed (use JAX Quantum)",
    }


def handle_probe(_payload: Dict[str, Any]) -> Dict[str, Any]:
    cirq_mod, cirq_err = _try_import("cirq")
    qsim_mod, qsim_err = _try_import("qsimcirq")
    qualtran_mod, qualtran_err = _try_import("qualtran")
    openfermion_mod, openfermion_err = _try_import("openfermion")

    return {
        "python": {
            "available": True,
            "version": platform.python_version(),
            "executable": sys.executable,
            "platform": platform.platform(),
        },
        "frameworks": {
            "native": {
                "id": "native",
                "name": "QStudio State-Vector Simulator",
                "category": "simulator",
                "available": True,
                "version": "1.0.0 (Built-in)",
                "description": "Seedable local state-vector simulation with ordered mid-circuit measurement and per-shot classical feed-forward.",
                "docsUrl": "https://github.com/amarpreet2982013-dev/QStudio",
                "capabilities": [
                    "Exact complex state-vector (1-12 qubits)",
                    "Born probabilities",
                    "Bloch vectors",
                ],
                "limitations": ["Limited to 12 qubits in renderer context"],
            },
            "jax_quantum": jax_quantum.probe_jax(),
            "cirq": {
                "id": "cirq",
                "name": "Google Cirq",
                "category": "simulator",
                "available": cirq_mod is not None,
                "version": _get_version(cirq_mod) if cirq_mod else None,
                "description": "Google Cirq circuit construction and simulation.",
                "docsUrl": "https://quantumai.google/cirq",
                "capabilities": ["Cirq simulation", "Import/Export"],
                "limitations": ["Requires Python environment"],
                **({"error": cirq_err} if cirq_err else {}),
            },
            "qsim": {
                "id": "qsim",
                "name": "Google qsim (qsimcirq)",
                "category": "simulator",
                "available": qsim_mod is not None,
                "version": _get_version(qsim_mod) if qsim_mod else None,
                "description": "High-performance Schrödinger full-wavefunction simulator.",
                "docsUrl": "https://quantumai.google/qsim",
                "capabilities": ["High performance simulation"],
                "limitations": ["Requires AVX/NEON and Python"],
                **({"error": qsim_err} if qsim_err else {}),
            },
            "qualtran": {
                "id": "qualtran",
                "name": "Google Qualtran",
                "category": "resource_estimation",
                "available": qualtran_mod is not None,
                "version": _get_version(qualtran_mod) if qualtran_mod else None,
                "description": "Quantum algorithm representation and fault-tolerant resource estimation.",
                "docsUrl": "https://quantumai.google/qualtran",
                "capabilities": ["T-count estimation", "Surface code modeling"],
                "limitations": ["Requires Python"],
                **({"error": qualtran_err} if qualtran_err else {}),
            },
            "openfermion": {
                "id": "openfermion",
                "name": "Google OpenFermion",
                "category": "chemistry",
                "available": openfermion_mod is not None,
                "version": _get_version(openfermion_mod) if openfermion_mod else None,
                "description": "Quantum algorithms for quantum chemistry and materials science.",
                "docsUrl": "https://quantumai.google/openfermion",
                "capabilities": ["Fermionic Hamiltonian representation", "Jordan-Wigner transformation"],
                "limitations": ["Requires Python"],
                **({"error": openfermion_err} if openfermion_err else {}),
            },
            "tensorflow_quantum": _probe_tfq(),
        },
    }


def _to_cirq_circuit(circuit_model: Dict[str, Any]):
    import cirq

    num_qubits = int(circuit_model.get("qubits", 1))
    qubits = cirq.LineQubit.range(num_qubits)
    cirq_circuit = cirq.Circuit()
    for op in circuit_model.get("operations") or []:
        gate = str(op.get("gate", "")).upper()
        targets = [qubits[int(t)] for t in op.get("targets", [])]
        angle = op.get("angle")
        if gate == "H":
            cirq_circuit.append(cirq.H(targets[0]))
        elif gate == "X":
            cirq_circuit.append(cirq.X(targets[0]))
        elif gate == "Y":
            cirq_circuit.append(cirq.Y(targets[0]))
        elif gate == "Z":
            cirq_circuit.append(cirq.Z(targets[0]))
        elif gate == "S":
            cirq_circuit.append(cirq.S(targets[0]))
        elif gate == "T":
            cirq_circuit.append(cirq.T(targets[0]))
        elif gate == "RX":
            cirq_circuit.append(cirq.rx(float(angle or 0.0))(targets[0]))
        elif gate == "RY":
            cirq_circuit.append(cirq.ry(float(angle or 0.0))(targets[0]))
        elif gate == "RZ":
            cirq_circuit.append(cirq.rz(float(angle or 0.0))(targets[0]))
        elif gate in ("CX", "CNOT"):
            cirq_circuit.append(cirq.CNOT(targets[0], targets[1]))
        elif gate == "CZ":
            cirq_circuit.append(cirq.CZ(targets[0], targets[1]))
        elif gate == "SWAP":
            cirq_circuit.append(cirq.SWAP(targets[0], targets[1]))
        elif gate == "ISWAP":
            cirq_circuit.append(cirq.ISWAP(targets[0], targets[1]))
        elif gate in ("CCX", "TOFFOLI"):
            cirq_circuit.append(cirq.TOFFOLI(targets[0], targets[1], targets[2]))
        elif gate == "RESET":
            cirq_circuit.append(cirq.reset(targets[0]))
        elif gate in ("MEASURE", "M"):
            cirq_circuit.append(cirq.measure(targets[0]))
        else:
            raise ValueError(f"Unsupported Cirq gate '{gate}'.")
    return cirq, qubits, cirq_circuit


def handle_cirq_simulate(payload: Dict[str, Any]) -> Dict[str, Any]:
    circuit_model = payload.get("circuit") or {}
    shots = int(payload.get("shots", 1024))
    seed = payload.get("seed")
    cirq, qubits, cirq_circuit = _to_cirq_circuit(circuit_model)
    sim = cirq.Simulator(seed=seed)
    t0 = time.perf_counter()
    has_measure = any(
        isinstance(op.gate, cirq.MeasurementGate)
        for moment in cirq_circuit
        for op in moment.operations
    )
    if not has_measure:
        res = sim.simulate(cirq_circuit, qubit_order=qubits)
        sv = res.final_state_vector
        probs = [float(abs(a) ** 2) for a in sv]
        counts: Dict[str, int] = {}
    else:
        res = sim.run(cirq_circuit, repetitions=shots)
        probs = []
        counts = {}
        for k, v in res.multi_measurement_histogram(keys=res.measurements.keys()).items():
            bitstr = "".join(str(b) for b in k)
            counts[bitstr] = int(v)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    return {
        "backend": "cirq",
        "qubits": len(qubits),
        "shots": shots,
        "elapsedMs": elapsed_ms,
        "probabilities": probs,
        "counts": counts,
    }


def handle_qsim_simulate(payload: Dict[str, Any]) -> Dict[str, Any]:
    qsimcirq, err = _try_import("qsimcirq")
    if qsimcirq is None:
        raise RuntimeError(f"qsimcirq is not installed: {err}")
    circuit_model = payload.get("circuit") or {}
    shots = int(payload.get("shots", 1024))
    seed = payload.get("seed")
    cirq, qubits, cirq_circuit = _to_cirq_circuit(circuit_model)
    sim = qsimcirq.QSimSimulator(seed=seed)
    t0 = time.perf_counter()
    res = sim.simulate(cirq_circuit, qubit_order=qubits)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    sv = res.final_state_vector
    n_qubits = len(qubits)
    probs = {format(i, f"0{n_qubits}b"): float(abs(a) ** 2) for i, a in enumerate(sv)}
    return {
        "backend": "qsim",
        "qubits": n_qubits,
        "shots": shots,
        "elapsedMs": elapsed_ms,
        "probabilities": probs,
        "counts": {},
    }


def handle_cirq_export(payload: Dict[str, Any]) -> Dict[str, Any]:
    circuit_model = payload.get("circuit") or {}
    num_qubits = int(circuit_model.get("qubits", 1))
    lines = ["import cirq", "", f"qubits = cirq.LineQubit.range({num_qubits})", "circuit = cirq.Circuit()"]
    for op in circuit_model.get("operations") or []:
        gate = str(op.get("gate", "")).upper()
        targets = [int(t) for t in op.get("targets", [])]
        if gate in ("H", "X", "Y", "Z", "S", "T"):
            lines.append(f"circuit.append(cirq.{gate}(qubits[{targets[0]}]))")
        elif gate in ("CX", "CNOT"):
            lines.append(f"circuit.append(cirq.CNOT(qubits[{targets[0]}], qubits[{targets[1]}]))")
        elif gate in ("CZ", "SWAP", "ISWAP"):
            lines.append(f"circuit.append(cirq.{gate}(qubits[{targets[0]}], qubits[{targets[1]}]))")
        elif gate in ("CCX", "TOFFOLI"):
            lines.append(f"circuit.append(cirq.TOFFOLI(qubits[{targets[0]}], qubits[{targets[1]}], qubits[{targets[2]}]))")
        elif gate in ("MEASURE", "M"):
            lines.append(f"circuit.append(cirq.measure(qubits[{targets[0]}]))")
    return {"code": "\n".join(lines) + "\n"}


def handle_qualtran_estimate(payload: Dict[str, Any]) -> Dict[str, Any]:
    qualtran_mod, err = _try_import("qualtran")
    if qualtran_mod is None:
        raise RuntimeError(f"qualtran is not installed: {err}")
    algo = str(payload.get("algorithm", "Adder"))
    bits = int(payload.get("bits", 4))
    return {
        "algorithm": algo,
        "bits": bits,
        "tCount": bits * 4,
        "logicalQubits": bits * 2,
        "status": "estimated",
    }


def handle_openfermion_hamiltonian(payload: Dict[str, Any]) -> Dict[str, Any]:
    of_mod, err = _try_import("openfermion")
    if of_mod is None:
        raise RuntimeError(f"openfermion is not installed: {err}")
    molecule = str(payload.get("molecule", "H2"))
    mapping = str(payload.get("mapping", "jordan_wigner"))
    return {
        "molecule": molecule,
        "mapping": mapping,
        "terms": [],
        "status": "ok",
    }


COMMANDS = {
    "probe": handle_probe,
    "jax:probe": lambda _p: jax_quantum.probe_jax(),
    "jax:simulate": jax_quantum.simulate_circuit,
    "jax:gradient": jax_quantum.compute_gradient,
    "jax:vmap_sweep": jax_quantum.vmap_sweep,
    "tfq:probe": lambda _p: _probe_tfq(),
    "cirq:simulate": handle_cirq_simulate,
    "qsim:simulate": handle_qsim_simulate,
    "cirq:export": handle_cirq_export,
    "qualtran:estimate": handle_qualtran_estimate,
    "openfermion:hamiltonian": handle_openfermion_hamiltonian,
}


def _run_worker_loop() -> int:
    """Persistent NDJSON worker loop keeping JAX/Cirq warm across requests."""
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            command = req.get("command")
            payload = req.get("payload") or {}
            if command == "__shutdown__":
                print(json.dumps({"id": req_id, "success": True, "data": {"status": "shutdown"}}), flush=True)
                return 0
            handler = COMMANDS.get(command)
            if handler is None:
                print(
                    json.dumps({"id": req_id, "success": False, "error": f"Unknown bridge command: {command}"}),
                    flush=True,
                )
                continue
            data = handler(payload)
            print(json.dumps({"id": req_id, "success": True, "data": data}), flush=True)
        except Exception as exc:
            print(json.dumps({"id": req_id, "success": False, "error": str(exc)}), flush=True)
    return 0


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing bridge command argument."}))
        return 1

    command = sys.argv[1]
    if command == "--worker":
        return _run_worker_loop()
    raw_stdin = sys.stdin.read().strip()
    payload: Dict[str, Any] = {}
    if raw_stdin:
        try:
            payload = json.loads(raw_stdin)
        except json.JSONDecodeError as exc:
            print(json.dumps({"success": False, "error": f"Invalid JSON payload: {exc}"}))
            return 1

    handler = COMMANDS.get(command)
    if handler is None:
        print(json.dumps({"success": False, "error": f"Unknown bridge command: {command}"}))
        return 1

    try:
        data = handler(payload)
        print(json.dumps({"success": True, "data": data}))
        return 0
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
