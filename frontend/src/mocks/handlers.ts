import { delay, http, HttpResponse, type HttpHandler } from 'msw';
import type { RankingType, TradeSide } from '@/api/types';
import * as E from './engine';
import { getState, saveState } from './store';

/** Passt auf relative (/api/v1) und absolute Basis-URLs. */
const P = (path: string) => `*/api/v1${path}`;

type Ctx = { s: E.MockState; request: Request; params: Record<string, string>; token: string | null };
type Fn = (ctx: Ctx) => unknown | Promise<unknown>;

let hybridMode = false;

const run =
  (fn: Fn, status = 200) =>
  async ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
    await delay(80 + Math.random() * 160);
    const s = getState();
    E.advance(s);
    const auth = request.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    try {
      const body = await fn({ s, request, params: params as Record<string, string>, token });
      saveState();
      if (body === undefined) return new HttpResponse(null, { status: 204 });
      return HttpResponse.json(body as object, { status });
    } catch (e) {
      saveState();
      if (e instanceof E.MockApiError) {
        return HttpResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      }
      console.error('[mock]', e);
      return HttpResponse.json({ error: { code: 'INTERNAL', message: 'Mock-Fehler' } }, { status: 500 });
    }
  };

const me = (c: Ctx) => E.playerForToken(c.s, c.token, hybridMode);
const json = async <T>(r: Request) => ((await r.json().catch(() => ({}))) ?? {}) as T;

const authHandlers: HttpHandler[] = [
  http.post(P('/auth/register'), run(async (c) => E.register(c.s, await json(c.request)), 201)),
  http.post(P('/auth/login'), run(async (c) => E.login(c.s, await json(c.request)))),
  http.post(
    P('/auth/refresh'),
    run(async (c) => E.refresh(c.s, (await json<{ refreshToken?: string }>(c.request)).refreshToken)),
  ),
  http.post(
    P('/auth/logout'),
    run(async (c) => {
      E.logout(c.s, (await json<{ refreshToken?: string }>(c.request)).refreshToken);
    }),
  ),
];

const gameHandlers: HttpHandler[] = [
  http.get(P('/players/me'), run((c) => E.playerDto(c.s, me(c)))),
  http.post(
    P('/players/me/start-city'),
    run(async (c) => E.setStartCity(c.s, me(c), (await json<{ cityId: string }>(c.request)).cityId)),
  ),
  http.get(P('/players/me/transactions'), run((c) => E.transactions(me(c)))),
  http.get(P('/players/online'), run((c) => ({ count: E.onlineCount(c.s) }))),

  http.get(P('/cities'), run(() => E.cities)),
  http.get(P('/cities/:slug'), run((c) => E.cityDetail(c.s, me(c), c.params.slug!))),
  http.get(P('/cities/:slug/market'), run((c) => E.market(c.s, c.params.slug!))),
  http.get(P('/market/overview'), run((c) => E.overview(c.s))),

  http.post(
    P('/trade'),
    run(async (c) =>
      E.trade(
        c.s,
        me(c),
        await json<{ cityId: string; commodityId: string; side: TradeSide; quantity: number }>(c.request),
      ),
    ),
  ),
  http.get(P('/inventory'), run((c) => E.inventory(c.s, me(c)))),

  http.get(P('/vehicle-types'), run(() => E.vehicleTypes)),
  http.get(P('/vehicles'), run((c) => E.vehiclesOf(me(c)))),
  http.post(
    P('/vehicles'),
    run(async (c) => E.buyVehicle(c.s, me(c), (await json<{ vehicleTypeId: string }>(c.request)).vehicleTypeId)),
  ),
  http.post(P('/vehicles/:id/activate'), run((c) => E.activateVehicle(c.s, me(c), c.params.id!))),
  http.post(P('/vehicles/:id/sell'), run((c) => E.sellVehicle(c.s, me(c), c.params.id!))),

  http.get(P('/equipment-types'), run(() => E.equipmentTypes)),
  http.get(P('/equipment'), run((c) => E.equipmentOf(me(c)))),
  http.post(
    P('/equipment'),
    run(async (c) =>
      E.buyEquipment(c.s, me(c), (await json<{ equipmentTypeId: string }>(c.request)).equipmentTypeId),
    ),
  ),

  http.post(
    P('/travel'),
    run(async (c) => E.startTravel(c.s, me(c), (await json<{ toCityId: string }>(c.request)).toCityId), 201),
  ),
  http.get(P('/travel/current'), run((c) => E.currentTravel(c.s, me(c)))),

  http.get(P('/clans'), run((c) => E.clanList(c.s))),
  http.post(P('/clans'), run(async (c) => E.clanCreate(c.s, me(c), await json(c.request)), 201)),
  http.get(P('/clans/:id'), run((c) => E.clanGet(c.s, c.params.id!))),
  http.post(
    P('/clans/:id/invites'),
    run(
      async (c) =>
        E.clanInvite(c.s, me(c), c.params.id!, (await json<{ playerName: string }>(c.request)).playerName),
      201,
    ),
  ),
  http.post(
    P('/clans/:id/leave'),
    run((c) => {
      E.leaveClan(c.s, me(c), c.params.id!);
    }),
  ),
  http.get(P('/clan-invites'), run((c) => E.myInvites(c.s, me(c)))),
  http.post(
    P('/clan-invites/:id/accept'),
    run((c) => E.answerInvite(c.s, me(c), c.params.id!, true)),
  ),
  http.post(
    P('/clan-invites/:id/decline'),
    run((c) => {
      E.answerInvite(c.s, me(c), c.params.id!, false);
    }),
  ),

  http.get(
    P('/rankings'),
    run((c) => {
      const type = (new URL(c.request.url).searchParams.get('type') ?? 'wealth') as RankingType;
      return E.rankings(c.s, me(c), type);
    }),
  ),

  http.get(P('/notifications'), run((c) => E.notifications(c.s, me(c)))),
  http.post(
    P('/notifications/read-all'),
    run((c) => {
      E.readNotification(me(c), 'all');
    }),
  ),
  http.post(
    P('/notifications/:id/read'),
    run((c) => {
      E.readNotification(me(c), c.params.id!);
    }),
  ),
  http.get(P('/ticker'), run((c) => E.ticker(c.s))),
];

export function getHandlers(mode: 'all' | 'hybrid'): HttpHandler[] {
  hybridMode = mode === 'hybrid';
  return mode === 'all' ? [...authHandlers, ...gameHandlers] : gameHandlers;
}
