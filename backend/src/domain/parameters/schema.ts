/**
 * Schema of docs/game-design/parameters.toml (Agent 2, single source of truth for game values).
 *
 * The TOML file is parsed with integers as BigInt, so integer and float literals stay distinct:
 *  - money (cents, ADR-019)  → `bigint`, must be written as an integer literal
 *  - other integers           → `number`, must be written as an integer literal
 *  - real numbers             → `number`, integer literals are accepted (e.g. `min_stock = 1`)
 * Every table is `.strict()`: unknown keys (typos) are reported instead of being ignored.
 *
 * Pure module (no I/O) – shared with the balancing simulation (ADR-012).
 */
import { z } from 'zod';

// ── Primitive value types ───────────────────────────────────────────────────

/** Amount in cents (integer literal, ≥ 0). */
const money = z.bigint({ error: 'must be an integer amount in cents' }).min(0n, 'must not be negative');

/** Integer literal converted to a JS number. */
const int = z
  .bigint({ error: 'must be an integer' })
  .refine(
    (v) => v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER),
    'integer out of range',
  )
  .transform((v) => Number(v));
const nonNegInt = int.pipe(z.number().min(0, 'must not be negative'));
const posInt = int.pipe(z.number().min(1, 'must be at least 1'));

/** Real number; integer literals are accepted and converted. */
const real = z
  .union([z.number(), z.bigint().transform((v) => Number(v))], { error: 'must be a number' })
  .pipe(z.number().refine(Number.isFinite, 'must be finite'));
const nonNegReal = real.pipe(z.number().min(0, 'must not be negative'));
/** Probability or share in [0, 1]. */
const unit = real.pipe(z.number().min(0, 'must be in [0, 1]').max(1, 'must be in [0, 1]'));

const name = z.string().min(1, 'must not be empty');
/** Clan rank: upper-case API value, e.g. "PATE" (clans.md). */
const rank = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'rank must be upper case [A-Z0-9_]');
/** Technical key (lower case, used in code and as DB slug). */
const KEY = /^[a-z][a-z0-9_]*$/;
/** Map of good key → multiplier (city supply/demand). */
const multipliers = z.record(z.string().regex(KEY), nonNegReal);

/** Table of entries keyed by technical key, e.g. [goods.gras], [city.berlin]. */
const catalog = <T extends z.ZodType>(entry: T) =>
  z
    .record(z.string().regex(KEY, 'key must be lower case [a-z0-9_]'), entry)
    .refine((r) => Object.keys(r).length > 0, 'must contain at least one entry');

// ── Sections ─────────────────────────────────────────────────────────────────

const meta = z
  .object({ version: name, tick_minutes: posInt, ticks_per_day: posInt, currency: z.literal('EUR') })
  .strict();

const player = z
  .object({
    start_cash_black: money,
    start_cash_white: money,
    backpack_capacity: nonNegInt,
    hp_max: posInt,
  })
  .strict();

const account = z.object({ deletion_policy: z.enum(['forfeit']) }).strict();

const heat = z
  .object({
    max: nonNegReal,
    decay_base: unit,
    police_decay_damping: nonNegReal,
    trade_heat_per_keur: nonNegReal,
  })
  .strict();

const economy = z
  .object({
    elasticity: nonNegReal,
    wealth_price_exponent: nonNegReal,
    cover_ticks: posInt,
    reversion_rate: unit,
    noise_rho: unit,
    price_min_factor: nonNegReal,
    price_max_factor: nonNegReal,
    min_stock: nonNegReal,
  })
  .strict();

const cities = z.object({ demand_wealth_exponent: nonNegReal }).strict();

const good = z
  .object({
    name,
    realm: z.enum(['earth', 'space']),
    base_price: money,
    consumption: nonNegReal,
    volatility: nonNegReal,
    volume: posInt,
    spoil_rate: unit,
    heat: nonNegReal,
  })
  .strict();

const marketEvent = z
  .object({
    name,
    probability: unit,
    duration: posInt,
    stock_shock: nonNegReal,
    supply_mult: nonNegReal,
    demand_mult: nonNegReal,
  })
  .strict();

const city = z
  .object({
    name,
    pop: posInt,
    wealth: nonNegReal,
    police: unit,
    fuel_price: money,
    spaceport: z.boolean(),
    supply: multipliers,
    demand: multipliers,
  })
  .strict();

/** "a-b" → distance; checked against the catalogs in validate.ts. */
const distanceTable = z.record(z.string().regex(/^[a-z0-9_]+-[a-z0-9_]+$/, 'key must be "a-b"'), posInt);

