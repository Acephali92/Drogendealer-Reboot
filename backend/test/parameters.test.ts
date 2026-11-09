import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { DEFAULT_GAME_PARAMETERS_PATH, parseGameParameters } from '../src/config/parameters.js';
import { createTestApp, register, truncateAll } from './helpers.js';

describe('game parameters at startup (T-101)', () => {
  let app: FastifyInstance;
  let dir: string;

  beforeAll(async () => {
    app = await createTestApp();
    await truncateAll(app);
    dir = mkdtempSync(join(tmpdir(), 'params-'));
  });
  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('loads the real parameter file into app.gameParams', () => {
    expect(app.gameParams.meta.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(app.gameParams.meta.tick_minutes).toBeGreaterThan(0);
    expect(Object.isFrozen(app.gameParams)).toBe(true);
  });

  it('gives new players health from player.hp_max', async () => {
    const res = await register(app);
    expect(res.statusCode).toBe(201);
    const player = await app.prisma.player.findUniqueOrThrow({ where: { id: res.json().user.playerId } });
    expect(player.health).toBe(app.gameParams.player.hp_max);
    expect(player.maxHealth).toBe(app.gameParams.player.hp_max);
  });

  it('refuses to start with a missing parameter file', async () => {
    await expect(createTestApp({ GAME_PARAMETERS_PATH: join(dir, 'missing.toml') })).rejects.toThrow(
      /\(file\)/,
    );
  });

  it('refuses to start with an invalid parameter file and names the problem', async () => {
    const broken = readFileSync(DEFAULT_GAME_PARAMETERS_PATH, 'utf8').replace('hp_max = 100', 'hp_max = 0');
    const path = join(dir, 'broken.toml');
    writeFileSync(path, broken);
    expect(() => parseGameParameters(broken)).toThrow(/player\.hp_max/);
    await expect(createTestApp({ GAME_PARAMETERS_PATH: path })).rejects.toThrow(/player\.hp_max/);
  });
});
