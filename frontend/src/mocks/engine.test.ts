import * as E from './engine';

const NOW = Date.parse('2026-11-08T12:00:00Z');

function setup() {
  const s = E.createState(NOW, 42);
  const auth = E.register(s, { email: 'a@b.de', username: 'Tester', password: 'geheim123' }, NOW);
  const p = E.playerForToken(s, auth.accessToken);
  return { s, p, auth };
}

describe('Mock-Engine', () => {
  it('registriert Spieler mit Startgeld, Fahrzeug und Clan-Einladung', () => {
    const { s, p } = setup();
    expect(p.cash).toBe(3_000_000);
    expect(E.vehiclesOf(p)).toHaveLength(1);
    expect(E.myInvites(s, p)).toHaveLength(1);
    expect(() => E.register(s, { email: 'a@b.de', username: 'Other', password: 'geheim123' })).toThrow(
      E.MockApiError,
    );
  });

  it('rotiert Refresh-Tokens', () => {
    const { s, auth } = setup();
    const next = E.refresh(s, auth.refreshToken);
    expect(next.refreshToken).not.toBe(auth.refreshToken);
    expect(() => E.refresh(s, auth.refreshToken)).toThrow(/abgelaufen/);
  });

  it('kauft und verkauft Ware mit Geld-, Lager- und Laderaumprüfung', () => {
    const { s, p } = setup();
    const berlin = E.cities.find((c) => c.slug === 'berlin')!;
    E.setStartCity(s, p, berlin.id);
    const gras = E.commodities.find((c) => c.slug === 'gras')!;
    const r = E.trade(s, p, { cityId: berlin.id, commodityId: gras.id, side: 'BUY', quantity: 100 }, NOW);
    expect(r.inventory.items[0]!.quantity).toBe(100);
    expect(BigInt(r.player.cash)).toBe(3_000_000n - BigInt(r.transaction.total));
    expect(() =>
      E.trade(s, p, { cityId: berlin.id, commodityId: gras.id, side: 'SELL', quantity: 101 }, NOW),
    ).toThrow(/nicht dabei/);
    expect(() =>
      E.trade(s, p, { cityId: berlin.id, commodityId: gras.id, side: 'BUY', quantity: 10_000_000 }, NOW),
    ).toThrow(E.MockApiError);
    const sold = E.trade(s, p, { cityId: berlin.id, commodityId: gras.id, side: 'SELL', quantity: 100 }, NOW);
    expect(sold.inventory.items).toHaveLength(0);
  });

  it('reist mit Countdown und kommt an', () => {
    const { s, p } = setup();
    const berlin = E.cities.find((c) => c.slug === 'berlin')!;
    const amsterdam = E.cities.find((c) => c.slug === 'amsterdam')!;
    E.setStartCity(s, p, berlin.id);
    const t = E.startTravel(s, p, amsterdam.id, NOW);
    expect(p.status).toBe('TRAVELING');
    expect(() => E.trade(s, p, { cityId: berlin.id, commodityId: 'x', side: 'BUY', quantity: 1 })).toThrow(
      /unterwegs/,
    );
    E.advance(s, Date.parse(t.arrivesAt) + 1);
    expect(p.status).toBe('IDLE');
    expect(p.currentCityId).toBe(amsterdam.id);
    expect(p.notifications[0]!.kind).toBe('TRAVEL_ARRIVED');
  });

  it('gründet Clans und erstellt Ranglisten', () => {
    const { s, p } = setup();
    const c = E.clanCreate(s, p, { name: 'Testfamilie', tag: 'TST' }, NOW);
    expect(c.members[0]!.role).toBe('LEADER');
    expect(() => E.clanCreate(s, p, { name: 'Zweiter', tag: 'ZWO' })).toThrow(/bereits/);
    const r = E.rankings(s, p, 'wealth');
    expect(r.me?.isMe).toBe(true);
    expect(r.rows[0]!.rank).toBe(1);
  });
});
