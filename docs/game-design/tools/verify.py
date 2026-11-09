#!/usr/bin/env python3
"""Referenzimplementierung und Prüfskript für docs/game-design.

Jede Formel aus den Design-Dokumenten ist hier als reine Funktion umgesetzt
(Formel-ID im Docstring, z. B. F-ECO-06). Alle Beispielrechnungen (EX-*) werden
nachgerechnet und mit den in den Dokumenten genannten Werten verglichen.
Zusätzlich werden Balancing-Invarianten (INV-*) und die Konsistenz zwischen
Markdown, Parametern und diesem Skript geprüft (DOC-*).

Aufruf:
    python3 docs/game-design/tools/verify.py            # alle Prüfungen
    python3 docs/game-design/tools/verify.py --print    # berechnete Beispielwerte ausgeben
    python3 docs/game-design/tools/verify.py --price-table  # Gleichgewichtspreise als Markdown

Nur Python-Standardbibliothek (>= 3.11, wegen tomllib).
"""
from __future__ import annotations

import hashlib
import math
import re
import sys
import tomllib
from pathlib import Path

DOC_DIR = Path(__file__).resolve().parent.parent
P = tomllib.loads((DOC_DIR / "parameters.toml").read_text(encoding="utf-8"))

ECO = P["economy"]
GOODS = P["goods"]
EVENTS = P["events"]
TRV = P["travel"]
PRF = P["professions"]
CMB = P["combat"]
CLN = P["clans"]
LAU = P["laundering"]
RE = P["real_estate"]
SPC = P["space"]
NPC = P["npc"]
HEAT = P["heat"]

TICKS_PER_DAY = P["meta"]["ticks_per_day"]
TICKS_PER_HOUR = 60 // P["meta"]["tick_minutes"]
EPS = 1e-9


# =============================================================================
# Hilfsfunktionen
# =============================================================================
def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def ceil_ct(x: float) -> int:
    """Spieler zahlt: aufrunden auf ganze Cent (Toleranz gegen Float-Rauschen)."""
    return math.ceil(x - EPS)


def floor_ct(x: float) -> int:
    """Spieler erhält: abrunden auf ganze Cent."""
    return math.floor(x + EPS)


def round_half_up(x: float) -> int:
    return math.floor(x + 0.5)


def loc(cid: str) -> tuple[dict, str]:
    if cid in P["city"]:
        return P["city"][cid], "earth"
    return P["space_location"][cid], "space"


def multipliers(cid: str, g: str) -> tuple[float, float] | None:
    """(m_s, m_d) eines Marktes oder None, wenn die Ware dort nicht gehandelt wird."""
    c, realm = loc(cid)
    s, d = c.get("supply", {}), c.get("demand", {})
    if GOODS[g]["realm"] == realm:
        return s.get(g, 1.0), d.get(g, 1.0)
    if g in s and g in d:
        return s[g], d[g]
    return None


def markets():
    for cid in list(P["city"]) + list(P["space_location"]):
        for g in GOODS:
            if multipliers(cid, g) is not None:
                yield cid, g


# =============================================================================
# Globale Konventionen (README.md)
# =============================================================================
def rng_uniform(seed: str, tick: int, entity: str, k: int = 0) -> float:
    """F-GLB-01: deterministische Gleichverteilung U ∈ [0, 1)."""
    h = hashlib.sha256(f"{seed}:{tick}:{entity}:{k}".encode()).digest()
    return int.from_bytes(h[:8], "big") / 2**64


def rng_normal(seed: str, tick: int, entity: str, k: int = 0) -> float:
    """F-GLB-02: Standardnormalverteilung per Box-Muller aus zwei F-GLB-01-Ziehungen."""
    u1 = rng_uniform(seed, tick, entity, 2 * k)
    u2 = rng_uniform(seed, tick, entity, 2 * k + 1)
    return math.sqrt(-2.0 * math.log(1.0 - u1)) * math.cos(2.0 * math.pi * u2)


def networth(cash_black: int, cash_white: int, assets_ct: int, goods: dict[str, int],
             clan_treasury: int = 0, clan_members: int = 1) -> int:
    """F-GLB-03: NW = Schwarz + Weiß + Sachwerte + Σ q·P_base + ⌊s · Clankasse / Mitglieder⌋."""
    clan_share = floor_ct(P["clans"]["networth_treasury_share"] * clan_treasury / max(1, clan_members))
    return cash_black + cash_white + assets_ct + sum(q * GOODS[g]["base_price"] for g, q in goods.items()) + clan_share


# =============================================================================
# Wirtschaft (economy.md)
# =============================================================================
def demand(cid: str, g: str, ev_d: float = 1.0) -> float:
    """F-ECO-01: Nachfrage pro Tick D = pop · c · W^β · m_d · M_d."""
    c, _ = loc(cid)
    _, md = multipliers(cid, g)
    return c["pop"] * GOODS[g]["consumption"] * c["wealth"] ** P["cities"]["demand_wealth_exponent"] * md * ev_d


def supply_level(cid: str, g: str) -> float:
    """F-ECO-02: Angebotsniveau pro Tick A = pop · c · W^β · m_s."""
    c, _ = loc(cid)
    ms, _ = multipliers(cid, g)
    return c["pop"] * GOODS[g]["consumption"] * c["wealth"] ** P["cities"]["demand_wealth_exponent"] * ms


def ref_stock(cid: str, g: str, ev_d: float = 1.0) -> float:
    """F-ECO-03 (a): Referenzbestand S_ref = D · cover."""
    return demand(cid, g, ev_d) * ECO["cover_ticks"]


def target_stock(cid: str, g: str, ev_s: float = 1.0) -> float:
    """F-ECO-03 (b): Zielbestand S_target = A · cover · M_s."""
    return supply_level(cid, g) * ECO["cover_ticks"] * ev_s


def stock_step(S: float, S_target: float) -> float:
    """F-ECO-04: S_{t+1} = max(S_min, S_t + λ (S_target − S_t))."""
    return max(ECO["min_stock"], S + ECO["reversion_rate"] * (S_target - S))


def stock_after(S0: float, S_target: float, ticks: int) -> float:
    """F-ECO-04 geschlossen: S_t = S_target + (S_0 − S_target)(1 − λ)^t."""
    return S_target + (S0 - S_target) * (1 - ECO["reversion_rate"]) ** ticks


def noise_step(x: float, sigma: float, z: float) -> float:
    """F-ECO-05: x_{t+1} = ρ x_t + σ z_t, Rauschfaktor N = e^x."""
    return ECO["noise_rho"] * x + sigma * z


def price_bounds(g: str) -> tuple[float, float]:
    pb = GOODS[g]["base_price"]
    return pb * ECO["price_min_factor"], pb * ECO["price_max_factor"]


def price_K(cid: str, g: str, x: float = 0.0, ev_d: float = 1.0) -> float:
    c, _ = loc(cid)
    return (GOODS[g]["base_price"] * c["wealth"] ** ECO["wealth_price_exponent"]
            * ref_stock(cid, g, ev_d) ** ECO["elasticity"] * math.exp(x))


def market_price(cid: str, g: str, S: float, x: float = 0.0, ev_d: float = 1.0) -> float:
    """F-ECO-06: P = clamp(P_base · W^ω · (S_ref / S)^ε · e^x, P_min, P_max)."""
    lo, hi = price_bounds(g)
    return clamp(price_K(cid, g, x, ev_d) * S ** -ECO["elasticity"], lo, hi)


def equilibrium_price(cid: str, g: str) -> float:
    """F-ECO-07: P* = P_base · W^ω · (m_d / m_s)^ε (ungeklemmt)."""
    c, _ = loc(cid)
    ms, md = multipliers(cid, g)
    return GOODS[g]["base_price"] * c["wealth"] ** ECO["wealth_price_exponent"] * (md / ms) ** ECO["elasticity"]


def half_life(lam: float) -> float:
    """F-ECO-08: t_½ = ln(0,5) / ln(1 − λ) in Ticks."""
    return math.log(0.5) / math.log(1 - lam)


def apply_event_shock(S: float, ev: str) -> float:
    """F-ECO-09: Bei Ereignisbeginn S ← S · shock; während der Dauer M_s, M_d aktiv."""
    return S * EVENTS[ev]["stock_shock"]


# =============================================================================
# Handel (trade.md)
# =============================================================================
def price_integral(K: float, a: float, b: float, pmin: float, pmax: float) -> float:
    """∫_a^b clamp(K·S^-ε, pmin, pmax) dS, stückweise geschlossen (Teil von F-TRD-01)."""
    eps = ECO["elasticity"]
    s_hi = (K / pmax) ** (1 / eps)   # S < s_hi  -> Preis = pmax
    s_lo = (K / pmin) ** (1 / eps)   # S > s_lo  -> Preis = pmin
    total = 0.0
    # Abschnitt mit Höchstpreis
    x0, x1 = a, min(b, s_hi)
    if x1 > x0:
        total += pmax * (x1 - x0)
    # Abschnitt mit freiem Preis
    x0, x1 = max(a, s_hi), min(b, s_lo)
    if x1 > x0:
        if abs(eps - 1.0) < 1e-12:
            total += K * (math.log(x1) - math.log(x0))
        else:
            total += K * (x1 ** (1 - eps) - x0 ** (1 - eps)) / (1 - eps)
    # Abschnitt mit Mindestpreis
    x0, x1 = max(a, s_lo), b
    if x1 > x0:
        total += pmin * (x1 - x0)
    return total


def bonus(name: str, L: int) -> float:
    """F-PRF-03: Bonus = min(cap, rate · L)."""
    rate = PRF[name]
    cap = PRF.get(name + "_cap", float("inf"))
    return min(cap, rate * L)


def spread(L_handel: int = 0) -> float:
    """F-TRD-03: s = s_base · (1 − Bonus_Handel(L))."""
    return P["trade"]["spread_base"] * (1 - bonus("handel_spread_reduction", L_handel))


def max_order(S: float) -> int:
    return math.floor(min(P["trade"]["max_trade_share"] * S, S - ECO["min_stock"]))


def buy_cost(cid: str, g: str, S: float, q: int, L_handel: int = 0, x: float = 0.0) -> tuple[int, float]:
    """F-TRD-01: C = ⌈(1 + s/2) · ∫_{S−q}^{S} P(σ) dσ⌉; neuer Bestand S − q."""
    if not 0 < q <= max_order(S):
        raise ValueError("Ordergröße unzulässig")
    lo, hi = price_bounds(g)
    integral = price_integral(price_K(cid, g, x), S - q, S, lo, hi)
    return ceil_ct((1 + spread(L_handel) / 2) * integral), S - q


def sell_revenue(cid: str, g: str, S: float, q: int, L_handel: int = 0, x: float = 0.0) -> tuple[int, float]:
    """F-TRD-02: R = ⌊(1 − s/2) · ∫_{S}^{S+q} P(σ) dσ⌋; neuer Bestand S + q."""
    if q <= 0:
        raise ValueError("Ordergröße unzulässig")
    lo, hi = price_bounds(g)
    integral = price_integral(price_K(cid, g, x), S, S + q, lo, hi)
    return floor_ct((1 - spread(L_handel) / 2) * integral), S + q


