#!/usr/bin/env python3
"""Exports reference values from the game design's verify.py as JSON for the backend tests.

docs/game-design/tools/verify.py (Agent 2) is the reference implementation of every formula.
This script imports it read-only and writes backend/test/golden/golden-vectors.json:

  examples    every EX-* example as computed by verify.py
  parameters  parameters.toml parsed by Python's tomllib (parser conformance check)
  rng         exact F-GLB-01 / F-GLB-02 values for a grid of inputs
  formulas    unrounded economy and trade formulas (F-ECO-01…09, F-TRD-01…06) for every market
              and a grid of inputs, plus market tick trajectories (economy.md §5), T-103
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
import math
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


# Market tick trajectories (economy.md §5): markets, seed and length.
TICK_MARKETS = [("berlin", "gras"), ("rotterdam", "kokain"), ("mars", "sternenstaub")]
TICK_SEED = "golden-tick"
TICK_COUNT = 3_000
TICK_SNAPSHOT_EVERY = 250


def pick_event(v, u: float):
    """F-ECO-09 event choice, exactly as the loop in verify.py inv_monte_carlo."""
    acc = 0.0
    for name, ev in v.EVENTS.items():
        acc += ev["probability"]
        if u < acc:
            return name
    return None


def tick_trajectory(v, cid: str, g: str) -> list[dict]:
    """economy.md §5 for one market, the same steps as verify.py inv_monte_carlo.

    Returns the state after every tick in which an event starts or ends, and every
    TICK_SNAPSHOT_EVERY ticks."""
    S, x, active, left = v.target_stock(cid, g), 0.0, None, 0
    out = []
    for t in range(TICK_COUNT):
        changed = False
        ev_s = ev_d = 1.0
        if active is None:
            name = pick_event(v, v.rng_uniform(TICK_SEED, t, f"{cid}/{g}", 0))
            if name is not None:
                active, left, changed = name, v.EVENTS[name]["duration"], True
                S = v.apply_event_shock(S, name)
        if active is not None:
            ev_s, ev_d = v.EVENTS[active]["supply_mult"], v.EVENTS[active]["demand_mult"]
            left -= 1
            if left <= 0:
                active, left, changed = None, 0, True
        x = v.noise_step(x, v.GOODS[g]["volatility"], v.rng_normal(TICK_SEED, t, f"{cid}/{g}", 1))
        S = v.stock_step(S, v.target_stock(cid, g, ev_s))
        if changed or t % TICK_SNAPSHOT_EVERY == 0 or t == TICK_COUNT - 1:
            out.append({"tick": t, "stock": S, "noise": x, "event": active, "left": left,
                        "price": v.market_price(cid, g, S, x, ev_d)})
    return out


def formulas(v) -> dict:
    """Unrounded reference values of the economy and trade formulas (T-103)."""
    eco = v.ECO
    markets = []
    for cid, g in v.markets():
        st = v.target_stock(cid, g)
        prices = [
            {"S": st * f, "x": x, "ev_d": 1.0, "price": v.market_price(cid, g, st * f, x)}
            for f, x in ((0.01, 0.0), (0.5, 0.25), (1.0, 0.0), (2.0, -0.3), (50.0, 0.0))
        ] + [
            {"S": st, "x": 0.1, "ev_d": ev["demand_mult"],
             "price": v.market_price(cid, g, st, 0.1, ev["demand_mult"])}
            for ev in v.EVENTS.values()
        ]
        mo = v.max_order(st)
        buys = []
        for q in sorted({1, max(1, mo // 2), mo}):
            if q < 1 or q > mo:
                continue
            for L, x in ((0, 0.0), (7, 0.2)):
                cost, s_after = v.buy_cost(cid, g, st, q, L, x)
                buys.append({"S": st, "q": q, "L": L, "x": x, "cost": cost, "S_after": s_after})
        sells = []
        for q in (1, 50, 1_000):
            for L, x in ((0, 0.0), (20, -0.2)):
                rev, s_after = v.sell_revenue(cid, g, st, q, L, x)
                sells.append({"S": st, "q": q, "L": L, "x": x, "revenue": rev, "S_after": s_after})
        markets.append({
            "city": cid, "good": g,
            "demand": v.demand(cid, g), "supply_level": v.supply_level(cid, g),
            "ref_stock": v.ref_stock(cid, g), "target_stock": st,
            "equilibrium_price": v.equilibrium_price(cid, g),
            "price_K": v.price_K(cid, g), "max_order": mo,
            "events": {name: {"ref_stock": v.ref_stock(cid, g, ev["demand_mult"]),
                              "target_stock": v.target_stock(cid, g, ev["supply_mult"]),
                              "shocked": v.apply_event_shock(st, name)}
                       for name, ev in v.EVENTS.items()},
            "prices": prices, "buy": buys, "sell": sells,
        })
    integrals = []
    for cid, g in TICK_MARKETS:
        lo, hi = v.price_bounds(g)
        K = v.price_K(cid, g)
        st = v.target_stock(cid, g)
        for a, b in ((0.001 * st, 0.01 * st), (0.01 * st, 3 * st), (0.5 * st, 1.5 * st), (st, 100 * st), (2 * st, 2 * st)):
            integrals.append({"eps": eco["elasticity"], "K": K, "a": a, "b": b, "pmin": lo, "pmax": hi,
                              "value": v.price_integral(K, a, b, lo, hi)})
    acc, bounds = 0.0, []
    for ev in v.EVENTS.values():
        acc += ev["probability"]
        bounds += [math.nextafter(acc, 0.0), acc]
    pick_u = sorted(set([i / 64 for i in range(64)] + [0.0] + bounds))
    return {
        "markets": markets,
        "price_integral": integrals,
        "spread": [{"L": L, "spread": v.spread(L)} for L in (0, 1, 5, 19, 20, 50, 100)],
        "spoiled_quantity": [{"good": g, "q0": q0, "dt": dt, "q": v.spoiled_quantity(q0, g, dt)}
                             for g in v.GOODS for q0 in (100, 7_777) for dt in (0, 1, 144, 1_008, 10_000)],
        "trade_heat": [{"good": g, "H": H, "value": V, "heat": v.trade_heat(H, V, g)}
                       for g in v.GOODS for H in (0.0, 50.0, 99.9) for V in (0, 123_456, 1_000_000_000)],
        "carry_capacity": [{"vehicle": veh, "capacity": v.carry_capacity(veh)}
                           for veh in [None, *v.P["vehicles"]]],
        "pick_event": [{"u": u, "event": pick_event(v, u)} for u in pick_u],
        "half_life": [{"lambda": lam, "ticks": v.half_life(lam)}
                      for lam in (eco["reversion_rate"], 0.01, 0.5, 0.9)],
        "stock_after": [{"S0": s0, "S_target": 1_000.0, "ticks": n, "S": v.stock_after(s0, 1_000.0, n)}
                        for s0 in (1.0, 500.0, 5_000.0) for n in (0, 1, 34, 144)],
        "ticks": {"seed": TICK_SEED, "count": TICK_COUNT,
                  "markets": [{"city": cid, "good": g, "initial_stock": v.target_stock(cid, g),
                               "snapshots": tick_trajectory(v, cid, g)} for cid, g in TICK_MARKETS]},
    }


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
        "formulas": formulas(v),
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
