"""argparse-based CLI for the research-harness."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from . import __version__
from .proposer import propose
from .runner import (
    DEFAULT_QUEUE_PATH,
    DEFAULT_RESULTS_DIR,
    DEFAULT_TOP_K,
    DEFAULT_VALIDATE_REPS,
    load_queue,
    save_queue,
    screen,
    sweep,
    validate,
)
from .types import ProposerConfig


def _add_common(p: argparse.ArgumentParser) -> None:
    p.add_argument(
        "--queue",
        type=Path,
        default=DEFAULT_QUEUE_PATH,
        help="path to hypotheses/queue.json",
    )
    p.add_argument(
        "--results-dir",
        type=Path,
        default=DEFAULT_RESULTS_DIR,
        help="directory for emitted result JSON",
    )


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="research",
        description="Python research harness — propose / screen / validate / sweep",
    )
    p.add_argument("--version", action="version", version=f"research {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_propose = sub.add_parser("propose", help="generate new hypothesis variants")
    _add_common(p_propose)
    p_propose.add_argument(
        "-n", "--n-proposals", type=int, default=3, help="number of variants to draft"
    )
    p_propose.add_argument(
        "--model",
        default="anthropic/claude-sonnet-4",
        help="model id on router.tangle.tools",
    )
    p_propose.add_argument(
        "--temperature", type=float, default=0.7, help="sampling temperature"
    )

    p_screen = sub.add_parser("screen", help="rank queued hypotheses (1 rep each)")
    _add_common(p_screen)

    p_validate = sub.add_parser("validate", help="multi-rep validation of winners")
    _add_common(p_validate)
    p_validate.add_argument(
        "--reps",
        type=int,
        default=DEFAULT_VALIDATE_REPS,
        help="reps per winning hypothesis",
    )
    p_validate.add_argument(
        "--top-k",
        type=int,
        default=DEFAULT_TOP_K,
        help="how many screening winners to validate",
    )

    p_sweep = sub.add_parser("sweep", help="screen then validate end-to-end")
    _add_common(p_sweep)
    p_sweep.add_argument("--reps", type=int, default=DEFAULT_VALIDATE_REPS)
    p_sweep.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)

    return p


def _cmd_propose(args: argparse.Namespace) -> int:
    queue = load_queue(args.queue)
    cfg = ProposerConfig(
        n_proposals=args.n_proposals,
        model=args.model,
        temperature=args.temperature,
    )
    new, errors = propose(queue, recent_verdicts=[], config=cfg)
    if errors:
        for e in errors:
            print(f"[propose] rejected: {e}", file=sys.stderr)
    if not new:
        print("[propose] no valid proposals returned", file=sys.stderr)
        return 1
    save_queue(queue + new, args.queue)
    print(json.dumps({"appended": [h.id for h in new], "rejected": len(errors)}))
    return 0


def _cmd_screen(args: argparse.Namespace) -> int:
    ranking = screen(args.queue, args.results_dir)
    print(json.dumps(ranking.model_dump(), indent=2))
    return 0


def _cmd_validate(args: argparse.Namespace) -> int:
    verdicts = validate(
        args.queue, args.results_dir, n_reps=args.reps, top_k=args.top_k
    )
    print(json.dumps([v.model_dump() for v in verdicts], indent=2))
    return 0 if verdicts else 1


def _cmd_sweep(args: argparse.Namespace) -> int:
    verdicts = sweep(
        args.queue, args.results_dir, top_k=args.top_k, n_reps=args.reps
    )
    print(json.dumps([v.model_dump() for v in verdicts], indent=2))
    return 0 if verdicts else 1


_DISPATCH = {
    "propose": _cmd_propose,
    "screen": _cmd_screen,
    "validate": _cmd_validate,
    "sweep": _cmd_sweep,
}


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    handler = _DISPATCH[args.cmd]
    return handler(args)


if __name__ == "__main__":
    raise SystemExit(main())
