"""Runner — orchestrates the propose / screen / validate loop.

Reads `hypotheses/queue.json`, dispatches sandbox runs, persists
results to `research-results/<hypothesis-id>/<run-id>.json`, and
returns structured verdicts.

The runner is intentionally I/O-thin: most logic lives in the
purpose-specific modules (`screener`, `validator`, `sandbox_runner`,
`proposer`). The runner wires them together and handles persistence.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import platform
import sys
import uuid
from collections import defaultdict
from pathlib import Path

from pydantic import ValidationError

from . import __version__
from .sandbox_runner import SandboxRunConfig, run_hypothesis_rep
from .screener import ScreeningRanking, run_screen
from .types import Hypothesis, HypothesisResult, ValidationVerdict
from .validator import run_validate

DEFAULT_QUEUE_PATH = Path("hypotheses/queue.json")
DEFAULT_RESULTS_DIR = Path("research-results")
DEFAULT_TOP_K = 3
DEFAULT_VALIDATE_REPS = 5


def _scipy_version() -> str:
    try:
        import scipy  # noqa: PLC0415

        return scipy.__version__
    except Exception:
        return "unknown"


def load_queue(path: Path = DEFAULT_QUEUE_PATH) -> list[Hypothesis]:
    """Load + validate the hypothesis queue.

    Malformed entries cause the whole load to fail — we'd rather
    raise loudly than silently drop a hypothesis the operator
    expected to run.
    """
    if not path.exists():
        return []
    raw = json.loads(path.read_text())
    if not isinstance(raw, list):
        raise ValueError(f"{path}: queue root must be a JSON array")
    out: list[Hypothesis] = []
    for i, entry in enumerate(raw):
        try:
            out.append(Hypothesis.model_validate(entry))
        except ValidationError as e:
            raise ValueError(f"{path} entry [{i}] invalid: {e}") from e
    return out


def save_queue(queue: list[Hypothesis], path: Path = DEFAULT_QUEUE_PATH) -> None:
    """Atomic-replace write of the queue."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(
        json.dumps(
            [h.model_dump(by_alias=True) for h in queue],
            indent=2,
            sort_keys=False,
        )
        + "\n"
    )
    os.replace(tmp, path)


def _hypothesis_hash(h: Hypothesis) -> str:
    payload = json.dumps(h.model_dump(by_alias=True), sort_keys=True).encode()
    return hashlib.sha256(payload).hexdigest()[:16]


def _provenance(h: Hypothesis) -> dict[str, str]:
    return {
        "harness_version": __version__,
        "scipy_version": _scipy_version(),
        "python_version": sys.version.split()[0],
        "platform": platform.platform(),
        "sandbox_image": h.sandbox_image,
        "hypothesis_hash": _hypothesis_hash(h),
        "timestamp": dt.datetime.now(dt.timezone.utc).isoformat(),
    }


def _persist(
    results_dir: Path,
    hypothesis: Hypothesis,
    phase: str,
    payload: dict[str, object],
) -> Path:
    out_dir = results_dir / hypothesis.id
    out_dir.mkdir(parents=True, exist_ok=True)
    run_id = f"{phase}-{uuid.uuid4().hex[:12]}"
    path = out_dir / f"{run_id}.json"
    body = {"provenance": _provenance(hypothesis), **payload}
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(body, indent=2) + "\n")
    os.replace(tmp, path)
    return path


def _collect_reps(
    hypotheses: list[Hypothesis],
    n_reps: int,
    config: SandboxRunConfig | None,
    *,
    client_factory: object | None = None,
) -> dict[str, list[HypothesisResult]]:
    """Run `n_reps` reps of every hypothesis. One sandbox per rep."""
    out: dict[str, list[HypothesisResult]] = defaultdict(list)
    for h in hypotheses:
        for rep in range(n_reps):
            results = run_hypothesis_rep(
                h, rep, config, client_factory=client_factory  # type: ignore[arg-type]
            )
            out[h.id].extend(results)
    return out


def screen(
    queue_path: Path = DEFAULT_QUEUE_PATH,
    results_dir: Path = DEFAULT_RESULTS_DIR,
    config: SandboxRunConfig | None = None,
    *,
    client_factory: object | None = None,
) -> ScreeningRanking:
    """1 rep per hypothesis. Persist per-hypothesis run + ranking."""
    queue = load_queue(queue_path)
    if not queue:
        return ScreeningRanking(rows=[])
    results = _collect_reps(queue, 1, config, client_factory=client_factory)
    ranking = run_screen(results)
    for h in queue:
        _persist(
            results_dir,
            h,
            "screen",
            {
                "phase": "screen",
                "results": [r.model_dump() for r in results.get(h.id, [])],
            },
        )
    (results_dir / "screen-ranking.json").write_text(
        json.dumps(ranking.model_dump(), indent=2) + "\n"
    )
    return ranking


def validate(
    queue_path: Path = DEFAULT_QUEUE_PATH,
    results_dir: Path = DEFAULT_RESULTS_DIR,
    n_reps: int = DEFAULT_VALIDATE_REPS,
    top_k: int = DEFAULT_TOP_K,
    config: SandboxRunConfig | None = None,
    *,
    client_factory: object | None = None,
    winners: list[str] | None = None,
) -> list[ValidationVerdict]:
    """Multi-rep validation on screening winners.

    If `winners` is provided, validate exactly that subset. Otherwise
    re-run a fresh screen and take the top_k.
    """
    queue = load_queue(queue_path)
    if not queue:
        return []
    if winners is None:
        ranking = screen(queue_path, results_dir, config, client_factory=client_factory)
        winners = ranking.top(top_k)
    short = [h for h in queue if h.id in winners]
    if not short:
        return []
    results = _collect_reps(short, n_reps, config, client_factory=client_factory)
    verdicts = run_validate(results)
    by_id = {v.hypothesis_id: v for v in verdicts}
    for h in short:
        v = by_id.get(h.id)
        _persist(
            results_dir,
            h,
            "validate",
            {
                "phase": "validate",
                "n_reps": n_reps,
                "results": [r.model_dump() for r in results.get(h.id, [])],
                "verdict": v.model_dump() if v else None,
            },
        )
    (results_dir / "validate-verdicts.json").write_text(
        json.dumps([v.model_dump() for v in verdicts], indent=2) + "\n"
    )
    return verdicts


def sweep(
    queue_path: Path = DEFAULT_QUEUE_PATH,
    results_dir: Path = DEFAULT_RESULTS_DIR,
    top_k: int = DEFAULT_TOP_K,
    n_reps: int = DEFAULT_VALIDATE_REPS,
    config: SandboxRunConfig | None = None,
    *,
    client_factory: object | None = None,
) -> list[ValidationVerdict]:
    """Convenience: screen then validate the top_k."""
    ranking = screen(queue_path, results_dir, config, client_factory=client_factory)
    winners = ranking.top(top_k)
    return validate(
        queue_path,
        results_dir,
        n_reps=n_reps,
        top_k=top_k,
        config=config,
        client_factory=client_factory,
        winners=winners,
    )
