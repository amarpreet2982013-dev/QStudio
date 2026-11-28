"""
Modular JAX Quantum Simulation, Autodiff, and Trajectory Engine for QStudio.

Supports:
- Unitary state-vector simulation (jax.jit, complex128)
- Projective mid-circuit measurement and reset trajectories (jax.random)
- Exact reverse-mode analytic gradients (jax.value_and_grad)
- Vectorized parameter sweeps (jax.vmap)
"""

from __future__ import annotations

import math
import time
from typing import Any, Dict, List, Optional, Tuple

MAX_QUBITS = 12
MAX_SHOTS = 100_000
MAX_TRAJECTORY_SHOTS = 4_096

SINGLE_QUBIT_GATES = {"H", "X", "Y", "Z", "S", "T", "RX", "RY", "RZ"}
TWO_QUBIT_GATES = {"CX", "CNOT", "CZ", "SWAP", "ISWAP"}
THREE_QUBIT_GATES = {"CCX", "TOFFOLI"}
NON_UNITARY_GATES = {"MEASURE", "M", "RESET", "BARRIER"}
SUPPORTED_GATES = SINGLE_QUBIT_GATES | TWO_QUBIT_GATES | THREE_QUBIT_GATES | NON_UNITARY_GATES


def require_jax():
    """Import JAX and enable float64/complex128 precision."""
    try:
        import jax
        import jax.numpy as jnp

        jax.config.update("jax_enable_x64", True)
        return jax, jnp
    except ImportError as exc:
        raise RuntimeError(
            "JAX is not installed in the active Python environment. "
            "Install it with: pip install jax"
        ) from exc


def probe_jax() -> Dict[str, Any]:
    """Return JAX runtime availability, version, and XLA device metadata."""
    try:
        import jax
    except Exception as exc:
        return {
            "id": "jax_quantum",
            "name": "JAX Quantum (QML & Autodiff)",
            "category": "qml",
            "available": False,
            "description": "JIT-compiled, hardware-accelerated differentiable quantum simulation and VQE/QML workflows using JAX.",
            "docsUrl": "https://jax.readthedocs.io",
            "capabilities": [
                "JIT-compiled state-vector simulation (jax.jit)",
                "Exact analytic gradients via backpropagation (jax.value_and_grad)",
                "Vectorized parameter sweeps (jax.vmap)",
                "Automatic CPU/GPU/TPU XLA dispatch",
            ],
            "limitations": ["Requires jax and jaxlib (pip install jax)"],
            "error": str(exc) or "jax is not installed",
        }

    try:
        import jaxlib
        jaxlib_version = str(getattr(jaxlib, "__version__", "installed"))
    except Exception:
        jaxlib_version = None

    try:
        backend = str(jax.default_backend())
        devices = [str(d) for d in jax.devices()]
    except Exception as exc:
        return {
            "id": "jax_quantum",
            "name": "JAX Quantum (QML & Autodiff)",
            "category": "qml",
            "available": False,
            "version": str(getattr(jax, "__version__", "installed")),
            "description": "JIT-compiled, hardware-accelerated differentiable quantum simulation and VQE/QML workflows using JAX.",
            "docsUrl": "https://jax.readthedocs.io",
            "capabilities": [],
            "limitations": ["JAX device initialization failed"],
            "error": str(exc),
        }

    return {
        "id": "jax_quantum",
        "name": "JAX Quantum (QML & Autodiff)",
        "category": "qml",
        "available": True,
        "version": str(getattr(jax, "__version__", "installed")),
        "jaxlibVersion": jaxlib_version,
        "backend": backend,
        "devices": devices,
        "gpuAvailable": any("gpu" in d.lower() or "cuda" in d.lower() for d in devices),
        "supportedGates": sorted(SUPPORTED_GATES),
        "description": "JIT-compiled, hardware-accelerated differentiable quantum simulation and VQE/QML workflows using JAX.",
        "docsUrl": "https://jax.readthedocs.io",
        "capabilities": [
            "JIT-compiled state-vector simulation (jax.jit)",
            "Exact analytic gradients via backpropagation (jax.value_and_grad)",
            "Vectorized parameter sweeps (jax.vmap)",
            "Projective mid-circuit measurement and reset trajectories",
            f"Active XLA backend: {backend.upper()} ({len(devices)} device(s))",
        ],
        "limitations": [
            f"Supports 1 to {MAX_QUBITS} qubits (state-vector scales as 2^n)",
            "Discrete shot sampling is non-differentiable; use expectation values or probabilities for jax:gradient",
            "Mid-circuit RESET/MEASURE trajectories are supported in jax:simulate, not in jax:gradient or jax:vmap_sweep",
        ],
    }


