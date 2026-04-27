"""
Pytest fixtures + path resolution.

Tests live at `scripts/python/tests/`; the canonical fixtures live at
`<repo>/tests/fixtures/`. We resolve the repo root by walking up from this
file and reuse those exact directories — no duplication, no drift.
"""

from __future__ import annotations

from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent.parent
FIXTURES = REPO / "tests" / "fixtures"


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO


@pytest.fixture(scope="session")
def fixtures_dir() -> Path:
    return FIXTURES


@pytest.fixture(scope="session")
def example_bundle(fixtures_dir: Path) -> Path:
    return fixtures_dir / "agent-bundle-example"


@pytest.fixture(scope="session")
def multi_bundle(fixtures_dir: Path) -> Path:
    return fixtures_dir / "agent-bundle-multi"


@pytest.fixture(scope="session")
def invalid_bundle(fixtures_dir: Path) -> Path:
    return fixtures_dir / "agent-bundle-invalid"