const travel = z
  .object({
    train_speed: posInt,
    train_price_per_km: money,
    segment_km: posInt,
    control_base: unit,
    control_segment_max: unit,
    cargo_heat_half: nonNegReal,
    fine_rate: nonNegReal,
    heat_on_bust: nonNegReal,
    bribe_cost_rate: nonNegReal,
    bribe_base_success: unit,
    bribe_police_penalty: nonNegReal,
    bribe_success_min: unit,
    bribe_success_max: unit,
    control_decision_timeout_ticks: nonNegInt,
    debt_repayment_rate: unit,
    vehicle_resale_rate: unit,
  })
  .strict();

const vehicle = z
  .object({
    name,
    price: money,
    speed: posInt,
    consumption: nonNegReal,
    capacity: posInt,
    hide: unit,
  })
  .strict();

const professions = z
  .object({
    fields: z.array(z.string().regex(KEY)).min(1),
    xp_per_level_k: posInt,
    level_max: posInt,
    handel_xp_per_eur: nonNegReal,
    schmuggel_xp_per_km: nonNegReal,
    schmuggel_xp_per_cargo_heat: nonNegReal,
    gewalt_xp_win: nonNegInt,
    gewalt_xp_loss: nonNegInt,
    produktion_xp_per_unit: nonNegReal,
    finanzen_xp_per_eur: nonNegReal,
    handel_spread_reduction: nonNegReal,
    handel_spread_reduction_cap: unit,
    schmuggel_control_reduction: nonNegReal,
    schmuggel_control_reduction_cap: unit,
    schmuggel_bribe_bonus: nonNegReal,
    gewalt_strength_bonus: nonNegReal,
    gewalt_strength_bonus_cap: unit,
    produktion_yield_bonus: nonNegReal,
    produktion_yield_bonus_cap: unit,
    finanzen_fee_reduction: nonNegReal,
    finanzen_fee_reduction_cap: unit,
    finanzen_risk_reduction: nonNegReal,
    finanzen_risk_reduction_cap: unit,
  })
  .strict();

const unlock = z
  .object({
    field: z.string().regex(KEY).optional(),
    level: posInt.optional(),
    level_sum: posInt.optional(),
    white_cash: money.optional(),
    networth: money.optional(),
    requires_spaceport: z.boolean().optional(),
  })
  .strict()
  .refine((u) => Object.keys(u).length > 0, 'unlock needs at least one condition');

const trade = z.object({ spread_base: unit, max_trade_share: unit, slippage_tolerance: unit }).strict();

const combat = z
  .object({
    base_strength: nonNegReal,
    armor_attack_weight: nonNegReal,
    weapon_defense_weight: nonNegReal,
    morale_min: nonNegReal,
    morale_span: nonNegReal,
    alpha: nonNegReal,
    win_chance_min: unit,
    win_chance_max: unit,
    home_defense_bonus: nonNegReal,
    loss_coeff_winner: nonNegReal,
    loss_max_winner: unit,
    loss_coeff_loser: nonNegReal,
    loss_max_loser: unit,
    loot_cash_rate: unit,
    loot_goods_rate: unit,
    loot_daily_cap_rate: unit,
    loot_cap_window_ticks: posInt,
    loot_repeat_decay: unit,
    loot_repeat_window_ticks: posInt,
    loot_fence_rate: unit,
    hp_loss_winner: nonNegInt,
    hp_loss_loser: nonNegInt,
    hp_regen_per_tick: nonNegInt,
    hospital_ticks: nonNegInt,
    newbie_protection_ticks: nonNegInt,
    newbie_protection_networth: money,
    networth_band: unit,
    networth_history_ticks: posInt,
    target_cooldown_ticks: nonNegInt,
    attack_cooldown_ticks: nonNegInt,
    heat_attack: nonNegReal,
  })
  .strict();

const gear = z.object({ strength: nonNegInt, price: money }).strict();
const crewMember = z.object({ strength: nonNegInt, hire: money, upkeep: money }).strict();

const clans = z
  .object({
    founding_cost: money,
    max_level: posInt,
    member_base: posInt,
    member_per_level: nonNegInt,
    upgrade_base_cost: money,
    upgrade_growth: nonNegReal,
    tax_max: unit,
    presence_bonus_per_member: nonNegReal,
    presence_bonus_max: unit,
    districts_per_city: nonNegInt,
    district_income_base: money,
    district_claim_cost: money,
    war_declaration_cost: money,
    war_lead_ticks: nonNegInt,
    war_duration_ticks: posInt,
    war_points_base: nonNegReal,
    war_points_upset: nonNegReal,
    war_reparation_rate: unit,
    leave_cooldown_ticks: nonNegInt,
    leave_cooldown_war_ticks: nonNegInt,
    capo_daily_payout_limit: unit,
    consigliere_max: nonNegInt,
    capo_per_members: posInt,
    ranks: z.array(rank).min(1),
    networth_treasury_share: unit,
    probation_ticks: nonNegInt,
    inactive_pate_ticks: posInt,
    election_duration_ticks: posInt,
    election_voter_min_rank: rank,
    election_candidate_min_rank: rank,
    election_candidate_min_tenure_ticks: nonNegInt,
    no_confidence_min_rank: rank,
    no_confidence_quorum_num: posInt,
    no_confidence_quorum_den: posInt,
    no_confidence_duration_ticks: posInt,
    no_confidence_cooldown_ticks: nonNegInt,
    district_min_members: posInt,
    district_abandon_ticks: posInt,
  })
  .strict();