def validate_circuit(
    circuit: Dict[str, Any],
    *,
    num_params: Optional[int] = None,
    require_unitary: bool = False,
) -> Tuple[int, List[Dict[str, Any]], bool]:
    """Validate circuit structure, qubit bounds, gate arities, and parameter indices."""
    if not isinstance(circuit, dict):
        raise ValueError("Invalid circuit: expected JSON object.")

    raw_qubits = circuit.get("qubits")
    if not isinstance(raw_qubits, int) or isinstance(raw_qubits, bool):
        raise ValueError("Invalid circuit: 'qubits' must be an integer.")
    if raw_qubits < 1 or raw_qubits > MAX_QUBITS:
        raise ValueError(f"JAX bridge supports 1 to {MAX_QUBITS} qubits; got {raw_qubits}.")

    operations = circuit.get("operations")
    if operations is None:
        operations = []
    if not isinstance(operations, list):
        raise ValueError("Invalid circuit: 'operations' must be a list.")

    seen_non_unitary = False
    has_trajectory_ops = False

    for idx, op in enumerate(operations):
        if not isinstance(op, dict):
            raise ValueError(f"Operation {idx} must be an object.")
        gate = str(op.get("gate", "")).upper()
        if gate not in SUPPORTED_GATES:
            raise ValueError(f"Unsupported gate '{gate}' at operation {idx}.")

        raw_targets = op.get("targets")
        if raw_targets is None:
            raw_targets = []
        if not isinstance(raw_targets, list):
            raise ValueError(f"Operation {idx} ('{gate}'): 'targets' must be a list.")

        targets: List[int] = []
        for t in raw_targets:
            if not isinstance(t, int) or isinstance(t, bool):
                raise ValueError(f"Operation {idx} ('{gate}'): target qubit must be an integer, got {t!r}.")
            if t < 0 or t >= raw_qubits:
                raise ValueError(
                    f"Operation {idx} ('{gate}'): qubit index {t} out of range [0, {raw_qubits - 1}]."
                )
            targets.append(t)

        if len(set(targets)) != len(targets):
            raise ValueError(f"Operation {idx} ('{gate}'): duplicate target qubits {targets}.")

        if gate in SINGLE_QUBIT_GATES and len(targets) != 1:
            raise ValueError(f"Gate '{gate}' requires 1 target qubit, got {len(targets)}.")
        if gate in TWO_QUBIT_GATES and len(targets) != 2:
            raise ValueError(f"Gate '{gate}' requires 2 target qubits, got {len(targets)}.")
        if gate in THREE_QUBIT_GATES and len(targets) != 3:
            raise ValueError(f"Gate '{gate}' requires 3 target qubits, got {len(targets)}.")
        if gate in ("MEASURE", "M", "RESET") and len(targets) != 1:
            raise ValueError(f"Gate '{gate}' requires 1 target qubit, got {len(targets)}.")

        angle = op.get("angle")
        if angle is not None:
            if not isinstance(angle, (int, float)) or isinstance(angle, bool) or not math.isfinite(float(angle)):
                raise ValueError(f"Operation {idx} ('{gate}'): angle must be a finite number, got {angle!r}.")

        param_idx = op.get("paramIndex")
        if param_idx is not None:
            if not isinstance(param_idx, int) or isinstance(param_idx, bool) or param_idx < 0:
                raise ValueError(f"Operation {idx} ('{gate}'): paramIndex must be a non-negative integer.")
            if num_params is not None and param_idx >= num_params:
                raise ValueError(
                    f"Operation {idx} ('{gate}'): paramIndex {param_idx} out of range for {num_params} parameters."
                )

        if gate == "RESET":
            has_trajectory_ops = True
            if require_unitary:
                raise ValueError(
                    "Non-unitary operation 'RESET' is not differentiable in jax:gradient / jax:vmap_sweep. "
                    "Use jax:simulate for projective trajectory simulation."
                )
        elif gate in ("MEASURE", "M"):
            seen_non_unitary = True
        elif gate != "BARRIER" and seen_non_unitary:
            has_trajectory_ops = True
            if require_unitary:
                raise ValueError(
                    "Mid-circuit 'MEASURE' followed by unitary gates is non-differentiable in "
                    "jax:gradient / jax:vmap_sweep. Use jax:simulate for trajectory simulation."
                )

    return raw_qubits, operations, has_trajectory_ops


