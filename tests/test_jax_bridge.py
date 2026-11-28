import json
import math
import subprocess
import sys
from pathlib import Path

import pytest

BRIDGE_PATH = Path(__file__).resolve().parent.parent / "dist" / "backend" / "python" / "qstudio_bridge.py"
PYTHON_DIR = BRIDGE_PATH.parent


def run_bridge(command: str, payload: dict | None = None) -> dict:
    stdin_data = json.dumps(payload) if payload is not None else ""
    proc = subprocess.run(
        [sys.executable, str(BRIDGE_PATH), command],
        input=stdin_data,
        text=True,
        capture_output=True,
        check=False,
    )
    assert proc.returncode == 0, f"Bridge failed ({proc.returncode}): {proc.stderr} {proc.stdout}"
    parsed = json.loads(proc.stdout)
    assert parsed["success"] is True, f"Command {command} returned error: {parsed}"
    return parsed["data"]


def run_bridge_expect_error(command: str, payload: dict | None = None) -> str:
    stdin_data = json.dumps(payload) if payload is not None else ""
    proc = subprocess.run(
        [sys.executable, str(BRIDGE_PATH), command],
        input=stdin_data,
        text=True,
        capture_output=True,
        check=False,
    )
    assert proc.returncode == 1
    parsed = json.loads(proc.stdout)
    assert parsed["success"] is False
    return parsed["error"]


def test_probe_reports_jax_and_legacy_tfq():
    data = run_bridge("probe")
    assert data["python"]["available"] is True
    frameworks = data["frameworks"]
    assert frameworks["jax_quantum"]["available"] is True
    assert frameworks["jax_quantum"]["backend"] in ("cpu", "gpu", "tpu")
    assert len(frameworks["jax_quantum"]["devices"]) >= 1
    assert "CCX" in frameworks["jax_quantum"]["supportedGates"]
    assert frameworks["cirq"]["available"] is True
    assert frameworks["tensorflow_quantum"]["available"] is False


def test_jax_bell_state_normalization_and_counts():
    bell_circuit = {
        "name": "Bell",
        "qubits": 2,
        "operations": [
            {"gate": "H", "targets": [0]},
            {"gate": "CX", "targets": [0, 1]},
        ],
    }
    res = run_bridge("jax:simulate", {"circuit": bell_circuit, "shots": 1000, "seed": 123})
    assert res["backend"] == "jax_quantum"
    assert res["executionMode"] == "unitary"
    assert res["probabilitiesAreEmpirical"] is False
    probs = res["probabilities"]
    assert math.isclose(sum(probs), 1.0, abs_tol=1e-12)
    norm_sq = sum(c["re"] ** 2 + c["im"] ** 2 for c in res["stateVector"])
    assert math.isclose(norm_sq, 1.0, abs_tol=1e-12)
    # Maximally entangled Bell state has zero Bloch vectors (0, 0, 0) on both qubits
    assert len(res["blochVectors"]) == 2
    for b in res["blochVectors"]:
        assert math.isclose(b["x"], 0.0, abs_tol=1e-12)
        assert math.isclose(b["y"], 0.0, abs_tol=1e-12)
        assert math.isclose(b["z"], 0.0, abs_tol=1e-12)
    assert math.isclose(probs[0], 0.5, abs_tol=1e-12)
    assert math.isclose(probs[3], 0.5, abs_tol=1e-12)
    assert sum(res["counts"].values()) == 1000
    assert set(res["counts"].keys()).issubset({"00", "11"})


@pytest.mark.parametrize(
    "circuit",
    [
        {
            "name": "GHZ-3",
            "qubits": 3,
            "operations": [
                {"gate": "H", "targets": [0]},
                {"gate": "CX", "targets": [0, 1]},
                {"gate": "CX", "targets": [1, 2]},
            ],
        },
        {
            "name": "Toffoli-ISWAP-Rotations",
            "qubits": 3,
            "operations": [
                {"gate": "H", "targets": [0]},
                {"gate": "RX", "targets": [1], "angle": 0.7},
                {"gate": "RY", "targets": [2], "angle": 1.1},
                {"gate": "CCX", "targets": [0, 1, 2]},
                {"gate": "ISWAP", "targets": [0, 2]},
                {"gate": "S", "targets": [1]},
                {"gate": "T", "targets": [2]},
                {"gate": "RZ", "targets": [0], "angle": 0.4},
            ],
        },
        {
            "name": "QFT-3-like",
            "qubits": 3,
            "operations": [
                {"gate": "X", "targets": [0]},
                {"gate": "H", "targets": [0]},
                {"gate": "CZ", "targets": [0, 1]},
                {"gate": "H", "targets": [1]},
                {"gate": "SWAP", "targets": [0, 2]},
            ],
        },
    ],
)
def test_jax_matches_cirq_representative_circuits(circuit):
    jax_res = run_bridge("jax:simulate", {"circuit": circuit, "shots": 512, "seed": 7})
    cirq_res = run_bridge("cirq:simulate", {"circuit": circuit, "shots": 512, "seed": 7})
    assert math.isclose(sum(jax_res["probabilities"]), 1.0, abs_tol=1e-12)
    for p_jax, p_cirq in zip(jax_res["probabilities"], cirq_res["probabilities"]):
        assert math.isclose(p_jax, p_cirq, abs_tol=1e-6)


