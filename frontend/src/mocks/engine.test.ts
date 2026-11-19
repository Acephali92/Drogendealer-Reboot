import * as E from './engine';

const NOW = Date.parse('2026-11-08T12:00:00Z');

function setup() {
  const s = E.createState(NOW, 42);
  const auth = E.register(
    s,
    { email: 'a@b.de', username: 'Tester', password: 'geheim123', ageConfirmed: true },
    NOW,
  );
  const p = E.playerForToken(s, auth.accessToken);
  return { s, p, auth };
}

const city = (slug: string) => E.cities.find((c) => c.slug === slug)!;
const com = (slug: string) => E.commodities.find((c) => c.slug === slug)!;

describe('Mock-Engine (Vertragsformat)', () => {
  it('verlangt die Altersbestätigung (ADR-013)', () => {
    const s = E.createState(NOW, 1);
    expect(() => E.register(s, { email: 'x@y.de', username: 'Jung', password: 'geheim123' })).toThrow(
      /Alters/,
    );
    expect(() =>
      E.register(s, { email: 'x@y.de', username: 'Jung', password: 'geheim123', ageConfirmed: 'yes' }),
    ).toThrow(E.MockApiError);
  });

  it('registriert mit Startgeld in Cent, Spieler-ID und Clan-Einladung', () => {
    const { s, p, auth } = setup();
    expect(auth.user.playerId).toBe(p.id);
    expect(E.playerDto(s, p).cash).toBe('200000');
    expect(E.myInvites(s, p).invites).toHaveLength(1);
    expect(() =>
      E.register(s, { email: 'a@b.de', username: 'Other', password: 'geheim123', ageConfirmed: true }),
    ).toThrow(E.MockApiError);
  });

  it('rotiert Refresh-Tokens und liefert dabei den Nutzer', () => {
    const { s, auth } = setup();
    const next = E.refresh(s, auth.refreshToken);
    expect(next.refreshToken).not.toBe(auth.refreshToken);
    expect(next.user.username).toBe('Tester');
    expect(() => E.refresh(s, auth.refreshToken)).toThrow(/abgelaufen/);
  });

  it('nutzt die satirischen Anzeigenamen und echten Distanzen', () => {
    expect(city('berlin').name).toBe('Pleitenberg');
    expect(com('kokain').name).toBe('Schneegestöber');
    expect(E.distanceKm(city('berlin').id, city('hamburg').id)).toBe(289);
  });

  it('kauft und verkauft mit Geld-, Lager- und Laderaumprüfung', () => {
    const { s, p } = setup();
    E.setStartCity(s, p, city('berlin').id);
    const gras = com('gras');
    const r = E.trade(
      s,
      p,
      { cityId: city('berlin').id, commodityId: gras.id, side: 'BUY', quantity: 10 },
      NOW,
    );
    expect(r.inventory.items[0]!.quantity).toBe(10);
    expect(r.inventory.capacity).toBe(60); // kein Fahrzeug → nur Rucksack (VE)
    expect(r.inventory.used).toBe(20); // 10 × Volumen 2
    expect(r.player.heat).toBeGreaterThan(0); // Heat in der aktuellen Stadt
    expect(BigInt(r.player.cash)).toBe(200_000n - BigInt(r.transaction.total));
    expect(() =>
      E.trade(s, p, { cityId: city('berlin').id, commodityId: gras.id, side: 'SELL', quantity: 11 }),
    ).toThrow(/nicht dabei/);
    // Rucksack: 60 Volumeneinheiten, Grünzeug hat Volumen 2 → max. 30
    expect(() =>
      E.trade(s, p, { cityId: city('berlin').id, commodityId: gras.id, side: 'BUY', quantity: 25 }),
    ).toThrow(/Laderaum/);
  });

  it('reist mit Countdown und kommt an', () => {
    const { s, p } = setup();
    E.setStartCity(s, p, city('berlin').id);
    const conn = E.cityDetail(s, p, 'berlin').city.connections.find((c) => c.toCity.slug === 'leipzig')!;
    expect(conn.travelOptions.map((o) => o.mode)).toEqual(['train']); // ohne Fahrzeug nur Bahn
    expect(conn.travelOptions[0]!.cost).toBe(String(Math.ceil(conn.distanceKm * 15))); // F-TRV-03
    const { travel } = E.startTravel(s, p, { toCityId: city('leipzig').id, mode: 'train' }, NOW);
    expect(travel.toCity.name).toBe('Plattenhausen');
    expect(p.status).toBe('TRAVELING');
    E.advance(s, Date.parse(travel.arrivesAt) + 1);
    expect(p.status).toBe('IDLE');
    expect(E.playerDto(s, p).currentCity?.slug).toBe('leipzig');
    expect(p.notifications[0]!.type).toBe('TRAVEL_ARRIVED');
    expect(p.transactions[0]!.reason).toBe('TRAVEL_TICKET');
  });

  it('verlangt für die Fahrzeugoption ein aktives Fahrzeug', () => {
    const { s, p } = setup();
    E.setStartCity(s, p, city('berlin').id);
    expect(() => E.startTravel(s, p, { toCityId: city('leipzig').id, mode: 'vehicle' }, NOW)).toThrow(
      /aktives Fahrzeug/,
    );
  });

  it('bucht Bargeld und Bankkonto getrennt (ADR-023)', () => {
    const { s, p } = setup();
    expect(p.transactions[0]).toMatchObject({ account: 'CASH', reason: 'START_CAPITAL', amount: '200000' });
    E.setStartCity(s, p, city('berlin').id);
    E.trade(s, p, { cityId: city('berlin').id, commodityId: com('gras').id, side: 'BUY', quantity: 1 }, NOW);
    expect(p.transactions[0]).toMatchObject({ account: 'CASH', reason: 'TRADE_BUY' });
    // Clan-Gründung kostet Weißgeld (Bankkonto), Bargeld reicht nicht
    p.cash = 99_000_000;
    expect(() => E.clanCreate(s, p, { name: 'Nur Bargeld', tag: 'NBG' })).toThrow(/Bankkonto/);
  });

  it('liefert Märkte mit Richtpreis, Bestand und Ereignissen', () => {
    const { s } = setup();
    const m = E.market(s, 'berlin');
    expect(m.markets[0]).toMatchObject({ activeEvent: null, eventTicksLeft: null });
    expect(m.markets[0]!.referencePrice).toMatch(/^\d+$/);
    E.advance(s, NOW + 60 * 30_000);
    const events = Object.values(s.markets)
      .flatMap((c) => Object.values(c))
      .filter((r) => r.event);
    expect(events.length).toBeGreaterThan(0);
  });

  it('gründet Clans mit Pate und liefert Ranglisten im Vertragsformat', () => {
    const { s, p } = setup();
    p.bank = 10_000_000;
    const { clan } = E.clanCreate(s, p, { name: 'Testfamilie', tag: 'TST' }, NOW);
    expect(clan.members[0]!.role).toBe('GODFATHER');
    expect(clan.treasury).toEqual({ cash: '0', bank: '0' });
    expect(E.clanGet(s, s.players[Object.keys(s.players)[0]!]!, clan.id).clan.treasury).toBeNull();
    const r = E.rankings(s, 'wealth', 5);
    expect(r.entries).toHaveLength(5);
    expect(r.total).toBeGreaterThan(5);
    expect('player' in r.entries[0]! && r.entries[0].rank).toBe(1);
  });

  it('exportiert und löscht das Konto (ADR-015)', () => {
    const { s, p, auth } = setup();
    expect(E.exportData(s, p).account?.email).toBe('a@b.de');
    expect(E.exportData(s, p).formatVersion).toBe(2);
    expect(() => E.deleteAccount(s, p, 'falsch')).toThrow(/Passwort/);
    E.deleteAccount(s, p, 'geheim123');
    expect(s.players[p.id]).toBeUndefined();
    expect(() => E.playerForToken(s, auth.accessToken)).toThrow(E.MockApiError);
  });
});
