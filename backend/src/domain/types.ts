/**
 * Contracts shared by all game rules (agreed with Agent 6 for the simulation):
 *
 *   execute(world, playerId, command, params, rng) → CommandResult<World>
 *   applyTick(world, params, rng)                  → CommandResult<World>
 *
 * Rules never mutate their input; they return the new state plus the events that explain the
 * change. Services persist both in one transaction (events feed journals, ticker, notifications).
 */

export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  readonly type: TType;
  readonly payload: TPayload;
}

export interface CommandResult<TWorld, TEvent extends DomainEvent = DomainEvent> {
  readonly world: TWorld;
  readonly events: readonly TEvent[];
}

/**
 * A rule rejected an action (not enough money, wrong city, capacity exceeded …).
 * Services translate it into a 4xx API error; `code` is stable and documented in the API contract.
 */
export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