def test_jax_mid_circuit_reset_trajectory():
    circuit = {
        "name": "ResetToZero",
        "qubits": 1,
        "operations": [
            {"gate": "H", "targets": [0]},
            {"gate": "RESET", "targets": [0]},
        ],
    }
    res = run_bridge("jax:simulate", {"circuit": circuit, "shots": 200, "seed": 9})
    assert res["executionMode"] == "trajectory"
    assert res["probabilitiesAreEmpirical"] is True
    assert res["counts"] == {"0": 200}
    assert math.isclose(res["probabilities"][0], 1.0, abs_tol=1e-12)


def test_jax_mid_circuit_measure_trajectory():
    circuit = {
        "name": "MidCircuitMeasureBell",
        "qubits": 2,
        "operations": [
            {"gate": "H", "targets": [0]},
            {"gate": "MEASURE", "targets": [0]},
            {"gate": "CX", "targets": [0, 1]},
        ],
    }
    res = run_bridge("jax:simulate", {"circuit": circuit, "shots": 400, "seed": 17})
    assert res["executionMode"] == "trajectory"
    assert set(res["counts"].keys()).issubset({"00", "11"})
    assert sum(res["counts"].values()) == 400


def test_jax_gradient_rejects_reset_and_mid_circuit_measure():
    err_reset = run_bridge_expect_error(
        "jax:gradient",
        {
            "circuit": {
                "qubits": 1,
                "operations": [
                    {"gate": "RY", "targets": [0], "paramIndex": 0},
                    {"gate": "RESET", "targets": [0]},
                ],
            },
            "params": [0.5],
        },
    )
    assert "not differentiable" in err_reset

    err_meas = run_bridge_expect_error(
        "jax:gradient",
        {
            "circuit": {
                "qubits": 1,
                "operations": [
                    {"gate": "RY", "targets": [0], "paramIndex": 0},
                    {"gate": "MEASURE", "targets": [0]},
                    {"gate": "X", "targets": [0]},
                ],
            },
            "params": [0.5],
        },
    )
    assert "non-differentiable" in err_meas


def test_jax_analytic_gradient_and_vmap():
    circuit = {
        "name": "ParamRY",
        "qubits": 1,
        "operations": [{"gate": "RY", "targets": [0], "paramIndex": 0}],
    }
    theta = math.pi / 3.0
    grad_res = run_bridge(
        "jax:gradient",
        {
            "circuit": circuit,
            "params": [theta],
            "observable": [{"pauli": "Z", "qubit": 0, "coeff": 1.0}],
        },
    )
    assert math.isclose(grad_res["expectation"], math.cos(theta), abs_tol=1e-12)
    assert math.isclose(grad_res["gradients"][0], -math.sin(theta), abs_tol=1e-12)

    sweep_res = run_bridge(
        "jax:vmap_sweep",
        {
            "circuit": circuit,
            "paramBatch": [[0.0], [math.pi / 2.0], [math.pi]],
            "observable": [{"pauli": "Z", "qubit": 0, "coeff": 1.0}],
        },
    )
    assert math.isclose(sweep_res["expectations"][0], 1.0, abs_tol=1e-12)
    assert math.isclose(sweep_res["expectations"][1], 0.0, abs_tol=1e-12)
    assert math.isclose(sweep_res["expectations"][2], -1.0, abs_tol=1e-12)


@pytest.mark.parametrize(
    "command,payload,expected_substr",
    [
        ("jax:simulate", {"circuit": {"qubits": 99, "operations": []}}, "1 to 12 qubits"),
        ("jax:simulate", {"circuit": {"qubits": 2, "operations": [{"gate": "H", "targets": [5]}]}}, "out of range"),
        ("jax:simulate", {"circuit": {"qubits": 2, "operations": [{"gate": "CX", "targets": [0, 0]}]}}, "duplicate target"),
        ("jax:simulate", {"circuit": {"qubits": 1, "operations": [{"gate": "BOGUS", "targets": [0]}]}}, "Unsupported gate"),
        ("jax:simulate", {"circuit": {"qubits": 1, "operations": []}, "shots": 0}, "Invalid shots"),
        ("jax:gradient", {"circuit": {"qubits": 1, "operations": [{"gate": "RY", "targets": [0], "paramIndex": 2}]}, "params": [0.1]}, "out of range"),
    ],
)
def test_invalid_inputs_return_structured_errors(command, payload, expected_substr):
    err = run_bridge_expect_error(command, payload)
    assert expected_substr in err


def test_missing_jax_graceful_fallback():
    code = "\n".join([
        "import sys",
        f"sys.path.insert(0, {str(PYTHON_DIR)!r})",
        "sys.modules['jax'] = None",
        "import jax_quantum",
        "p = jax_quantum.probe_jax()",
        "assert p['available'] is False",
        "try:",
        "    jax_quantum.simulate_circuit({'circuit': {'qubits': 1, 'operations': []}})",
        "    raise AssertionError('Expected RuntimeError')",
        "except RuntimeError as e:",
        "    assert 'JAX is not installed' in str(e)",
        "print('FALLBACK_OK')",
    ])
    proc = subprocess.run([sys.executable, "-c", code], text=True, capture_output=True, check=False)
    assert proc.returncode == 0, proc.stderr
    assert "FALLBACK_OK" in proc.stdout
