import { delay, http, HttpResponse, type HttpHandler } from 'msw';
import type { RankingTypeDto } from '@/api/contract';
import * as E from './engine';
import { getState, saveState } from './store';

/** Passt auf relative (/api/v1) und absolute Basis-URLs. */
const P = (path: string) => `*/api/v1${path}`;

type Ctx = { s: E.MockState; request: Request; url: URL; params: Record<string, string>; token: string | null };
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
      const body = await fn({ s, request, url: new URL(request.url), params: params as Record<string, string>, token });
      saveState();
      if (body === undefined) return new HttpResponse(null, { status: 204 });
      return HttpResponse.json(body as object, { status });
    } catch (e) {
      saveState();
      if (e instanceof E.MockApiError) {
        return HttpResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      }
      console.error('[mock]', e);
      return HttpResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Mock-Fehler' } }, { status: 500 });
    }
  };

const me = (c: Ctx) => E.playerForToken(c.s, c.token, hybridMode);
const json = async <T>(r: Request) => ((await r.json().catch(() => ({}))) ?? {}) as T;
const num = (c: Ctx, k: string, d: number) => Number(c.url.searchParams.get(k) ?? d) || d;

const authHandlers: HttpHandler[] = [
  http.post(P('/auth/register'), run(async (c) => E.register(c.s, await json(c.request)), 201)),
  http.post(P('/auth/login'), run(async (c) => E.login(c.s, await json(c.request)))),
  http.post(P('/auth/refresh'), run(async (c) => E.refresh(c.s, (await json<{ refreshToken?: string }>(c.request)).refreshToken))),
  http.post(
    P('/auth/logout'),
    run(async (c) => {
      E.logout(c.s, (await json<{ refreshToken?: string }>(c.request)).refreshToken);
    }),
  ),
];

const gameHandlers: HttpHandler[] = [
  /* Spieler & Konto */
  http.get(P('/players/me'), run((c) => ({ player: E.playerDto(c.s, me(c)) }))),
  http.get(P('/players/me/transactions'), run((c) => E.transactions(me(c), num(c, 'limit', 20), num(c, 'offset', 0)))),
  http.get(P('/players/online'), run((c) => E.online(c.s))),
  http.get(P('/players/me/export'), async ({ request }) => {
    const s = getState();
    const auth = request.headers.get('authorization');
    try {
      const data = E.exportData(s, E.playerForToken(s, auth?.slice(7) ?? null, hybridMode));
      return new HttpResponse(JSON.stringify(data, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="drogendealer-export.json"',
          'Cache-Control': 'no-store',
        },
      });
    } catch (e) {
      const err = e as E.MockApiError;
      return HttpResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status ?? 500 });
    }
  }),
  http.delete(
    P('/players/me'),
    run(async (c) => {
      E.deleteAccount(c.s, me(c), (await json<{ password?: string }>(c.request)).password);
    }),
  ),
  /* (draft) */
  http.post(P('/players/me/start-city'), run(async (c) => E.setStartCity(c.s, me(c), (await json<{ cityId: string }>(c.request)).cityId))),

  /* Welt & Markt */
  http.get(P('/cities'), run(() => ({ cities: E.cities }))),
  http.get(P('/cities/:slug'), run((c) => E.cityDetail(c.s, me(c), c.params.slug!))),
  http.get(P('/cities/:slug/market'), run((c) => E.market(c.s, c.params.slug!))),
  http.get(P('/market/overview'), run((c) => E.overview(c.s))),

  /* Besitz */
  http.get(P('/inventory'), run((c) => E.inventoryDto(me(c)))),
  http.get(P('/vehicle-types'), run(() => ({ vehicleTypes: E.vehicleTypes }))),
  http.get(P('/vehicles'), run((c) => ({ vehicles: E.vehiclesOf(me(c)) }))),
  http.get(P('/equipment-types'), run(() => ({ equipmentTypes: E.equipmentTypes }))),
  http.get(P('/equipment'), run((c) => ({ equipment: E.equipmentOf(me(c)) }))),
  http.get(P('/travel/current'), run((c) => E.currentTravel(c.s, me(c)))),
  /* (draft) */
  http.post(P('/trade'), run(async (c) => E.trade(c.s, me(c), await json(c.request)))),
  http.post(P('/vehicles'), run(async (c) => E.buyVehicle(c.s, me(c), (await json<{ vehicleTypeId: string }>(c.request)).vehicleTypeId), 201)),
  http.post(P('/vehicles/:id/activate'), run((c) => E.activateVehicle(c.s, me(c), c.params.id!))),
  http.post(P('/vehicles/:id/sell'), run((c) => E.sellVehicle(c.s, me(c), c.params.id!))),
  http.post(P('/equipment'), run(async (c) => E.buyEquipment(c.s, me(c), (await json<{ equipmentTypeId: string }>(c.request)).equipmentTypeId), 201)),
  http.post(P('/travel'), run(async (c) => E.startTravel(c.s, me(c), (await json<{ toCityId: string }>(c.request)).toCityId), 201)),

  /* Clans */
  http.get(P('/clans'), run((c) => E.clanList(c.s))),
  http.get(P('/clans/:id'), run((c) => E.clanGet(c.s, me(c), c.params.id!))),
  http.get(P('/clan-invites'), run((c) => E.myInvites(c.s, me(c)))),
  /* (draft) */
  http.post(P('/clans'), run(async (c) => E.clanCreate(c.s, me(c), await json(c.request)), 201)),
  http.post(P('/clans/:id/invites'), run(async (c) => E.clanInvite(c.s, me(c), c.params.id!, (await json<{ playerName: string }>(c.request)).playerName), 201)),
  http.post(
    P('/clans/:id/leave'),
    run((c) => {
      E.leaveClan(c.s, me(c), c.params.id!);
    }),
  ),
  http.post(P('/clan-invites/:id/accept'), run((c) => E.answerInvite(c.s, me(c), c.params.id!, true))),
  http.post(
    P('/clan-invites/:id/decline'),
    run((c) => {
      E.answerInvite(c.s, me(c), c.params.id!, false);
    }),
  ),

  /* Ranglisten, Meldungen, Ticker */
  http.get(
    P('/rankings'),
    run((c) => {
      me(c);
      const type = (c.url.searchParams.get('type') ?? 'wealth') as RankingTypeDto;
      return E.rankings(c.s, type, num(c, 'limit', 20), num(c, 'offset', 0));
    }),
  ),
  http.get(
    P('/notifications'),
    run((c) => E.notifications(me(c), c.url.searchParams.get('unreadOnly') === 'true', num(c, 'limit', 20), num(c, 'offset', 0))),
  ),
  http.post(P('/notifications/read-all'), run((c) => E.readAll(me(c)))),
  http.post(P('/notifications/:id/read'), run((c) => E.readNotification(me(c), c.params.id!))),
  http.get(P('/ticker'), run((c) => E.ticker(c.s, num(c, 'limit', 50)))),
];

export function getHandlers(mode: 'all' | 'hybrid'): HttpHandler[] {
  hybridMode = mode === 'hybrid';
  return mode === 'all' ? [...authHandlers, ...gameHandlers] : gameHandlers;
}