def _apply_k_qubit_gate(jnp, state, gate_matrix, targets: List[int], num_qubits: int):
    """Apply a k-qubit gate matrix to `targets` via unified tensor contraction."""
    k = len(targets)
    psi = state.reshape((2,) * num_qubits)
    gate_tensor = gate_matrix.reshape((2,) * (2 * k))
    psi = jnp.tensordot(gate_tensor, psi, axes=(list(range(k, 2 * k)), targets))
    remaining = [i for i in range(num_qubits) if i not in targets]
    current_order = list(targets) + remaining
    perm = [current_order.index(i) for i in range(num_qubits)]
    psi = jnp.transpose(psi, perm)
    return psi.reshape((1 << num_qubits,))


def _build_gate_matrix(jnp, gate_name: str, angle: Optional[float] = None):
    g = gate_name.upper()
    inv_sqrt2 = 1.0 / math.sqrt(2.0)
    if g == "H":
        return jnp.array([[inv_sqrt2, inv_sqrt2], [inv_sqrt2, -inv_sqrt2]], dtype=jnp.complex128)
    if g == "X":
        return jnp.array([[0.0, 1.0], [1.0, 0.0]], dtype=jnp.complex128)
    if g == "Y":
        return jnp.array([[0.0, -1.0j], [1.0j, 0.0]], dtype=jnp.complex128)
    if g == "Z":
        return jnp.array([[1.0, 0.0], [0.0, -1.0]], dtype=jnp.complex128)
    if g == "S":
        return jnp.array([[1.0, 0.0], [0.0, 1.0j]], dtype=jnp.complex128)
    if g == "T":
        return jnp.array([[1.0, 0.0], [0.0, jnp.exp(1.0j * jnp.pi / 4.0)]], dtype=jnp.complex128)
    if g == "RX":
        theta = 0.0 if angle is None else angle
        c = jnp.cos(theta / 2.0)
        s = -1.0j * jnp.sin(theta / 2.0)
        return jnp.array([[c, s], [s, c]], dtype=jnp.complex128)
    if g == "RY":
        theta = 0.0 if angle is None else angle
        c = jnp.cos(theta / 2.0)
        s = jnp.sin(theta / 2.0)
        return jnp.array([[c, -s], [s, c]], dtype=jnp.complex128)
    if g == "RZ":
        theta = 0.0 if angle is None else angle
        return jnp.array([[jnp.exp(-0.5j * theta), 0.0], [0.0, jnp.exp(0.5j * theta)]], dtype=jnp.complex128)
    if g in ("CX", "CNOT"):
        return jnp.array(
            [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
                [0.0, 0.0, 1.0, 0.0],
            ],
            dtype=jnp.complex128,
        )
    if g == "CZ":
        return jnp.array(
            [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 0.0, 0.0, -1.0],
            ],
            dtype=jnp.complex128,
        )
    if g == "SWAP":
        return jnp.array(
            [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 0.0, 1.0, 0.0],
                [0.0, 1.0, 0.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
            dtype=jnp.complex128,
        )
    if g == "ISWAP":
        return jnp.array(
            [
                [1.0, 0.0, 0.0, 0.0],
                [0.0, 0.0, 1.0j, 0.0],
                [0.0, 1.0j, 0.0, 0.0],
                [0.0, 0.0, 0.0, 1.0],
            ],
            dtype=jnp.complex128,
        )
    if g in ("CCX", "TOFFOLI"):
        mat = jnp.eye(8, dtype=jnp.complex128)
        mat = mat.at[6, 6].set(0.0).at[6, 7].set(1.0).at[7, 6].set(1.0).at[7, 7].set(0.0)
        return mat
    raise ValueError(f"Unsupported gate '{gate_name}' for JAX quantum simulator.")


def evolve_unitary_jax(jnp, num_qubits: int, operations: List[Dict[str, Any]], params=None):
    """Pure-functional unitary state-vector evolution in JAX."""
    state = jnp.zeros((1 << num_qubits,), dtype=jnp.complex128).at[0].set(1.0 + 0.0j)
    for op in operations:
        gate = str(op.get("gate", "")).upper()
        if gate in NON_UNITARY_GATES:
            continue
        targets = [int(t) for t in op.get("targets", [])]
        angle = op.get("angle")
        if params is not None and op.get("paramIndex") is not None:
            angle = params[int(op["paramIndex"])]
        mat = _build_gate_matrix(jnp, gate, angle)
        state = _apply_k_qubit_gate(jnp, state, mat, targets, num_qubits)
    return state


def _project_and_collapse(jax, jnp, state, qubit: int, num_qubits: int, key, reset: bool = False):
    """Projectively measure `qubit` (and optionally reset to |0>) for one trajectory shot."""
    psi = state.reshape((2,) * num_qubits)
    slicer_one = [slice(None)] * num_qubits
    slicer_one[qubit] = 1
    slicer_zero = [slice(None)] * num_qubits
    slicer_zero[qubit] = 0

    prob_one = jnp.sum(jnp.real(psi[tuple(slicer_one)] * jnp.conj(psi[tuple(slicer_one)])))
    u = jax.random.uniform(key)
    outcome_one = u < prob_one

    def collapse_to_one(p):
        p = p.at[tuple(slicer_zero)].set(0.0 + 0.0j)
        norm = jnp.sqrt(jnp.maximum(prob_one, 1e-30))
        return p / norm

    def collapse_to_zero(p):
        p = p.at[tuple(slicer_one)].set(0.0 + 0.0j)
        prob_zero = jnp.maximum(1.0 - prob_one, 1e-30)
        return p / jnp.sqrt(prob_zero)

    psi = jax.lax.cond(outcome_one, collapse_to_one, collapse_to_zero, psi)
    flat = psi.reshape((1 << num_qubits,))
    if reset:
        x_mat = _build_gate_matrix(jnp, "X")
        flat = jax.lax.cond(
            outcome_one,
            lambda s: _apply_k_qubit_gate(jnp, s, x_mat, [qubit], num_qubits),
            lambda s: s,
            flat,
        )
    return flat


def compute_bloch_vectors(jnp, psi, num_qubits: int) -> List[Dict[str, Any]]:
    """Compute exact single-qubit Bloch vectors (x, y, z) from pure state `psi`."""
    psi_t = psi.reshape((2,) * num_qubits)
    bloch: List[Dict[str, Any]] = []
    for q in range(num_qubits):
        # Move target qubit axis to 0, flatten remaining axes
        perm = [q] + [i for i in range(num_qubits) if i != q]
        reordered = jnp.transpose(psi_t, perm).reshape((2, -1))
        # Reduced density matrix rho = reordered @ reordered.conj().T
        rho00 = jnp.real(jnp.vdot(reordered[0], reordered[0]))
        rho11 = jnp.real(jnp.vdot(reordered[1], reordered[1]))
        rho01 = jnp.sum(reordered[0] * jnp.conj(reordered[1]))
        x = float(2.0 * jnp.real(rho01))
        y = float(-2.0 * jnp.imag(rho01))
        z = float(rho00 - rho11)
        bloch.append({"qubit": q, "x": x, "y": y, "z": z})
    return bloch


def _sample_counts_jax(jax, jnp, probs, num_qubits: int, shots: int, seed: int) -> Dict[str, int]:
    key = jax.random.PRNGKey(seed)
    probs_norm = probs / jnp.sum(probs)
    indices = jax.random.choice(key, jnp.arange(1 << num_qubits), shape=(shots,), p=probs_norm)
    unique, counts = jnp.unique(indices, return_counts=True)
    result: Dict[str, int] = {}
    for idx, cnt in zip(unique.tolist(), counts.tolist()):
        bitstr = format(int(idx), f"0{num_qubits}b")
        result[bitstr] = int(cnt)
    return result


def simulate_circuit(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Execute unitary or projective trajectory simulation using JAX."""
    jax, jnp = require_jax()
    circuit = payload.get("circuit") or {}
    num_qubits, operations, has_trajectory_ops = validate_circuit(circuit, require_unitary=False)

    shots = payload.get("shots", 1024)
    if not isinstance(shots, int) or isinstance(shots, bool) or shots < 1 or shots > MAX_SHOTS:
        raise ValueError(f"Invalid shots count: must be an integer between 1 and {MAX_SHOTS}.")

    seed = payload.get("seed", 42)
    if not isinstance(seed, int) or isinstance(seed, bool) or seed < 0 or seed > 0xFFFFFFFF:
        raise ValueError("Seed must be an unsigned 32-bit integer.")

    if not has_trajectory_ops:
        t0 = time.perf_counter()

        @jax.jit
        def run_unitary():
            psi = evolve_unitary_jax(jnp, num_qubits, operations)
            probs = jnp.real(psi * jnp.conj(psi))
            return psi, probs

        psi, probs = run_unitary()
        psi.block_until_ready()
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        probs_list = [float(x) for x in probs.tolist()]
        state_vector = [{"re": float(c.real), "im": float(c.imag)} for c in psi.tolist()]
        bloch_vectors = compute_bloch_vectors(jnp, psi, num_qubits)
        counts = _sample_counts_jax(jax, jnp, probs, num_qubits, shots, seed)

        return {
            "backend": "jax_quantum",
            "executionMode": "unitary",
            "probabilitiesAreEmpirical": False,
            "device": str(jax.devices()[0]),
            "xlaBackend": str(jax.default_backend()),
            "qubits": num_qubits,
            "shots": shots,
            "elapsedMs": elapsed_ms,
            "probabilities": probs_list,
            "stateVector": state_vector,
            "blochVectors": bloch_vectors,
            "counts": counts,
        }

    # Trajectory mode for mid-circuit RESET / MEASURE
    if shots > MAX_TRAJECTORY_SHOTS:
        raise ValueError(
            f"Trajectory simulations with RESET or mid-circuit MEASURE are limited to {MAX_TRAJECTORY_SHOTS} shots."
        )

    t0 = time.perf_counter()

    def single_shot(shot_key):
        state = jnp.zeros((1 << num_qubits,), dtype=jnp.complex128).at[0].set(1.0 + 0.0j)
        cur_key = shot_key
        for op in operations:
            gate = str(op.get("gate", "")).upper()
            targets = [int(t) for t in op.get("targets", [])]
            if gate == "BARRIER":
                continue
            if gate in ("MEASURE", "M", "RESET"):
                cur_key, subkey = jax.random.split(cur_key)
                state = _project_and_collapse(
                    jax, jnp, state, targets[0], num_qubits, subkey, reset=(gate == "RESET")
                )
            else:
                mat = _build_gate_matrix(jnp, gate, op.get("angle"))
                state = _apply_k_qubit_gate(jnp, state, mat, targets, num_qubits)
        probs = jnp.real(state * jnp.conj(state))
        probs = probs / jnp.sum(probs)
        cur_key, sample_key = jax.random.split(cur_key)
        return jax.random.choice(sample_key, jnp.arange(1 << num_qubits), p=probs)

    master_key = jax.random.PRNGKey(seed)
    shot_keys = jax.random.split(master_key, shots)
    sampled_indices = jax.jit(jax.vmap(single_shot))(shot_keys)
    sampled_indices.block_until_ready()
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    unique, raw_counts = jnp.unique(sampled_indices, return_counts=True)
    counts: Dict[str, int] = {}
    probs_list = [0.0] * (1 << num_qubits)
    for idx, cnt in zip(unique.tolist(), raw_counts.tolist()):
        i = int(idx)
        c = int(cnt)
        counts[format(i, f"0{num_qubits}b")] = c
        probs_list[i] = c / shots

    return {
        "backend": "jax_quantum",
        "executionMode": "trajectory",
        "probabilitiesAreEmpirical": True,
        "device": str(jax.devices()[0]),
        "xlaBackend": str(jax.default_backend()),
        "qubits": num_qubits,
        "shots": shots,
        "elapsedMs": elapsed_ms,
        "probabilities": probs_list,
        "stateVector": [],
        "blochVectors": [],
        "counts": counts,
    }


def expectation_from_observable(jnp, psi, num_qubits: int, observable: List[Dict[str, Any]]):
    """Compute <psi|O|psi> for a sum of Pauli-product observable terms."""
    if not isinstance(observable, list) or len(observable) == 0:
        raise ValueError("Observable must be a non-empty list of Pauli terms.")

    total = jnp.array(0.0, dtype=jnp.float64)
    for term in observable:
        coeff = float(term.get("coeff", 1.0))
        if "paulis" in term:
            op_psi = psi
            for p in term["paulis"]:
                pauli = str(p["pauli"]).upper()
                if pauli not in ("X", "Y", "Z"):
                    raise ValueError(f"Unsupported observable Pauli '{pauli}'.")
                q = int(p["qubit"])
                if q < 0 or q >= num_qubits:
                    raise ValueError(f"Observable qubit {q} out of range [0, {num_qubits - 1}].")
                mat = _build_gate_matrix(jnp, pauli)
                op_psi = _apply_k_qubit_gate(jnp, op_psi, mat, [q], num_qubits)
        else:
            pauli = str(term.get("pauli", "Z")).upper()
            if pauli not in ("X", "Y", "Z"):
                raise ValueError(f"Unsupported observable Pauli '{pauli}'.")
            q = int(term.get("qubit", 0))
            if q < 0 or q >= num_qubits:
                raise ValueError(f"Observable qubit {q} out of range [0, {num_qubits - 1}].")
            mat = _build_gate_matrix(jnp, pauli)
            op_psi = _apply_k_qubit_gate(jnp, psi, mat, [q], num_qubits)
        exp_val = jnp.real(jnp.vdot(psi, op_psi))
        total = total + coeff * exp_val
    return total


def compute_gradient(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Compute <psi(theta)|O|psi(theta)> and its exact gradient via jax.value_and_grad."""
    jax, jnp = require_jax()
    circuit = payload.get("circuit") or {}
    params_in = payload.get("params")
    if not isinstance(params_in, list):
        raise ValueError("'params' must be a list of numbers.")
    num_qubits, operations, _ = validate_circuit(
        circuit, num_params=len(params_in), require_unitary=True
    )
    observable = payload.get("observable") or [{"pauli": "Z", "qubit": 0, "coeff": 1.0}]
    params_arr = jnp.array(params_in, dtype=jnp.float64)

    def loss_fn(theta):
        psi = evolve_unitary_jax(jnp, num_qubits, operations, params=theta)
        return expectation_from_observable(jnp, psi, num_qubits, observable)

    t0 = time.perf_counter()
    val_and_grad = jax.jit(jax.value_and_grad(loss_fn))
    expectation, grad = val_and_grad(params_arr)
    grad.block_until_ready()
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    return {
        "backend": "jax_quantum",
        "device": str(jax.devices()[0]),
        "expectation": float(expectation),
        "gradients": [float(g) for g in grad.tolist()],
        "elapsedMs": elapsed_ms,
    }


def vmap_sweep(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Evaluate a batch of parameter vectors simultaneously using jax.vmap."""
    jax, jnp = require_jax()
    circuit = payload.get("circuit") or {}
    param_batch = payload.get("paramBatch")
    if not isinstance(param_batch, list) or len(param_batch) == 0:
        raise ValueError("'paramBatch' must be a non-empty list of parameter vectors.")
    num_params = len(param_batch[0]) if isinstance(param_batch[0], list) else 0
    num_qubits, operations, _ = validate_circuit(
        circuit, num_params=num_params, require_unitary=True
    )
    observable = payload.get("observable") or [{"pauli": "Z", "qubit": 0, "coeff": 1.0}]
    batch_arr = jnp.array(param_batch, dtype=jnp.float64)

    def single_eval(theta):
        psi = evolve_unitary_jax(jnp, num_qubits, operations, params=theta)
        return expectation_from_observable(jnp, psi, num_qubits, observable)

    t0 = time.perf_counter()
    vmapped = jax.jit(jax.vmap(single_eval))
    expectations = vmapped(batch_arr)
    expectations.block_until_ready()
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    return {
        "backend": "jax_quantum",
        "device": str(jax.devices()[0]),
        "batchSize": len(param_batch),
        "expectations": [float(x) for x in expectations.tolist()],
        "elapsedMs": elapsed_ms,
    }
