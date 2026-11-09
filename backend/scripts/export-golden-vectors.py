#!/usr/bin/env python3
"""Exports reference values from the game design's verify.py as JSON for the backend tests.

docs/game-design/tools/verify.py (Agent 2) is the reference implementation of every formula.
This script imports it read-only and writes backend/test/golden/golden-vectors.json:

  examples    every EX-* example as computed by verify.py
  parameters  parameters.toml parsed by Python's tomllib (parser conformance check)
  rng         exact F-GLB-01 / F-GLB-02 values for a grid of inputs
  sources     SHA-256 of parameters.toml and verify.py the file was generated from

Usage (run from anywhere, standard library only, Python >= 3.11):
  python3 -I backend/scripts/export-golden-vectors.py          # (re)write the JSON file
  python3 -I backend/scripts/export-golden-vectors.py --check  # fail if the file is outdated

Floats are written with repr() precision by the json module, so JavaScript's JSON.parse yields
bit-identical doubles.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import tomllib
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
DESIGN = REPO / "docs" / "game-design"
VERIFY = DESIGN / "tools" / "verify.py"
PARAMS = DESIGN / "parameters.toml"
OUTPUT = REPO / "backend" / "test" / "golden" / "golden-vectors.json"

RNG_SEEDS = ["demo-server", "s3cr3t-server-seed"]
RNG_TICKS = [0, 1, 144, 1_000_000]
RNG_ENTITIES = ["berlin/gras", "fight/8812", "player/ä€😀"]
RNG_INDICES = [0, 1, 7]


def load_verify():
    spec = importlib.util.spec_from_file_location("verify", VERIFY)
    if spec is None or spec.loader is None:
        raise SystemExit(f"cannot load {VERIFY}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build() -> str:
    v = load_verify()
    rng = [
        {
            "seed": seed,
            "tick": tick,
            "entity": entity,
            "k": k,
            "uniform": v.rng_uniform(seed, tick, entity, k),
            "normal": v.rng_normal(seed, tick, entity, k),
        }
        for seed in RNG_SEEDS
        for tick in RNG_TICKS
        for entity in RNG_ENTITIES
        for k in RNG_INDICES
    ]
    data = {
        "generatedBy": "backend/scripts/export-golden-vectors.py",
        "sources": {
            "parameters.toml": sha256_file(PARAMS),
            "verify.py": sha256_file(VERIFY),
        },
        "examples": {ex_id: fn() for ex_id, fn in sorted(v.EXAMPLES.items())},
        "parameters": tomllib.loads(PARAMS.read_text(encoding="utf-8")),
        "rng": rng,
    }
    return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True, allow_nan=False) + "\n"


def main(argv: list[str]) -> int:
    content = build()
    if "--check" in argv:
        current = OUTPUT.read_text(encoding="utf-8") if OUTPUT.exists() else ""
        if current != content:
            print(
                f"{OUTPUT.relative_to(REPO)} is outdated: parameters.toml or verify.py changed.\n"
                "Regenerate with: python3 -I backend/scripts/export-golden-vectors.py",
                file=sys.stderr,
            )
            return 1
        print("golden vectors up to date")
        return 0
    OUTPUT.write_text(content, encoding="utf-8")
    print(f"wrote {OUTPUT.relative_to(REPO)} ({len(content)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