def spoiled_quantity(Q0: int, g: str, dt: int) -> int:
    """F-TRD-04: Q(t) = ⌊Q_0 · (1 − r)^(t − t_0)⌋ (lazy ausgewertet)."""
    return math.floor(Q0 * (1 - GOODS[g]["spoil_rate"]) ** dt + EPS)


def trade_heat(H: float, value_ct: int, g: str) -> float:
    """F-TRD-05: H ← min(H_max, H + k · V/100 000 · h_Ware)."""
    return min(HEAT["max"], H + HEAT["trade_heat_per_keur"] * value_ct / 100_000 * GOODS[g]["heat"])


def carry_capacity(vehicle: str | None) -> int:
    """F-TRD-06: Kapazität = Rucksack + Fahrzeug; Σ q_i · vol_i ≤ Kapazität."""
    cap = P["player"]["backpack_capacity"]
    if vehicle:
        cap += P["vehicles"][vehicle]["capacity"]
    return cap


# =============================================================================
# Städte (cities.md)
# =============================================================================
def heat_decay(H: float, cid: str, ticks: int = 1) -> float:
    """F-CTY-01: H_{t+n} = H_t · (1 − δ_0 · (1 − d · Polizei))^n."""
    c, _ = loc(cid)
    delta = HEAT["decay_base"] * (1 - HEAT["police_decay_damping"] * c["police"])
    return H * (1 - delta) ** ticks


def police_pressure(police: float, H: float) -> float:
    """F-CTY-02: Fahndungsdruck Π = Polizei · (1 + H/100)."""
    return police * (1 + H / 100)


def availability(S: float, S_ref: float) -> str:
    """F-CTY-03: Verfügbarkeitsstufe aus v = S / S_ref."""
    v = S / S_ref
    if v < 0.5:
        return "knapp"
    if v < 0.8:
        return "gering"
    if v <= 1.25:
        return "normal"
    if v <= 2.0:
        return "gut"
    return "reichlich"


# =============================================================================
# Reisen (travel.md)
# =============================================================================
def distance(a: str, b: str) -> float:
    key = "-".join(sorted((a, b)))
    if key in P["distances"]:
        return P["distances"][key]
    return P["space_distances"][key]


def travel_ticks(d: float, speed: float) -> int:
    """F-TRV-01: T = ⌈d / v · Ticks_pro_Stunde⌉."""
    return math.ceil(d / speed * TICKS_PER_HOUR - EPS)


def fuel_cost(d: float, vehicle: str, start: str) -> int:
    """F-TRV-02: Kosten = ⌈d · Verbrauch / 100 · Treibstoffpreis_Start⌉."""
    v = P["vehicles"][vehicle]
    return ceil_ct(d * v["consumption"] / 100 * P["city"][start]["fuel_price"])


def train_cost(d: float) -> int:
    """F-TRV-03: Bahnticket = ⌈d · Preis_pro_km⌉, Kapazität nur Rucksack."""
    return ceil_ct(d * TRV["train_price_per_km"])


def cargo_heat(cargo: dict[str, int]) -> tuple[float, float]:
    """F-TRV-05: hv = Σ q · P_base · h / 100 000;  g = 1 + hv / (hv + hv_½)."""
    hv = sum(q * GOODS[g]["base_price"] * GOODS[g]["heat"] for g, q in cargo.items()) / 100_000
    return hv, 1 + hv / (hv + TRV["cargo_heat_half"])


def control_probability(a: str, b: str, cargo: dict[str, int], H: float, hide: float,
                        L_schmuggel: int) -> dict:
    """F-TRV-04: p_seg = min(p_max, c_0 · Π_avg · g · (1 − hide) · (1 − Bonus)); p = 1 − (1 − p_seg)^n."""
    d = distance(a, b)
    n = math.ceil(d / TRV["segment_km"] - EPS)
    police_avg = (P["city"][a]["police"] + P["city"][b]["police"]) / 2
    hv, g = cargo_heat(cargo)
    p_seg = min(TRV["control_segment_max"],
                TRV["control_base"] * police_pressure(police_avg, H) * g * (1 - hide)
                * (1 - bonus("schmuggel_control_reduction", L_schmuggel)))
    return {"n": n, "police_avg": police_avg, "hv": hv, "g": g, "p_seg": p_seg,
            "p_total": 1 - (1 - p_seg) ** n}


def bust(cargo: dict[str, int], police: float, L_schmuggel: int) -> dict:
    """F-TRV-06: Strafe, Bestechungskosten und Bestechungschance bei einer Kontrolle."""
    V = sum(q * GOODS[g]["base_price"] for g, q in cargo.items())
    return {
        "cargo_base_value": V,
        "fine": ceil_ct(TRV["fine_rate"] * V),
        "bribe_cost": ceil_ct(TRV["bribe_cost_rate"] * V * (1 + police)),
        "bribe_chance": clamp(TRV["bribe_base_success"] - TRV["bribe_police_penalty"] * police
                              + PRF["schmuggel_bribe_bonus"] * L_schmuggel,
                              TRV["bribe_success_min"], TRV["bribe_success_max"]),
    }