const laundering = z
  .object({
    fee_min: unit,
    risk_base: unit,
    risk_exponent: nonNegReal,
    risk_max_per_tick: unit,
    max_ratio: nonNegReal,
    lookback_ticks: posInt,
    penalty_fine_rate: nonNegReal,
    closure_ticks: nonNegInt,
    heat_on_detection: nonNegReal,
    strawman_fee: unit,
    strawman_daily_cap: money,
  })
  .strict();

const realEstate = z
  .object({
    wealth_exponent: nonNegReal,
    upgrade_income_bonus: nonNegReal,
    upgrade_upkeep_bonus: nonNegReal,
    upgrade_cost_factor: nonNegReal,
    max_upgrade: nonNegInt,
    raid_fine_rate: nonNegReal,
    raid_closure_ticks: nonNegInt,
    roi_target_min_days: posInt,
    roi_target_max_days: posInt,
    production_max_ticks: posInt,
    max_per_type_city: posInt,
    resale_rate: unit,
    foreclosure_rate: unit,
    unpaid_upkeep_ticks: posInt,
  })
  .strict();

const business = z
  .object({
    name,
    price: money,
    income: money,
    upkeep: money,
    wash_fee: unit.optional(),
    raid_risk: unit,
    hide_bonus: unit.optional(),
    capacity: posInt.optional(),
    produces: z.array(z.string().regex(KEY)).min(1).optional(),
    output_per_tick: nonNegReal.optional(),
    material_cost_ratio: unit.optional(),
  })
  .strict();

const space = z
  .object({
    launch_ticks: nonNegInt,
    launch_fee: money,
    piracy_base: unit,
    piracy_segment_ticks: posInt,
    pirate_strength: nonNegReal,
    pirate_loot_rate: unit,
  })
  .strict();

const spaceLocation = z
  .object({
    name,
    pop: posInt,
    wealth: nonNegReal,
    police: unit,
    fuel_price: money,
    danger: unit,
    supply: multipliers,
    demand: multipliers,
  })
  .strict();

const ship = z
  .object({
    name,
    price: money,
    speed: nonNegReal,
    consumption: nonNegReal,
    capacity: posInt,
    strength: nonNegReal,
    range: posInt,
  })
  .strict();

const npc = z
  .object({
    k_start: unit,
    k_min: unit,
    k_max: unit,
    trader_intensity: nonNegReal,
    trader_threshold_base: nonNegReal,
    trader_threshold_per_km: nonNegReal,
    trader_threshold_scale: nonNegReal,
    couriers_per_city_day: nonNegInt,
    courier_tiers: posInt,
    courier_strength_base: nonNegReal,
    courier_strength_growth: nonNegReal,
    courier_cash_base: money,
    courier_cash_growth: nonNegReal,
    courier_cooldown_ticks: nonNegInt,
    gang_attack_base: unit,
    gang_min_cash: money,
    gang_cooldown_ticks: nonNegInt,
    gang_strength_factor: nonNegReal,
    handover_route_competition: unit,
    handover_target_availability: unit,
    handover_market_activity: unit,
    handover_min_peak_online: posInt,
    handover_hold_days: posInt,
    handover_miss_days: posInt,
    handover_step: unit,
    handover_step_days: posInt,
    handover_top_routes: posInt,
  })
  .strict();

/** "section.key" → [min, max] for the invariant check. */
const bounds = z.record(
  z.string().regex(/^[a-z_]+\.[a-z_]+$/, 'key must be "section.key"'),
  z.tuple([real, real]),
);

// ── Whole file ───────────────────────────────────────────────────────────────

export const gameParametersSchema = z
  .object({
    meta,
    player,
    account,
    heat,
    economy,
    cities,
    goods: catalog(good),
    events: catalog(marketEvent),
    city: catalog(city),
    distances: distanceTable,
    travel,
    vehicles: catalog(vehicle),
    professions,
    unlocks: catalog(unlock),
    trade,
    combat,
    weapons: catalog(gear),
    armor: catalog(gear),
    crew: catalog(crewMember),
    clans,
    laundering,
    real_estate: realEstate,
    businesses: catalog(business),
    space,
    space_location: catalog(spaceLocation),
    space_distances: distanceTable,
    ships: catalog(ship),
    npc,
    bounds,
  })
  .strict();

/** Validated game parameters (money as bigint cents, everything else as number). */
export type GameParameters = z.output<typeof gameParametersSchema>;
