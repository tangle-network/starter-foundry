"""argparse CLI: ``python -m eval [run|compare]``."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from .regression import (
    DEFAULT_ALPHA,
    DEFAULT_D_THRESHOLD,
    DEFAULT_RESAMPLES,
    DEFAULT_SEED,
    GateReport,
    regression_gate,
)
from .runner import RunConfig, run_scenarios
from .sandbox_runner import SandboxDriver
from .scorecard import load_scorecard, write_scorecard

log = logging.getLogger("eval.cli")


def _build_run_parser(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("run", help="run scenarios against an agent and emit a scorecard")
    p.add_argument(
        "--scenarios",
        type=Path,
        default=Path("scenarios"),
        help="directory containing scenario *.py modules (default: scenarios/)",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=Path("scorecard.json"),
        help="scorecard output path (default: scorecard.json)",
    )
    p.add_argument(
        "--driver",
        choices=["local", "http", "sandbox"],
        default="local",
        help="agent-under-test driver (default: local)",
    )
    p.add_argument("--agent-url", default=None, help="agent endpoint URL (driver=http)")
    p.add_argument(
        "--bundle",
        type=Path,
        default=None,
        help="agent bundle directory (driver=sandbox)",
    )
    p.add_argument(
        "--sandbox-image",
        default="node:20",
        help="sandbox image (driver=sandbox, default node:20)",
    )
    p.add_argument(
        "--sandbox-name",
        default="eval-harness",
        help="sandbox name prefix (driver=sandbox)",
    )
    p.add_argument(
        "--product",
        default="agent-eval-harness-py",
        help="scorecard.product field (default: agent-eval-harness-py)",
    )


def _build_compare_parser(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("compare", help="compare two scorecards via Welch + Cohen + bootstrap CI")
    p.add_argument("baseline", type=Path, help="baseline scorecard JSON")
    p.add_argument("head", type=Path, help="head scorecard JSON")
    p.add_argument(
        "--alpha",
        type=float,
        default=DEFAULT_ALPHA,
        help=f"Welch p-value threshold (default {DEFAULT_ALPHA})",
    )
    p.add_argument(
        "--d-threshold",
        type=float,
        default=DEFAULT_D_THRESHOLD,
        help=f"Cohen d magnitude threshold (default {DEFAULT_D_THRESHOLD})",
    )
    p.add_argument(
        "--resamples",
        type=int,
        default=DEFAULT_RESAMPLES,
        help=f"bootstrap resamples (default {DEFAULT_RESAMPLES})",
    )
    p.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help=f"bootstrap RNG seed (default {DEFAULT_SEED:#x})",
    )
    p.add_argument(
        "--samples",
        type=Path,
        default=None,
        help=(
            "optional JSON file mapping flow name -> {baseline:[...], head:[...]} "
            "of repeated samples. When absent, compare uses the single value from "
            "each scorecard (degenerate gate — emits a warning)."
        ),
    )
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="write the gate report JSON to this path (in addition to stdout)",
    )


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="eval",
        description="Python eval harness — run scenarios + gate regressions.",
    )
    parser.add_argument("--log-level", default="INFO", help="logging level (default INFO)")
    sub = parser.add_subparsers(dest="cmd", required=True)
    _build_run_parser(sub)
    _build_compare_parser(sub)
    return parser


# ----------------------------------------------------------------------
# `run`
# ----------------------------------------------------------------------


def _cmd_run(args: argparse.Namespace) -> int:
    cfg = RunConfig(
        scenarios_dir=args.scenarios,
        out_path=args.out,
        driver=args.driver,
        agent_url=args.agent_url,
        bundle_dir=args.bundle,
        sandbox_image=args.sandbox_image,
        sandbox_name_prefix=args.sandbox_name,
        product=args.product,
    )

    if cfg.driver == "sandbox":
        if cfg.bundle_dir is None:
            sys.stderr.write("[blocked] --driver sandbox requires --bundle <dir>\n")
            return 2
        with SandboxDriver(
            bundle_dir=cfg.bundle_dir,
            image=cfg.sandbox_image,
            name=cfg.sandbox_name_prefix,
        ) as drv:
            scorecard = run_scenarios(cfg, sandbox_runner=drv)
    else:
        scorecard = run_scenarios(cfg)

    out_path = write_scorecard(scorecard, cfg.out_path)
    sys.stdout.write(
        f"[eval.run] product={scorecard.product} "
        f"aggregate={scorecard.aggregate:.4f} "
        f"coverage={scorecard.coverage} "
        f"out={out_path}\n"
    )
    # Surface every flow status compactly
    for f in scorecard.flows:
        v = f"{f.value:.4f}" if f.value is not None else "—"
        sys.stdout.write(
            f"  [{f.status:>10}] {f.name:<40} value={v}  target={f.target:.4f}  ({f.direction})\n"
        )
    # Non-zero exit when any flow regressed (callers can gate CI on this).
    failed = [f for f in scorecard.flows if f.status == "fail"]
    return 1 if failed else 0


# ----------------------------------------------------------------------
# `compare`
# ----------------------------------------------------------------------


def _load_samples(path: Path | None) -> dict[str, dict[str, list[float]]] | None:
    if path is None:
        return None
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"--samples file {path} must be a JSON object")
    out: dict[str, dict[str, list[float]]] = {}
    for k, v in data.items():
        if not isinstance(v, dict) or "baseline" not in v or "head" not in v:
            raise ValueError(
                f"--samples[{k!r}] must be {{baseline:[...], head:[...]}}"
            )
        out[k] = {
            "baseline": [float(x) for x in v["baseline"]],
            "head": [float(x) for x in v["head"]],
        }
    return out


def _cmd_compare(args: argparse.Namespace) -> int:
    baseline = load_scorecard(args.baseline)
    head = load_scorecard(args.head)
    samples = _load_samples(args.samples)

    head_by_name = {f.name: f for f in head.flows}
    report = GateReport()

    for bf in baseline.flows:
        hf = head_by_name.get(bf.name)
        if hf is None:
            sys.stdout.write(f"  [missing-head] {bf.name}: present in baseline, absent in head\n")
            continue
        if bf.value is None or hf.value is None:
            sys.stdout.write(
                f"  [unmeasured] {bf.name}: skipping gate (baseline={bf.value} head={hf.value})\n"
            )
            continue
        if samples and bf.name in samples:
            base_arr = samples[bf.name]["baseline"]
            head_arr = samples[bf.name]["head"]
        else:
            sys.stderr.write(
                f"  [warn] {bf.name}: --samples not provided; gate degrades to single-value compare\n"
            )
            base_arr = [bf.value] * 8
            head_arr = [hf.value] * 8
        v = regression_gate(
            flow=bf.name,
            baseline=base_arr,
            head=head_arr,
            direction=bf.direction,
            alpha=args.alpha,
            d_threshold=args.d_threshold,
            resamples=args.resamples,
            seed=args.seed,
        )
        report.verdicts.append(v)
        tag = "REGRESS" if v.regressed else "ok"
        sys.stdout.write(f"  [{tag:>7}] {v.reason}\n")

    payload = report.to_dict()
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with args.out.open("w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        sys.stdout.write(f"[eval.compare] wrote {args.out}\n")

    if report.any_regressed:
        sys.stdout.write(
            f"[eval.compare] FAIL: {len(report.regressed_flows)} regressed: "
            f"{', '.join(report.regressed_flows)}\n"
        )
        return 1
    sys.stdout.write("[eval.compare] PASS: no flow regressed\n")
    return 0


# ----------------------------------------------------------------------
# entrypoint
# ----------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    if args.cmd == "run":
        return _cmd_run(args)
    if args.cmd == "compare":
        return _cmd_compare(args)
    parser.error(f"unknown command {args.cmd!r}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