# =============================================================================
# Betätigungsfelder (professions.md)
# =============================================================================
def level(xp: int) -> int:
    """F-PRF-01: L = min(L_max, ⌊√(XP / k)⌋);  XP(L) = k · L²."""
    return min(PRF["level_max"], math.isqrt(int(xp) // PRF["xp_per_level_k"]))


def xp_for_level(L: int) -> int:
    return PRF["xp_per_level_k"] * L * L


def xp_gain(field: str, **kw) -> int:
    """F-PRF-02: XP-Zuwachs je Aktion, immer abgerundet."""
    if field == "handel":
        return math.floor(kw["volume_ct"] / 100 * PRF["handel_xp_per_eur"] + EPS)
    if field == "schmuggel":
        return math.floor(kw["km"] * PRF["schmuggel_xp_per_km"] + kw["hv"] * PRF["schmuggel_xp_per_cargo_heat"] + EPS)
    if field == "gewalt":
        return PRF["gewalt_xp_win"] if kw["won"] else PRF["gewalt_xp_loss"]
    if field == "produktion":
        return math.floor(kw["units"] * PRF["produktion_xp_per_unit"] + EPS)
    if field == "finanzen":
        return math.floor(kw["washed_ct"] / 100 * PRF["finanzen_xp_per_eur"] + EPS)
    raise KeyError(field)


# =============================================================================
# Kampf (combat.md)
# =============================================================================
def morale(hp: float) -> float:
    return CMB["morale_min"] + CMB["morale_span"] * hp / P["player"]["hp_max"]


def presence_bonus(n_present: int) -> float:
    """F-CLN-05: Präsenzbonus = min(max, b · (n − 1)) für n anwesende Clanmitglieder (inkl. selbst)."""
    return min(CLN["presence_bonus_max"], CLN["presence_bonus_per_member"] * max(0, n_present - 1))


def crew_strength(crew: dict[str, int]) -> float:
    return sum(P["crew"][c]["strength"] * n for c, n in crew.items())


def attack_strength(weapon: str | None, armor: str | None, crew: dict[str, int], L_gewalt: int,
                    hp: float, clan_present: int = 1) -> float:
    """F-CMB-01: K_A = (B + W + w_R·R + Crew) · (1 + Bonus_Gewalt) · Moral · (1 + Präsenz)."""
    w = P["weapons"][weapon]["strength"] if weapon else 0
    r = P["armor"][armor]["strength"] if armor else 0
    raw = CMB["base_strength"] + w + CMB["armor_attack_weight"] * r + crew_strength(crew)
    return raw * (1 + bonus("gewalt_strength_bonus", L_gewalt)) * morale(hp) * (1 + presence_bonus(clan_present))


def defense_strength(weapon: str | None, armor: str | None, crew: dict[str, int], L_gewalt: int,
                     hp: float, clan_present: int = 1, home: bool = False) -> float:
    """F-CMB-02: K_D = (B + w_W·W + R + Crew) · (1 + Bonus_Gewalt) · Moral · (1 + Präsenz) · Heimbonus."""
    w = P["weapons"][weapon]["strength"] if weapon else 0
    r = P["armor"][armor]["strength"] if armor else 0
    raw = CMB["base_strength"] + CMB["weapon_defense_weight"] * w + r + crew_strength(crew)
    return (raw * (1 + bonus("gewalt_strength_bonus", L_gewalt)) * morale(hp) * (1 + presence_bonus(clan_present))
            * (CMB["home_defense_bonus"] if home else 1.0))


def win_chance(KA: float, KD: float) -> float:
    """F-CMB-03: p = clamp(K_A^α / (K_A^α + K_D^α), p_min, p_max)."""
    a = CMB["alpha"]
    return clamp(KA ** a / (KA ** a + KD ** a), CMB["win_chance_min"], CMB["win_chance_max"])


def losses(K_w: float, K_l: float, crew_w: dict[str, int], crew_l: dict[str, int]) -> dict:
    """F-CMB-04: Verlustquoten f_w = min(max_w, c_w·K_l/(K_w+K_l)), f_l = min(max_l, c_l·K_w/(K_w+K_l))."""
    f_w = min(CMB["loss_max_winner"], CMB["loss_coeff_winner"] * K_l / (K_w + K_l))
    f_l = min(CMB["loss_max_loser"], CMB["loss_coeff_loser"] * K_w / (K_w + K_l))
    return {
        "f_winner": f_w, "f_loser": f_l,
        "lost_winner": {c: round_half_up(n * f_w) for c, n in crew_w.items()},
        "lost_loser": {c: round_half_up(n * f_l) for c, n in crew_l.items()},
    }


def loot(cash_black: int, goods: dict[str, int], looted_window: int = 0, repeat_k: int = 0) -> dict:
    """F-CMB-05: Beute mit Tageslimit, Wiederholungsabschlag und Hehlerabschlag.

    L = min(⌊B · r_c · d^k⌋, max(0, ⌊cap · (B + L_24h)⌋ − L_24h)); Angreifer erhält ⌊L · (1 − f)⌋.
    Ware: Verlust ⌊q · r_g · d^k⌋, Angreifer erhält ⌊Verlust · (1 − f)⌋. Bank/Weißgeld geschützt.
    """
    decay = CMB["loot_repeat_decay"] ** repeat_k
    budget = max(0, floor_ct(CMB["loot_daily_cap_rate"] * (cash_black + looted_window)) - looted_window)
    lost = min(floor_ct(cash_black * CMB["loot_cash_rate"] * decay), budget)
    goods_lost = {g: math.floor(q * CMB["loot_goods_rate"] * decay + EPS) for g, q in goods.items()}
    keep = 1 - CMB["loot_fence_rate"]
    return {"cash_lost": lost, "cash_gained": floor_ct(lost * keep),
            "goods_lost": goods_lost, "goods_gained": {g: math.floor(q * keep + EPS) for g, q in goods_lost.items()}}


def attack_allowed(att_nw_history: list[int], def_nw: int, def_age_ticks: int,
                   ticks_since_last_attack_on_target: int, ticks_since_own_last_attack: int) -> tuple[bool, str]:
    """F-CMB-06: Zulässigkeit eines Angriffs (Anfängerschutz, Vermögensband, Cooldowns).

    att_nw_history: Nettovermögen des Angreifers der letzten networth_history_ticks (z. B. 7 Tageshöchstwerte);
    für das Vermögensband zählt deren Maximum.
    """
    att_nw = max(att_nw_history)
    if def_age_ticks < CMB["newbie_protection_ticks"] and def_nw < CMB["newbie_protection_networth"]:
        return False, "Anfängerschutz"
    if def_nw < CMB["networth_band"] * att_nw:
        return False, "Vermögensband"
    if ticks_since_last_attack_on_target < CMB["target_cooldown_ticks"]:
        return False, "Ziel-Cooldown"
    if ticks_since_own_last_attack < CMB["attack_cooldown_ticks"]:
        return False, "Angriffs-Cooldown"
    return True, "erlaubt"


def hp_after_fight(hp: float, won: bool) -> tuple[float, int]:
    """F-CMB-07: HP-Verlust; bei HP ≤ 0 Krankenhaus für T_KH Ticks, danach Regeneration r_HP pro Tick."""
    hp_new = hp - (CMB["hp_loss_winner"] if won else CMB["hp_loss_loser"])
    if hp_new <= 0:
        return 0.0, CMB["hospital_ticks"]
    return hp_new, 0


# =============================================================================
# Clans (clans.md)
# =============================================================================
def member_limit(level_: int) -> int:
    """F-CLN-01: Mitgliederlimit = base + per_level · Stufe."""
    return CLN["member_base"] + CLN["member_per_level"] * level_


def clan_upgrade_cost(n: int) -> int:
    """F-CLN-02: Kosten Stufe n (n ≥ 2) = base · growth^(n − 2); Stufe 1 = Gründung."""
    if n == 1:
        return CLN["founding_cost"]
    return round_half_up(CLN["upgrade_base_cost"] * CLN["upgrade_growth"] ** (n - 2))


def clan_tax(amount_ct: int, rate: float) -> int:
    """F-CLN-03: Abgabe = ⌊Betrag · min(τ, τ_max)⌋."""
    return floor_ct(amount_ct * min(rate, CLN["tax_max"]))


def district_income(cid: str) -> int:
    """F-CLN-04: Schutzgeld pro Viertel und Tick = ⌊e_0 · W · √pop⌋."""
    c = P["city"][cid]
    return floor_ct(CLN["district_income_base"] * c["wealth"] * math.sqrt(c["pop"]))


def war_points(K_w: float, K_l: float) -> int:
    """F-CLN-06: Kriegspunkte = round(base + upset · 2 · K_l / (K_w + K_l))."""
    return round_half_up(CLN["war_points_base"] + CLN["war_points_upset"] * 2 * K_l / (K_w + K_l))


def war_reparation(treasury_loser: int) -> int:
    """F-CLN-06 (b): Reparation = ⌊Kasse_Verlierer · r_rep⌋."""
    return floor_ct(treasury_loser * CLN["war_reparation_rate"])


def rank_limits(members: int, treasury: int) -> dict:
    """F-CLN-07: Capo-Anzahl = ⌈m / 8⌉; Tageslimit Capo-Auszahlung = ⌊Kasse · 5 %⌋."""
    return {"consigliere": CLN["consigliere_max"],
            "capos": math.ceil(members / CLN["capo_per_members"]),
            "capo_daily_payout": floor_ct(treasury * CLN["capo_daily_payout_limit"])}


RANK_ORDER = {rank: i for i, rank in enumerate(CLN["ranks"])}   # 0 = höchster Rang


def rank_at_least(rank: str, min_rank: str) -> bool:
    return RANK_ORDER[rank] <= RANK_ORDER[min_rank]


def election_candidates(members: list[dict]) -> list[dict]:
    """F-CLN-08 (a): Wählbar ab CAPO mit Mindest-Mitgliedschaft; Fallback ab SOLDAT, dann alle.

    Mitglieder mit excluded=True (abgesetzter Pate) sind nur wählbar, wenn sonst niemand übrig ist.
    """
    pool = [m for m in members if not m.get("excluded")] or members
    for cond in (lambda m: rank_at_least(m["rank"], CLN["election_candidate_min_rank"])
                 and m["tenure"] >= CLN["election_candidate_min_tenure_ticks"],
                 lambda m: rank_at_least(m["rank"], CLN["election_voter_min_rank"]),
                 lambda m: True):
        cands = [m for m in pool if cond(m)]
        if cands:
            return cands
    return pool


def election_result(members: list[dict], votes: dict[str, str]) -> str:
    """F-CLN-08: Ein Mitglied → sofort Pate; sonst einfache Mehrheit gültiger Stimmen,
    Gleichstand/keine Stimmen → höherer Rang, längere Mitgliedschaft, kleinere Spieler-ID."""
    if len(members) == 1:
        return members[0]["id"]
    cands = election_candidates(members)
    cand_ids = {m["id"] for m in cands}
    voters = {m["id"] for m in members if rank_at_least(m["rank"], CLN["election_voter_min_rank"])}
    tally = {c: 0 for c in cand_ids}
    for voter, cand in votes.items():
        if voter in voters and cand in cand_ids:
            tally[cand] += 1
    return min(cands, key=lambda m: (-tally[m["id"]], RANK_ORDER[m["rank"]], -m["tenure"], m["id"]))["id"]


def no_confidence(members: list[dict], pate_id: str, yes: set[str]) -> dict:
    """F-CLN-09: Misstrauensvotum angenommen, wenn Ja-Stimmen ≥ ⌈num/den · n⌉,
    n = Wahlberechtigte ohne den Paten."""
    eligible = {m["id"] for m in members
                if m["id"] != pate_id and rank_at_least(m["rank"], CLN["election_voter_min_rank"])}
    num, den = CLN["no_confidence_quorum_num"], CLN["no_confidence_quorum_den"]
    needed = (num * len(eligible) + den - 1) // den
    got = len(yes & eligible)
    return {"eligible": len(eligible), "needed": needed, "yes": got, "passed": len(eligible) > 0 and got >= needed}


# =============================================================================
# Geldwäsche (money-laundering.md)
# =============================================================================
def wash_fee(btype: str, L_fin: int) -> float:
    """F-ML-01: f = max(f_min, f_typ · (1 − Bonus_Finanzen)); Gutschrift = ⌊x · (1 − f)⌋."""
    return max(LAU["fee_min"], P["businesses"][btype]["wash_fee"] * (1 - bonus("finanzen_fee_reduction", L_fin)))


def wash_credit(x: int, fee: float) -> int:
    return floor_ct(x * (1 - fee))


def wash_capacity(R_legal: int) -> int:
    """F-ML-02: x_max pro Tick = ⌊ratio_max · R_legal⌋."""
    return floor_ct(LAU["max_ratio"] * R_legal)


def detection_risk(x: int, R_legal: int, H: float, L_fin: int) -> float:
    """F-ML-03: p = min(p_max, p_0 · (x/R)^γ · (1 + H/100) · (1 − Bonus_Risiko))."""
    return min(LAU["risk_max_per_tick"],
               LAU["risk_base"] * (x / R_legal) ** LAU["risk_exponent"] * (1 + H / 100)
               * (1 - bonus("finanzen_risk_reduction", L_fin)))


def risk_over(p: float, ticks: int = TICKS_PER_DAY) -> float:
    """F-ML-04: p_n = 1 − (1 − p)^n (auch für Razzien, Kontrollen etc. verwendet)."""
    return 1 - (1 - p) ** ticks


def strawman(x: int, used_today: int = 0) -> dict:
    """F-ML-05: Strohmann: x' = min(x, cap − used); Gutschrift = ⌊x' · (1 − f_S)⌋, risikofrei."""
    x_eff = max(0, min(x, LAU["strawman_daily_cap"] - used_today))
    return {"accepted": x_eff, "credit": floor_ct(x_eff * (1 - LAU["strawman_fee"]))}


def detection_penalty(washed_lookback: int) -> dict:
    """F-ML-06: Beschlagnahme der Gutschriften der letzten 144 Ticks + Strafe ⌈r · Summe⌉."""
    return {"confiscated": washed_lookback,
            "fine": ceil_ct(LAU["penalty_fine_rate"] * washed_lookback),
            "closure_ticks": LAU["closure_ticks"], "heat": LAU["heat_on_detection"]}


# =============================================================================
# Immobilien (real-estate.md)
# =============================================================================
def business_income(btype: str, cid: str, A: int) -> int:
    """F-RE-01: R = ⌊R_0 · W^ω_RE · (1 + u_R · A)⌋."""
    b = P["businesses"][btype]
    return floor_ct(b["income"] * P["city"][cid]["wealth"] ** RE["wealth_exponent"] * (1 + RE["upgrade_income_bonus"] * A))


def business_upkeep(btype: str, A: int) -> int:
    """F-RE-02: U = ⌈U_0 · (1 + u_U · A)⌉."""
    return ceil_ct(P["businesses"][btype]["upkeep"] * (1 + RE["upgrade_upkeep_bonus"] * A))


def business_upgrade_cost(btype: str, n: int) -> int:
    """F-RE-03: Ausbau auf Stufe n kostet k_A · n · Kaufpreis; kumuliert k_A · Preis · A(A+1)/2."""
    return round_half_up(RE["upgrade_cost_factor"] * n * P["businesses"][btype]["price"])


def total_investment(btype: str, A: int) -> int:
    return P["businesses"][btype]["price"] + sum(business_upgrade_cost(btype, n) for n in range(1, A + 1))


def payback_days(btype: str, cid: str, A: int) -> float:
    """F-RE-04: Amortisation T = Investition / ((R − U) · 144) in Tagen."""
    net = business_income(btype, cid, A) - business_upkeep(btype, A)
    return total_investment(btype, A) / (net * TICKS_PER_DAY)


def raid_risk(btype: str, cid: str, H: float) -> float:
    """F-RE-05: p_Razzia = r_typ · Π(Polizei, H) pro Tick."""
    return P["businesses"][btype]["raid_risk"] * police_pressure(P["city"][cid]["police"], H)


def production(btype: str, good: str, L_prod: int, A: int, ticks: int) -> dict:
    """F-RE-06: Q = ⌊o · n · (1 + Bonus_Prod) · (1 + u_R · A)⌋; Material = ⌈Q · m · P_base⌉."""
    b = P["businesses"][btype]
    assert good in b["produces"]
    ticks = min(ticks, RE["production_max_ticks"])
    q = math.floor(b["output_per_tick"] * ticks * (1 + bonus("produktion_yield_bonus", L_prod))
                   * (1 + RE["upgrade_income_bonus"] * A) + EPS)
    return {"units": q, "material_cost": ceil_ct(q * b["material_cost_ratio"] * GOODS[good]["base_price"])}


# =============================================================================
# Weltraum (space.md)
# =============================================================================
def space_unlocked(networth: int, L_schmuggel: int, at_city: str) -> bool:
    """F-SPC-01: Nettovermögen ≥ NW_min ∧ L_Schmuggel ≥ L_min ∧ Spieler in Raumhafen-Stadt."""
    u = P["unlocks"]["weltraum"]
    return networth >= u["networth"] and L_schmuggel >= u["level"] and P["city"][at_city]["spaceport"]


def space_travel_ticks(a: str, b: str, ship: str) -> int:
    """F-SPC-02: Start/Landung Erde↔Orbit = T_launch; sonst ⌈d / v · 6⌉, nur wenn d ≤ Reichweite."""
    if a in P["city"] or b in P["city"]:
        return SPC["launch_ticks"]
    d = distance(a, b)
    s = P["ships"][ship]
    if d > s["range"]:
        raise ValueError("außer Reichweite")
    return travel_ticks(d, s["speed"])


def space_fuel_cost(a: str, b: str, ship: str) -> int:
    """F-SPC-03: Treibstoff = ⌈d/100 · Verbrauch · Preis_Start⌉; Erde↔Orbit: Startgebühr."""
    if a in P["city"] or b in P["city"]:
        return SPC["launch_fee"]
    s = P["ships"][ship]
    return ceil_ct(distance(a, b) / 100 * s["consumption"] * P["space_location"][a]["fuel_price"])


def piracy(a: str, b: str, ship: str, cargo: dict[str, int], crew: dict[str, int], L_gewalt: int) -> dict:
    """F-SPC-04: Piratenbegegnung und Verlustwahrscheinlichkeit einer Weltraumreise."""
    T = space_travel_ticks(a, b, ship)
    n = math.ceil(T / SPC["piracy_segment_ticks"] - EPS)
    danger = (P["space_location"][a]["danger"] + P["space_location"][b]["danger"]) / 2
    _, g = cargo_heat(cargo)
    p_seg = min(0.5, SPC["piracy_base"] * danger * g)
    p_enc = 1 - (1 - p_seg) ** n
    K_ship = (P["ships"][ship]["strength"] + crew_strength(crew)) * (1 + bonus("gewalt_strength_bonus", L_gewalt))
    K_pir = SPC["pirate_strength"] * danger
    p_win = win_chance(K_ship, K_pir)
    return {"T": T, "n": n, "danger": danger, "g": g, "p_seg": p_seg, "p_encounter": p_enc,
            "K_ship": K_ship, "K_pirates": K_pir, "p_win": p_win, "p_loss": p_enc * (1 - p_win)}


# =============================================================================
# NPCs (npc.md)
# =============================================================================
EARTH = list(P["city"])


def npc_route_flow(a: str, b: str, g: str, Sa: float, Sb: float, k: float) -> dict:
    """F-NPC-01: NPC-Handelsfluss a → b pro Tick.

    m = P_b(1 − s/2) / (P_a(1 + s/2)) − 1;  θ = θ_0 + θ_km · d;  f = clamp((m − θ)/θ_scale, 0, 1);
    q = k · η · min(A_a, D_b) · f.
    """
    s = spread(0)
    m = market_price(b, g, Sb) * (1 - s / 2) / (market_price(a, g, Sa) * (1 + s / 2)) - 1
    theta = NPC["trader_threshold_base"] + NPC["trader_threshold_per_km"] * distance(a, b)
    f = clamp((m - theta) / NPC["trader_threshold_scale"], 0.0, 1.0)
    q = k * NPC["trader_intensity"] * min(supply_level(a, g), demand(b, g)) * f
    return {"margin": m, "theta": theta, "f": f, "q": q}


def npc_trader_step(g: str, S: dict[str, float], k: float) -> dict[str, float]:
    """F-NPC-01 (Tick): alle Flüsse aus dem aktuellen Zustand berechnen, dann anwenden, dann F-ECO-04."""
    delta = {c: 0.0 for c in S}
    for a in S:
        for b in S:
            if a != b:
                q = npc_route_flow(a, b, g, S[a], S[b], k)["q"]
                delta[a] -= q
                delta[b] += q
    return {c: stock_step(max(ECO["min_stock"], S[c] + delta[c]), target_stock(c, g)) for c in S}


def npc_equilibrium(g: str, k: float, ticks: int = 3_000) -> dict[str, float]:
    S = {c: target_stock(c, g) for c in EARTH}
    for _ in range(ticks):
        S = npc_trader_step(g, S, k)
    return S


def courier(tier: int) -> dict:
    """F-NPC-02: Kurier der Stufe t: Stärke K_0 · g_K^(t−1), Bargeld C_0 · g_C^(t−1)."""
    return {"strength": NPC["courier_strength_base"] * NPC["courier_strength_growth"] ** (tier - 1),
            "cash": round_half_up(NPC["courier_cash_base"] * NPC["courier_cash_growth"] ** (tier - 1))}


def courier_raid(KA: float, tier: int) -> dict:
    """F-NPC-02 (Kampf): Siegchance nach F-CMB-03, Beute ⌊Bargeld · (1 − Hehlerabschlag)⌋."""
    c = courier(tier)
    return {"p_win": win_chance(KA, c["strength"]), "gain": floor_ct(c["cash"] * (1 - CMB["loot_fence_rate"]))}


def gang_risk(k: float, cash_black: int, protected: bool) -> float:
    """F-NPC-03: Überfallwahrscheinlichkeit pro Tick durch eine NPC-Bande."""
    if protected or cash_black < NPC["gang_min_cash"]:
        return 0.0
    return k * NPC["gang_attack_base"]


def handover_update(k: float, met_streak: int, miss_streak: int) -> float:
    """F-NPC-04: k sinkt bei met_streak = 14, 21, 28 …; steigt bei miss_streak = 7, 14, …"""
    step, sd = NPC["handover_step"], NPC["handover_step_days"]
    if met_streak >= NPC["handover_hold_days"] and (met_streak - NPC["handover_hold_days"]) % sd == 0:
        k -= step
    if miss_streak >= NPC["handover_miss_days"] and (miss_streak - NPC["handover_miss_days"]) % sd == 0:
        k += step
    return round(clamp(k, NPC["k_min"], NPC["k_max"]), 10)


def handover_run(days_met: list[bool], k: float = NPC["k_start"]) -> list[float]:
    met = miss = 0
    out = []
    for ok in days_met:
        met, miss = (met + 1, 0) if ok else (0, miss + 1)
        k = handover_update(k, met, miss)
        out.append(k)
    return out


# =============================================================================
# Beispielrechnungen (EX-*) – Werte müssen mit den Markdown-Dokumenten übereinstimmen
# =============================================================================
def r(x: float, nd: int = 4) -> float:
    return round(x, nd)


def ex_glb_01():
    return {"U": r(rng_uniform("demo-server", 1, "berlin/gras"), 6),
            "Z": r(rng_normal("demo-server", 1, "berlin/gras"), 6)}


def ex_glb_02():
    return {"NW": networth(500_000, 2_000_000, 3_300_000, {"kokain": 40}, 30_000_000, 12)}


def ex_eco_01():
    a, m = equilibrium_price("amsterdam", "gras"), equilibrium_price("muenchen", "gras")
    return {"P_amsterdam": r(a, 2), "P_muenchen": r(m, 2), "ratio": r(m / a)}


def ex_eco_02():
    c, g = "rotterdam", "kokain"
    St = target_stock(c, g)
    return {"D": r(demand(c, g)), "A": r(supply_level(c, g)), "S_ref": r(ref_stock(c, g), 2),
            "S_target": r(St, 2), "P": r(market_price(c, g, St), 2)}


def ex_eco_03():
    c, g = "rotterdam", "kokain"
    St = target_stock(c, g)
    S0 = St - 200
    S34, S144 = stock_after(S0, St, 34), stock_after(S0, St, 144)
    return {"S0": r(S0, 2), "P0": r(market_price(c, g, S0), 2), "S34": r(S34, 2), "P34": r(market_price(c, g, S34), 2),
            "S144": r(S144, 2), "P144": r(market_price(c, g, S144), 2)}


def ex_eco_04():
    t = half_life(ECO["reversion_rate"])
    return {"ticks": r(t, 2), "hours": r(t / TICKS_PER_HOUR, 2)}


def ex_eco_05():
    c, g = "berlin", "gras"
    St = target_stock(c, g)
    S1 = apply_event_shock(St, "razzia")
    p0, p1 = market_price(c, g, St), market_price(c, g, S1)
    return {"S_target": r(St, 2), "S_after": r(S1, 2), "P_before": r(p0, 2), "P_after": r(p1, 2), "factor": r(p1 / p0)}


def ex_eco_06():
    x1 = noise_step(0.02, GOODS["gras"]["volatility"], -1.0)
    return {"x1": r(x1, 6), "N": r(math.exp(x1), 6)}


def ex_trd_01():
    c, g = "rotterdam", "kokain"
    cost, S1 = buy_cost(c, g, target_stock(c, g), 200)
    return {"cost": cost, "avg": r(cost / 200, 2), "S_after": r(S1, 2)}


def ex_trd_02():
    c, g = "muenchen", "kokain"
    rev, S1 = sell_revenue(c, g, target_stock(c, g), 200)
    return {"revenue": rev, "avg": r(rev / 200, 2), "S_after": r(S1, 2)}


def ex_trd_03():
    c, g = "rotterdam", "kokain"
    cost, S1 = buy_cost(c, g, target_stock(c, g), 200)
    rev, _ = sell_revenue(c, g, S1, 200)
    return {"cost": cost, "revenue": rev, "loss": cost - rev}


def ex_trd_04():
    return {"Q_day": spoiled_quantity(100, "pilze", 144), "Q_week": spoiled_quantity(100, "pilze", 1008)}


def ex_trd_05():
    cost = ex_trd_01()["cost"]
    return {"H": r(trade_heat(0.0, cost, "kokain"))}


def ex_trd_06():
    cap = carry_capacity("kleinwagen")
    return {"capacity": cap, "max_gras": cap // GOODS["gras"]["volume"], "max_kokain": cap // GOODS["kokain"]["volume"]}


def ex_cty_01():
    c, g = "berlin", "ecstasy"
    return {"D": r(demand(c, g)), "S_ref": r(ref_stock(c, g), 2), "S_target": r(target_stock(c, g), 2),
            "P_eq": r(equilibrium_price(c, g), 2)}


def ex_cty_02():
    return {"H_muenchen": r(heat_decay(50, "muenchen", 144), 2), "H_amsterdam": r(heat_decay(50, "amsterdam", 144), 2)}


def ex_cty_03():
    c, g = "rotterdam", "kokain"
    S = target_stock(c, g) - 200
    return {"v": r(S / ref_stock(c, g)), "label": availability(S, ref_stock(c, g))}


def ex_trv_01():
    d = distance("berlin", "hamburg")
    return {"T_car": travel_ticks(d, P["vehicles"]["kleinwagen"]["speed"]),
            "fuel": fuel_cost(d, "kleinwagen", "berlin"),
            "T_train": travel_ticks(d, TRV["train_speed"]), "train": train_cost(d)}


def ex_trv_02():
    c = control_probability("rotterdam", "muenchen", {"kokain": 200}, 10.0,
                            P["vehicles"]["transporter"]["hide"], 4)
    return {k: (r(v, 6) if isinstance(v, float) else v) for k, v in c.items()}


def ex_trv_03():
    police_avg = (P["city"]["rotterdam"]["police"] + P["city"]["muenchen"]["police"]) / 2
    b = bust({"kokain": 200}, police_avg, 4)
    b["bribe_chance"] = r(b["bribe_chance"])
    return b


def ex_trv_04():
    cost = ex_trd_01()["cost"]
    rev = ex_trd_02()["revenue"]
    d = distance("rotterdam", "muenchen")
    fuel = fuel_cost(d, "transporter", "rotterdam")
    p = ex_trv_02()["p_total"]
    fine = ex_trv_03()["fine"]
    ev = (1 - p) * rev - cost - fuel - p * fine
    return {"fuel": fuel, "T": travel_ticks(d, P["vehicles"]["transporter"]["speed"]),
            "profit_no_bust": rev - cost - fuel, "EV": round_half_up(ev)}


def ex_prf_01():
    return {"L_2500": level(2500), "L_9999": level(9999), "XP_L10": xp_for_level(10), "XP_L20": xp_for_level(20)}


def ex_prf_02():
    return {"handel": xp_gain("handel", volume_ct=ex_trd_01()["cost"]),
            "schmuggel": xp_gain("schmuggel", km=distance("rotterdam", "muenchen"), hv=ex_trv_02()["hv"]),
            "finanzen": xp_gain("finanzen", washed_ct=864_000)}


def ex_prf_03():
    return {"spread_L10": r(spread(10)), "spread_L20": r(spread(20)),
            "control_red_L10": r(bonus("schmuggel_control_reduction", 10)),
            "strength_L10": r(bonus("gewalt_strength_bonus", 10)),
            "fee_red_L10": r(bonus("finanzen_fee_reduction", 10))}


def _fight():
    KA = attack_strength("pistole", "weste", {"schlaeger": 3}, 6, 100)
    KD = defense_strength("messer", "lederjacke", {"schlaeger": 2}, 3, 80, home=True)
    return KA, KD


def ex_cmb_01():
    KA, KD = _fight()
    ls = losses(KA, KD, {"schlaeger": 3}, {"schlaeger": 2})
    lt = loot(500_000, {"kokain": 40})
    return {"K_A": r(KA, 3), "K_D": r(KD, 3), "p_win": r(win_chance(KA, KD)),
            "f_winner": r(ls["f_winner"]), "f_loser": r(ls["f_loser"]),
            "lost_att": ls["lost_winner"]["schlaeger"], "lost_def": ls["lost_loser"]["schlaeger"],
            "cash_lost": lt["cash_lost"], "cash_gained": lt["cash_gained"],
            "kokain_lost": lt["goods_lost"]["kokain"], "kokain_gained": lt["goods_gained"]["kokain"],
            "hp_def": hp_after_fight(80, False)[0]}


def ex_cmb_02():
    return {"a": attack_allowed([10_000_000], 4_000_000, 5_000, 999, 999)[1],
            "b": attack_allowed([10_000_000], 6_000_000, 5_000, 999, 999)[1],
            "c": attack_allowed([10_000_000], 6_000_000, 500, 999, 999)[1],
            "d": attack_allowed([10_000_000], 6_000_000, 5_000, 20, 999)[1],
            "e": attack_allowed([10_000_000, 6_000_000, 3_000_000], 4_000_000, 5_000, 999, 999)[1]}


def loot_series(cash: int, attacks: int, interval: int, same_attacker: bool) -> list[int]:
    """Angriffsserie auf ein Opfer ohne Einnahmen; liefert die Bargeldverluste je Angriff."""
    window = CMB["loot_cap_window_ticks"]
    history: list[tuple[int, int]] = []   # (Tick, Verlust)
    losses_ = []
    for i in range(attacks):
        t = i * interval
        in_window = sum(l for (tt, l) in history if tt > t - window)
        k = sum(1 for (tt, _) in history if tt > t - CMB["loot_repeat_window_ticks"]) if same_attacker else 0
        lost = loot(cash, {}, in_window, k)["cash_lost"]
        cash -= lost
        history.append((t, lost))
        losses_.append(lost)
    return losses_


def ex_cmb_03():
    day = loot_series(1_000_000, 4, CMB["target_cooldown_ticks"], False)
    second_day = loot(1_000_000 - sum(day), {}, 0, 1)["cash_lost"]
    return {"loss_1": day[0], "loss_2": day[1], "loss_3": day[2], "loss_4": day[3],
            "day_total": sum(day), "day_share": r(sum(day) / 1_000_000), "repeat_k1": second_day}


def ex_cln_01():
    out = {}
    for n in range(1, CLN["max_level"] + 1):
        out[f"limit_{n}"] = member_limit(n)
        out[f"cost_{n}"] = clan_upgrade_cost(n)
    out["cost_total"] = sum(clan_upgrade_cost(n) for n in range(1, CLN["max_level"] + 1))
    return out


def ex_cln_02():
    b, m = district_income("berlin"), district_income("muenchen")
    return {"berlin_tick": b, "berlin_day": b * TICKS_PER_DAY, "muenchen_tick": m, "muenchen_day": m * TICKS_PER_DAY}


def ex_cln_03():
    return {"equal": war_points(100, 100), "underdog": war_points(100, 200), "bully": war_points(100, 25),
            "reparation": war_reparation(30_000_000)}


def ex_cln_04():
    rl = rank_limits(20, 100_000_000)
    return {"tax": clan_tax(1_000_000, 0.08), "tax_capped": clan_tax(1_000_000, 0.15),
            "capos": rl["capos"], "payout": rl["capo_daily_payout"]}


CLAN_DEMO = [
    {"id": "A", "rank": "CONSIGLIERE", "tenure": 3_000},
    {"id": "B", "rank": "CAPO", "tenure": 2_000},
    {"id": "C", "rank": "CAPO", "tenure": 500},
    {"id": "D", "rank": "SOLDAT", "tenure": 5_000},
    {"id": "E", "rank": "SOLDAT", "tenure": 300},
    {"id": "F", "rank": "MITLAEUFER", "tenure": 50},
]


def ex_cln_05():
    return {"candidates": "".join(m["id"] for m in election_candidates(CLAN_DEMO)),
            "majority": election_result(CLAN_DEMO, {"A": "B", "B": "B", "C": "A", "D": "A", "E": "B", "F": "A"}),
            "tie": election_result(CLAN_DEMO, {"A": "A", "B": "B"}),
            "no_votes": election_result(CLAN_DEMO, {}),
            "single": election_result([{"id": "D", "rank": "SOLDAT", "tenure": 5_000}], {})}


def ex_cln_06():
    big = [{"id": "P", "rank": "PATE", "tenure": 9_000}] + [
        {"id": f"S{i:02d}", "rank": "SOLDAT", "tenure": 2_000} for i in range(14)]
    small = [{"id": "P", "rank": "PATE", "tenure": 9_000}, {"id": "X", "rank": "CAPO", "tenure": 2_000},
             {"id": "Y", "rank": "SOLDAT", "tenure": 2_000}, {"id": "Z", "rank": "SOLDAT", "tenure": 2_000}]
    nine = no_confidence(big, "P", {f"S{i:02d}" for i in range(9)})
    ten = no_confidence(big, "P", {f"S{i:02d}" for i in range(10)})
    sm = no_confidence(small, "P", {"X", "Y"})
    return {"eligible_14": nine["eligible"], "needed_14": nine["needed"], "nine_yes": nine["passed"],
            "ten_yes": ten["passed"], "needed_3": sm["needed"], "small_passed": sm["passed"]}


def ex_ml_01():
    R = business_income("spielhalle", "berlin", 0)
    f = wash_fee("spielhalle", 5)
    p = detection_risk(R, R, 20, 5)
    return {"R": R, "x_max": wash_capacity(R), "fee": r(f), "credit": wash_credit(R, f),
            "p_tick": r(p, 6), "p_day": r(risk_over(p))}


def ex_ml_02():
    R = business_income("spielhalle", "berlin", 0)
    return {"p_day_0_5": r(risk_over(detection_risk(R // 2, R, 20, 5))),
            "p_day_2_0": r(risk_over(detection_risk(2 * R, R, 20, 5)))}


def ex_ml_03():
    a = strawman(1_500_000)
    return {"accepted": a["accepted"], "credit": a["credit"]}


def ex_ml_04():
    d = detection_penalty(786_240)
    return {"confiscated": d["confiscated"], "fine": d["fine"]}


def ex_re_01():
    I, U = business_income("bordell", "muenchen", 2), business_upkeep("bordell", 2)
    return {"R": I, "U": U, "net_day": (I - U) * TICKS_PER_DAY, "invest": total_investment("bordell", 2),
            "payback_days": r(payback_days("bordell", "muenchen", 2), 2)}


def ex_re_02():
    return {b: r(payback_days(b, "berlin", 0), 2)
            for b in ("waschsalon", "bar", "spielhalle", "bordell", "autowerkstatt")}


def ex_re_03():
    p = raid_risk("bordell", "muenchen", 0)
    return {"p_tick": r(p, 6), "p_day": r(risk_over(p))}


def ex_re_04():
    pr = production("plantage", "gras", 4, 1, TICKS_PER_DAY)
    return {"units": pr["units"], "material": pr["material_cost"], "upkeep_day": business_upkeep("plantage", 1) * TICKS_PER_DAY}


def ex_spc_01():
    return {"a": space_unlocked(600_000_000, 12, "frankfurt"), "b": space_unlocked(600_000_000, 12, "berlin"),
            "c": space_unlocked(400_000_000, 12, "frankfurt")}


def ex_spc_02():
    return {"T_launch": space_travel_ticks("frankfurt", "orbit", "frachter"),
            "T_mars": space_travel_ticks("orbit", "mars", "frachter"),
            "fee_launch": space_fuel_cost("frankfurt", "orbit", "frachter"),
            "fuel_mars": space_fuel_cost("orbit", "mars", "frachter")}


def ex_spc_03():
    p = piracy("ceres", "orbit", "frachter", {"sternenstaub": 230}, {"profi": 2}, 10)
    return {k: (r(v, 4) if isinstance(v, float) else v) for k, v in p.items()}


def ex_spc_04():
    return {c: r(equilibrium_price(c, "sternenstaub"), 2) for c in ("ceres", "orbit", "mars", "frankfurt")}


def ex_spc_05():
    q = 230
    St_c, St_f = target_stock("ceres", "sternenstaub"), target_stock("frankfurt", "sternenstaub")
    cost, _ = buy_cost("ceres", "sternenstaub", St_c, q)
    rev, _ = sell_revenue("frankfurt", "sternenstaub", St_f, q)
    fuel = space_fuel_cost("ceres", "orbit", "frachter")
    fee = space_fuel_cost("orbit", "frankfurt", "frachter")
    T = space_travel_ticks("ceres", "orbit", "frachter") + space_travel_ticks("orbit", "frankfurt", "frachter")
    return {"S_ceres": r(St_c, 2), "S_frankfurt": r(St_f, 2), "cost": cost, "revenue": rev, "fuel": fuel,
            "fee": fee, "T": T, "profit": rev - cost - fuel - fee}


def ex_npc_01():
    out = {}
    for k in (0.0, 1.0):
        S = npc_equilibrium("kokain", k)
        pr, pm = market_price("rotterdam", "kokain", S["rotterdam"]), market_price("muenchen", "kokain", S["muenchen"])
        tag = f"k{int(k)}"
        out[f"S_rot_{tag}"] = r(S["rotterdam"], 1)
        out[f"S_mue_{tag}"] = r(S["muenchen"], 1)
        out[f"P_rot_{tag}"] = r(pr, 2)
        out[f"P_mue_{tag}"] = r(pm, 2)
        out[f"ratio_{tag}"] = r(pm / pr)
    f = npc_route_flow("rotterdam", "muenchen", "kokain", target_stock("rotterdam", "kokain"),
                       target_stock("muenchen", "kokain"), 1.0)
    out.update({"m_start": r(f["margin"]), "theta": r(f["theta"]), "f_start": r(f["f"]), "q_start": r(f["q"])})
    return out


def ex_npc_02():
    out = {}
    for t in range(1, NPC["courier_tiers"] + 1):
        c = courier(t)
        out[f"K_{t}"] = r(c["strength"], 2)
        out[f"cash_{t}"] = c["cash"]
    raid = courier_raid(87.084, 2)
    out["p_win_t2"] = r(raid["p_win"])
    out["gain_t2"] = raid["gain"]
    out["per_city_day"] = NPC["couriers_per_city_day"]
    return out


def ex_npc_03():
    p = gang_risk(1.0, 2_000_000, False)
    KD = 49.076
    lt = loot(2_000_000, {})
    return {"p_tick": p, "p_day": r(risk_over(p)), "p_tick_k05": gang_risk(0.5, 2_000_000, False),
            "p_low_cash": gang_risk(1.0, 900_000, False), "K_gang": r(NPC["gang_strength_factor"] * KD, 3),
            "p_gang_wins": r(win_chance(NPC["gang_strength_factor"] * KD, KD)), "cash_lost": lt["cash_lost"]}


def ex_npc_04():
    run = handover_run([True] * 35 + [False] * 14)
    return {"day13": run[12], "day14": run[13], "day21": run[20], "day35": run[34],
            "day42": run[41], "day49": run[48]}


EXAMPLES = {
    "EX-GLB-01": ex_glb_01, "EX-GLB-02": ex_glb_02,
    "EX-ECO-01": ex_eco_01, "EX-ECO-02": ex_eco_02, "EX-ECO-03": ex_eco_03,
    "EX-ECO-04": ex_eco_04, "EX-ECO-05": ex_eco_05, "EX-ECO-06": ex_eco_06,
    "EX-TRD-01": ex_trd_01, "EX-TRD-02": ex_trd_02, "EX-TRD-03": ex_trd_03,
    "EX-TRD-04": ex_trd_04, "EX-TRD-05": ex_trd_05, "EX-TRD-06": ex_trd_06,
    "EX-CTY-01": ex_cty_01, "EX-CTY-02": ex_cty_02, "EX-CTY-03": ex_cty_03,
    "EX-TRV-01": ex_trv_01, "EX-TRV-02": ex_trv_02, "EX-TRV-03": ex_trv_03, "EX-TRV-04": ex_trv_04,
    "EX-PRF-01": ex_prf_01, "EX-PRF-02": ex_prf_02, "EX-PRF-03": ex_prf_03,
    "EX-CMB-01": ex_cmb_01, "EX-CMB-02": ex_cmb_02, "EX-CMB-03": ex_cmb_03,
    "EX-CLN-01": ex_cln_01, "EX-CLN-02": ex_cln_02, "EX-CLN-03": ex_cln_03, "EX-CLN-04": ex_cln_04,
    "EX-CLN-05": ex_cln_05, "EX-CLN-06": ex_cln_06,
    "EX-ML-01": ex_ml_01, "EX-ML-02": ex_ml_02, "EX-ML-03": ex_ml_03, "EX-ML-04": ex_ml_04,
    "EX-RE-01": ex_re_01, "EX-RE-02": ex_re_02, "EX-RE-03": ex_re_03, "EX-RE-04": ex_re_04,
    "EX-SPC-01": ex_spc_01, "EX-SPC-02": ex_spc_02, "EX-SPC-03": ex_spc_03, "EX-SPC-04": ex_spc_04,
    "EX-SPC-05": ex_spc_05,
    "EX-NPC-01": ex_npc_01, "EX-NPC-02": ex_npc_02, "EX-NPC-03": ex_npc_03, "EX-NPC-04": ex_npc_04,
}

# Erwartete Werte – identisch mit den Beispielrechnungen in den .md-Dateien.
EXPECTED: dict[str, dict] = {
    'EX-GLB-01': {'U': 0.525072, 'Z': -1.191398},
    'EX-GLB-02': {'NW': 8620000},
    'EX-ECO-01': {'P_amsterdam': 624.63, 'P_muenchen': 1486.48, 'ratio': 2.3798},
    'EX-ECO-02': {'D': 2.6, 'A': 6.5, 'S_ref': 374.4, 'S_target': 936.0, 'P': 5059.64},
    'EX-ECO-03': {'S0': 736.0, 'P0': 5705.83, 'S34': 835.37, 'P34': 5355.72, 'S144': 925.1, 'P144': 5089.38},
    'EX-ECO-04': {'ticks': 34.31, 'hours': 5.72},
    'EX-ECO-05': {'S_target': 10656.0, 'S_after': 5328.0, 'P_before': 1000.0, 'P_after': 1414.21, 'factor': 1.4142},
    'EX-ECO-06': {'x1': 0.004, 'N': 1.004008},
    'EX-TRD-01': {'cost': 1126303, 'avg': 5631.52, 'S_after': 736.0},
    'EX-TRD-02': {'revenue': 2742772, 'avg': 13713.86, 'S_after': 891.2},
    'EX-TRD-03': {'cost': 1126303, 'revenue': 1019035, 'loss': 107268},
    'EX-TRD-04': {'Q_day': 74, 'Q_week': 13},
    'EX-TRD-05': {'H': 8.4473},
    'EX-TRD-06': {'capacity': 360, 'max_gras': 180, 'max_kokain': 360},
    'EX-CTY-01': {'D': 47.36, 'S_ref': 6819.84, 'S_target': 6393.6, 'P_eq': 1032.8},
    'EX-CTY-02': {'H_muenchen': 21.02, 'H_amsterdam': 14.63},
    'EX-CTY-03': {'v': 1.9658, 'label': 'gut'},
    'EX-TRV-01': {'T_car': 18, 'fuel': 3208, 'T_train': 15, 'train': 4335},
    'EX-TRV-02': {'n': 9, 'police_avg': 0.625, 'hv': 24.0, 'g': 1.324324, 'p_seg': 0.016389, 'p_total': 0.138188},
    'EX-TRV-03': {'cargo_base_value': 1600000, 'fine': 320000, 'bribe_cost': 1300000, 'bribe_chance': 0.3475},
    'EX-TRV-04': {'fuel': 16400, 'T': 58, 'profit_no_bust': 1600069, 'EV': 1176831},
    'EX-PRF-01': {'L_2500': 5, 'L_9999': 9, 'XP_L10': 10000, 'XP_L20': 40000},
    'EX-PRF-02': {'handel': 112, 'schmuggel': 106, 'finanzen': 8},
    'EX-PRF-03': {'spread_L10': 0.07, 'spread_L20': 0.04, 'control_red_L10': 0.25, 'strength_L10': 0.3, 'fee_red_L10': 0.2},
    'EX-CMB-01': {'K_A': 87.084, 'K_D': 49.076, 'p_win': 0.7027, 'f_winner': 0.1442, 'f_loser': 0.5117, 'lost_att': 0, 'lost_def': 1, 'cash_lost': 125000, 'cash_gained': 106250, 'kokain_lost': 10, 'kokain_gained': 8, 'hp_def': 50},
    'EX-CMB-02': {'a': 'Vermögensband', 'b': 'erlaubt', 'c': 'erlaubt', 'd': 'Ziel-Cooldown', 'e': 'Vermögensband'},
    'EX-CMB-03': {'loss_1': 250000, 'loss_2': 100000, 'loss_3': 0, 'loss_4': 0, 'day_total': 350000, 'day_share': 0.35, 'repeat_k1': 81250},
    'EX-CLN-01': {'limit_1': 12, 'cost_1': 5000000, 'limit_2': 16, 'cost_2': 10000000, 'limit_3': 20, 'cost_3': 20000000, 'limit_4': 24, 'cost_4': 40000000, 'limit_5': 28, 'cost_5': 80000000, 'cost_total': 155000000},
    'EX-CLN-02': {'berlin_tick': 1216, 'berlin_day': 175104, 'muenchen_tick': 1239, 'muenchen_day': 178416},
    'EX-CLN-03': {'equal': 20, 'underdog': 23, 'bully': 14, 'reparation': 3000000},
    'EX-CLN-04': {'tax': 80000, 'tax_capped': 100000, 'capos': 3, 'payout': 5000000},
    'EX-CLN-05': {'candidates': 'AB', 'majority': 'B', 'tie': 'A', 'no_votes': 'A', 'single': 'D'},
    'EX-CLN-06': {'eligible_14': 14, 'needed_14': 10, 'nine_yes': False, 'ten_yes': True, 'needed_3': 2, 'small_passed': True},
    'EX-ML-01': {'R': 6000, 'x_max': 18000, 'fee': 0.09, 'credit': 5460, 'p_tick': 0.00108, 'p_day': 0.1441},
    'EX-ML-02': {'p_day_0_5': 0.0381, 'p_day_2_0': 0.4639},
    'EX-ML-03': {'accepted': 1000000, 'credit': 700000},
    'EX-ML-04': {'confiscated': 786240, 'fine': 393120},
    'EX-RE-01': {'R': 17708, 'U': 6600, 'net_day': 1599552, 'invest': 80000000, 'payback_days': 50.01},
    'EX-RE-02': {'waschsalon': 69.44, 'bar': 80.13, 'spielhalle': 74.4, 'bordell': 77.16, 'autowerkstatt': 92.59},
    'EX-RE-03': {'p_tick': 0.0004, 'p_day': 0.056},
    'EX-RE-04': {'units': 760, 'material': 114000, 'upkeep_day': 95040},
    'EX-SPC-01': {'a': True, 'b': False, 'c': False},
    'EX-SPC-02': {'T_launch': 3, 'T_mars': 47, 'fee_launch': 500000, 'fuel_mars': 234000},
    'EX-SPC-03': {'T': 158, 'n': 7, 'danger': 0.55, 'g': 1.8734, 'p_seg': 0.0309, 'p_encounter': 0.1973, 'K_ship': 104.0, 'K_pirates': 66.0, 'p_win': 0.6642, 'p_loss': 0.0663},
    'EX-SPC-04': {'ceres': 26998.3, 'orbit': 97804.31, 'mars': 91471.33, 'frankfurt': 126264.83},
    'EX-SPC-05': {'S_ceres': 518.4, 'S_frankfurt': 332.64, 'cost': 7469143, 'revenue': 23984549, 'fuel': 1315000, 'fee': 500000, 'T': 161, 'profit': 14700406},
    'EX-NPC-01': {'S_rot_k0': 936.0, 'S_mue_k0': 691.2, 'P_rot_k0': 5059.64, 'P_mue_k0': 15413.63, 'ratio_k0': 3.0464, 'S_rot_k1': 663.3, 'S_mue_k1': 1161.9, 'P_rot_k1': 6010.53, 'P_mue_k1': 11888.32, 'ratio_k1': 1.9779, 'm_start': 1.7563, 'theta': 0.314, 'f_start': 1.0, 'q_start': 3.25},
    'EX-NPC-02': {'K_1': 40.0, 'cash_1': 50000, 'K_2': 72.0, 'cash_2': 100000, 'K_3': 129.6, 'cash_3': 200000, 'K_4': 233.28, 'cash_4': 400000, 'K_5': 419.9, 'cash_5': 800000, 'p_win_t2': 0.5708, 'gain_t2': 85000, 'per_city_day': 4},
    'EX-NPC-03': {'p_tick': 0.0007, 'p_day': 0.0959, 'p_tick_k05': 0.00035, 'p_low_cash': 0.0, 'K_gang': 39.261, 'p_gang_wins': 0.4171, 'cash_lost': 500000},
    'EX-NPC-04': {'day13': 1.0, 'day14': 0.9, 'day21': 0.8, 'day35': 0.6, 'day42': 0.7, 'day49': 0.8},
}


# =============================================================================
# Invarianten (INV-*)
# =============================================================================
def lookup(path: str):
    node = P
    for part in path.split("."):
        node = node[part]
    return node


def inv_bounds():
    bad = [k for k, (lo, hi) in P["bounds"].items() if not lo <= lookup(k) <= hi]
    return not bad, f"außerhalb: {bad}" if bad else f"{len(P['bounds'])} Parameter im Wertebereich"


def inv_equilibrium_in_bounds():
    bad = []
    for cid, g in markets():
        lo, hi = price_bounds(g)
        if not lo <= equilibrium_price(cid, g) <= hi:
            bad.append(f"{cid}/{g}")
    return not bad, f"außerhalb: {bad}" if bad else "alle Gleichgewichtspreise in [P_min, P_max]"


def inv_no_instant_arbitrage():
    worst = None
    for cid, g in markets():
        S = target_stock(cid, g)
        for L in (0, PRF["level_max"]):
            q = max(1, max_order(S) // 10)
            cost, S1 = buy_cost(cid, g, S, q, L)
            rev, _ = sell_revenue(cid, g, S1, q, L)
            if rev >= cost:
                return False, f"Arbitrage in {cid}/{g} bei L={L}"
            margin = (cost - rev) / cost
            worst = margin if worst is None else min(worst, margin)
    return True, f"Kauf+Sofortverkauf verliert immer (min. Verlust {worst:.2%})"


def inv_starter_route():
    # Startspieler: 2 000 € Schwarzgeld, Bahn, Rucksack. Speed Leipzig -> Berlin.
    q = P["player"]["backpack_capacity"] // GOODS["speed"]["volume"]
    cost, _ = buy_cost("leipzig", "speed", target_stock("leipzig", "speed"), q)
    rev, _ = sell_revenue("berlin", "speed", target_stock("berlin", "speed"), q)
    ticket = train_cost(distance("leipzig", "berlin"))
    profit = rev - cost - ticket
    ok = cost + ticket <= P["player"]["start_cash_black"] and profit > 0
    return ok, f"Startroute Leipzig→Berlin: Einsatz {cost + ticket} ct, Gewinn {profit} ct"


def inv_reference_routes():
    routes = [("amsterdam", "koeln", "gras", "kleinwagen"), ("rotterdam", "muenchen", "kokain", "transporter"),
              ("amsterdam", "muenchen", "gras", "transporter")]
    msgs = []
    for a, b, g, v in routes:
        q = min(carry_capacity(v) // GOODS[g]["volume"], max_order(target_stock(a, g)) // 2)
        cost, _ = buy_cost(a, g, target_stock(a, g), q)
        rev, _ = sell_revenue(b, g, target_stock(b, g), q)
        fuel = fuel_cost(distance(a, b), v, a)
        if rev - cost - fuel <= 0:
            return False, f"Route {a}->{b} {g} unrentabel"
        msgs.append(f"{a}→{b} {g}: +{(rev - cost - fuel) / 100:.0f} €")
    return True, "; ".join(msgs)


def inv_roi_corridor():
    lo, hi = RE["roi_target_min_days"], RE["roi_target_max_days"]
    out = {}
    for b, d in P["businesses"].items():
        if d["income"] > 0:
            out[b] = payback_days(b, "berlin", 0)
        elif "produces" in d:
            g = d["produces"][0]
            pr = production(b, g, 0, 0, 1)
            net = d["output_per_tick"] * GOODS[g]["base_price"] * (1 - d["material_cost_ratio"]) - d["upkeep"]
            out[b] = d["price"] / (net * TICKS_PER_DAY)
            assert pr["units"] >= 0
    bad = {b: v for b, v in out.items() if not lo <= v <= hi}
    return not bad, (f"außerhalb: {bad}" if bad else
                     "Amortisation " + ", ".join(f"{b} {v:.0f} d" for b, v in out.items()))


def inv_combat_range():
    vals = [win_chance(a, d) for a in (1, 5, 20, 80, 300, 1000) for d in (1, 5, 20, 80, 300, 1000)]
    ok = all(CMB["win_chance_min"] <= v <= CMB["win_chance_max"] for v in vals) and win_chance(50, 50) == 0.5
    return ok, "Siegchancen geklemmt und symmetrisch"


def inv_monte_carlo():
    cid, g = "berlin", "gras"
    seed, ticks = "mc-check", 20_000
    S, x, active, left = target_stock(cid, g), 0.0, None, 0
    lo, hi = price_bounds(g)
    logs = []
    for t in range(ticks):
        ev_s = ev_d = 1.0
        if active is None:
            u = rng_uniform(seed, t, f"{cid}/{g}", 0)
            acc = 0.0
            for name, ev in EVENTS.items():
                acc += ev["probability"]
                if u < acc:
                    active, left = name, ev["duration"]
                    S = apply_event_shock(S, name)
                    break
        if active is not None:
            ev_s, ev_d = EVENTS[active]["supply_mult"], EVENTS[active]["demand_mult"]
            left -= 1
            if left <= 0:
                active = None
        x = noise_step(x, GOODS[g]["volatility"], rng_normal(seed, t, f"{cid}/{g}", 1))
        S = stock_step(S, target_stock(cid, g, ev_s))
        p = market_price(cid, g, S, x, ev_d)
        if not lo <= p <= hi:
            return False, f"Preis {p} außerhalb"
        logs.append(math.log(p))
    gmean = math.exp(sum(logs) / len(logs))
    ratio = gmean / equilibrium_price(cid, g)
    return 0.9 <= ratio <= 1.1, f"geom. Mittel / P* = {ratio:.3f} über {ticks} Ticks"


def inv_space_route():
    # Sternenstaub: Ceres -> Orbit (Frachter) -> Frankfurt, inkl. Treibstoff und Landegebühr.
    q = max_order(target_stock("ceres", "sternenstaub")) // 2
    cost, _ = buy_cost("ceres", "sternenstaub", target_stock("ceres", "sternenstaub"), q)
    rev, _ = sell_revenue("frankfurt", "sternenstaub", target_stock("frankfurt", "sternenstaub"), q)
    travel = space_fuel_cost("ceres", "orbit", "frachter") + space_fuel_cost("orbit", "frankfurt", "frachter")
    profit = rev - cost - travel
    ticks = space_travel_ticks("ceres", "orbit", "frachter") + space_travel_ticks("orbit", "frankfurt", "frachter")
    return profit > 0, f"Ceres→Frankfurt {q} Sternenstaub: +{profit / 100:.0f} € in {ticks} Ticks"


def inv_loot_cap():
    window = CMB["loot_cap_window_ticks"]
    for cash in (10_000, 1_000_000, 123_456_789):
        for same in (False, True):
            interval = CMB["target_cooldown_ticks"]
            losses_ = loot_series(cash, 40, interval, same)
            balance = cash
            balances = []
            for l in losses_:
                balances.append(balance)
                balance -= l
            per_window = window // interval
            for i in range(len(losses_)):
                if sum(losses_[i:i + per_window]) > CMB["loot_daily_cap_rate"] * balances[i] + 1:
                    return False, f"Tagesverlust über Limit (Start {cash}, gleicher Angreifer={same})"
    return True, f"Tagesverlust je Opfer ≤ {CMB['loot_daily_cap_rate']:.0%} des Bargelds"


def inv_election_unique():
    ranks = CLN["ranks"]
    for trial in range(500):
        n = 1 + int(rng_uniform("inv13", trial, "size") * member_limit(CLN["max_level"]))
        members = [{"id": f"M{i:02d}", "rank": ranks[1 + int(rng_uniform("inv13", trial, f"r{i}") * (len(ranks) - 1))],
                    "tenure": int(rng_uniform("inv13", trial, f"t{i}") * 5_000), "excluded": i == 0}
                   for i in range(n)]
        votes = {m["id"]: members[int(rng_uniform("inv13", trial, f"v{i}") * n)]["id"]
                 for i, m in enumerate(members) if rng_uniform("inv13", trial, f"a{i}") < 0.7}
        w = election_result(members, votes)
        ids = [m["id"] for m in members]
        if ids.count(w) != 1:
            return False, f"Versuch {trial}: kein eindeutiger Sieger"
        if n > 1 and w == "M00":
            return False, f"Versuch {trial}: abgesetzter Pate gewählt"
    return True, "500 Zufallswahlen liefern genau einen Paten"


def inv_npc_traders():
    """Mit k = 1: Preise im Rahmen, Referenzrouten rentabel, Top-Marge sinkt spürbar."""
    eq = {g: npc_equilibrium(g, 1.0, 1_500) for g in GOODS if GOODS[g]["realm"] == "earth"}
    for g, S in eq.items():
        lo, hi = price_bounds(g)
        for c, st in S.items():
            if not lo <= market_price(c, g, st) <= hi or st < ECO["min_stock"]:
                return False, f"{c}/{g} außerhalb"
    msgs = []
    for a, b, g, v in [("amsterdam", "koeln", "gras", "kleinwagen"), ("rotterdam", "muenchen", "kokain", "transporter"),
                       ("leipzig", "berlin", "speed", None)]:
        Sa, Sb = eq[g][a], eq[g][b]
        q = min(carry_capacity(v) // GOODS[g]["volume"], max_order(Sa) // 2)
        cost, _ = buy_cost(a, g, Sa, q)
        rev, _ = sell_revenue(b, g, Sb, q)
        travel = fuel_cost(distance(a, b), v, a) if v else train_cost(distance(a, b))
        if rev - cost - travel <= 0:
            return False, f"{a}→{b} {g} mit NPCs unrentabel"
        msgs.append(f"{a}→{b} {g}: +{(rev - cost - travel) / 100:.0f} €")
    r0 = equilibrium_price("muenchen", "kokain") / equilibrium_price("rotterdam", "kokain")
    S = eq["kokain"]
    r1 = market_price("muenchen", "kokain", S["muenchen"]) / market_price("rotterdam", "kokain", S["rotterdam"])
    ok = (r1 - 1) <= 0.8 * (r0 - 1)
    return ok, f"Top-Marge {r0 - 1:.0%} → {r1 - 1:.0%}; " + "; ".join(msgs)


def inv_handover_bounds():
    for trial in range(200):
        days = [rng_uniform("inv15", trial, f"d{i}") < 0.5 + 0.4 * math.sin(i / 9) for i in range(400)]
        ks = handover_run(days)
        if not all(NPC["k_min"] <= k <= NPC["k_max"] for k in ks):
            return False, f"k außerhalb in Versuch {trial}"
    return True, "k bleibt in [k_min, k_max]"


def inv_strawman_expensive():
    fees = [b["wash_fee"] for b in P["businesses"].values() if "wash_fee" in b]
    return LAU["strawman_fee"] > max(fees), "Strohmann teurer als jeder Betrieb"


def inv_unlocks_reachable():
    bad = [k for k, u in P["unlocks"].items() if u.get("level", 0) > PRF["level_max"]
           or u.get("level_sum", 0) > PRF["level_max"] * len(PRF["fields"])]
    return not bad, f"unerreichbar: {bad}" if bad else "alle Freischaltungen erreichbar"


INVARIANTS = {
    "INV-01 Parametergrenzen": inv_bounds,
    "INV-02 Gleichgewichtspreise": inv_equilibrium_in_bounds,
    "INV-03 Keine Sofort-Arbitrage": inv_no_instant_arbitrage,
    "INV-04 Startroute": inv_starter_route,
    "INV-05 Referenzrouten": inv_reference_routes,
    "INV-06 Immobilien-ROI": inv_roi_corridor,
    "INV-07 Kampfwahrscheinlichkeit": inv_combat_range,
    "INV-08 Monte-Carlo-Markt": inv_monte_carlo,
    "INV-09 Strohmann-Gebühr": inv_strawman_expensive,
    "INV-10 Freischaltungen": inv_unlocks_reachable,
    "INV-11 Weltraumroute": inv_space_route,
    "INV-12 Beute-Tageslimit": inv_loot_cap,
    "INV-13 Eindeutige Pate-Wahl": inv_election_unique,
    "INV-14 NPC-Händler": inv_npc_traders,
    "INV-15 NPC-Rückbau": inv_handover_bounds,
}


# =============================================================================
# Dokumentkonsistenz (DOC-*)
# =============================================================================
ID_RE = re.compile(r"\b((?:F|EX)-[A-Z]{2,3}-\d{2})\b")
KEY_RE = re.compile(r"`([a-z_]+(?:\.[a-z0-9_]+)+)`")


def md_files():
    return sorted(DOC_DIR.glob("*.md"))


def doc_ids():
    md_ids = set()
    for f in md_files():
        md_ids |= set(ID_RE.findall(f.read_text(encoding="utf-8")))
    py_ids = set(ID_RE.findall(Path(__file__).read_text(encoding="utf-8")))
    missing_py = sorted(md_ids - py_ids)
    missing_md = sorted(py_ids - md_ids)
    ok = not missing_py and not missing_md
    return ok, (f"{len(md_ids)} IDs konsistent" if ok else
                f"nur in .md: {missing_py}; nur in verify.py: {missing_md}")


def doc_param_keys():
    bad, count = [], 0
    for f in md_files():
        for key in KEY_RE.findall(f.read_text(encoding="utf-8")):
            if key.split(".")[0] not in P:
                continue
            count += 1
            try:
                lookup(key)
            except (KeyError, TypeError):
                bad.append(f"{f.name}: {key}")
    return not bad, f"{count} Parameterverweise gültig" if not bad else f"unbekannt: {bad}"


IMAGE_CATEGORIES = ("goods", "vehicles", "weapons", "armor", "crew", "ships")
IMAGE_NAME_RE = re.compile(r"^[a-z0-9_-]+$")
WARNINGS: list[str] = []


def image_path_errors(path: str, category: str, key: str | None) -> list[str]:
    """Regeln für Bildpfade (ADR-020); key=None bedeutet Fallback der Kategorie."""
    errs = []
    if not isinstance(path, str) or not path:
        return ["leer oder kein Text"]
    if path.startswith("/") or "\\" in path or re.match(r"^[A-Za-z]:", path):
        errs.append("nicht relativ")
    parts = path.split("/")
    if ".." in parts or "." in parts or "" in parts:
        errs.append("ungültige Segmente")
    if parts[0] != category:
        errs.append(f"Präfix muss {category}/ sein")
    stem, dot, ext = parts[-1].rpartition(".")
    if not dot or "." + ext not in P["images"]["allowed_extensions"]:
        errs.append("Endung nicht erlaubt")
    if not IMAGE_NAME_RE.match(stem):
        errs.append("Dateiname nur a–z, 0–9, _ und -")
    if key is not None and stem != key:
        errs.append(f"Dateiname muss {key} heißen")
    if key is None and not stem.startswith("_"):
        errs.append("Fallback-Datei muss mit _ beginnen")
    return errs


def doc_images():
    base = DOC_DIR.parent.parent / P["images"]["base_dir"]
    bad, paths = [], []
    for cat in IMAGE_CATEGORIES:
        fb = P["images"]["fallback"].get(cat)
        if fb is None:
            bad.append(f"images.fallback.{cat}: fehlt")
        else:
            bad += [f"images.fallback.{cat}: {e}" for e in image_path_errors(fb, cat, None)]
            paths.append(fb)
        for key, entry in P[cat].items():
            if "image" in entry:
                bad += [f"{cat}.{key}.image: {e}" for e in image_path_errors(entry["image"], cat, key)]
                paths.append(entry["image"])
    if not base.is_dir():
        WARNINGS.append(f"Bildverzeichnis {P['images']['base_dir']} fehlt – alle Bilder nutzen den Fallback")
        missing = len(paths)
    else:
        missing_list = [x for x in paths if not (base / x).is_file()]
        missing = len(missing_list)
        fb_missing = [x for x in missing_list if x.split("/")[-1].startswith("_")]
        img_missing = [x for x in missing_list if x not in fb_missing]
        if fb_missing:
            WARNINGS.append(f"{len(fb_missing)} Platzhalter des Frontends fehlen: " + ", ".join(fb_missing))
        if img_missing:
            WARNINGS.append(f"{len(img_missing)} Bilddatei(en) fehlen, Fallback greift: " + ", ".join(img_missing))
    return not bad, (f"{len(paths)} Bildpfade gültig, {missing} Dateien fehlen (nur Warnung)"
                     if not bad else f"ungültig: {bad}")


DOC_CHECKS = {"DOC-01 Formel-/Beispiel-IDs": doc_ids, "DOC-02 Parameterverweise": doc_param_keys,
              "DOC-03 Bildpfade": doc_images}


# =============================================================================
# CLI
# =============================================================================
def same(a, b) -> bool:
    if isinstance(a, float) or isinstance(b, float):
        return math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-9)
    if isinstance(a, dict):
        return a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    return a == b


def price_table() -> str:
    lines = []
    earth = list(P["city"])
    earth_goods = [g for g in GOODS if GOODS[g]["realm"] == "earth"]
    lines.append("| Ware | " + " | ".join(P["city"][c]["name"] for c in earth) + " |")
    lines.append("|---|" + "---:|" * len(earth))
    for g in earth_goods:
        cells = [f"{equilibrium_price(c, g) / 100:.2f}".replace(".", ",") for c in earth]
        lines.append(f"| {GOODS[g]['name']} | " + " | ".join(cells) + " |")
    lines.append("")
    locs = ["frankfurt"] + list(P["space_location"])
    space_goods = [g for g in GOODS if GOODS[g]["realm"] == "space"] + ["kokain", "gras"]
    names = [P["city"]["frankfurt"]["name"]] + [P["space_location"][s]["name"] for s in P["space_location"]]
    lines.append("| Ware | " + " | ".join(names) + " |")
    lines.append("|---|" + "---:|" * len(locs))
    for g in space_goods:
        cells = []
        for c in locs:
            cells.append("–" if multipliers(c, g) is None else f"{equilibrium_price(c, g) / 100:.2f}".replace(".", ","))
        lines.append(f"| {GOODS[g]['name']} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    if "--price-table" in argv:
        print(price_table())
        return 0
    if "--print" in argv:
        for ex_id, fn in EXAMPLES.items():
            print(ex_id, fn())
        return 0

    failures = 0
    print("Beispielrechnungen")
    for ex_id, fn in EXAMPLES.items():
        got = fn()
        exp = EXPECTED.get(ex_id)
        ok = exp is not None and same(got, exp)
        failures += not ok
        print(f"  [{'OK' if ok else 'FAIL'}] {ex_id}" + ("" if ok else f"  erwartet={exp}  berechnet={got}"))
    for title, group in (("Invarianten", INVARIANTS), ("Dokumentkonsistenz", DOC_CHECKS)):
        print(title)
        for name, fn in group.items():
            ok, msg = fn()
            failures += not ok
            print(f"  [{'OK' if ok else 'FAIL'}] {name}: {msg}")
    if WARNINGS:
        print("Warnungen")
        for w in WARNINGS:
            print(f"  [WARN] {w}")
    print(f"\n{'ALLE PRÜFUNGEN BESTANDEN' if not failures else f'{failures} PRÜFUNG(EN) FEHLGESCHLAGEN'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
