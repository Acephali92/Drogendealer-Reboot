import * as E from './engine';

const NOW = Date.parse('2026-11-08T12:00:00Z');

function setup() {
  const s = E.createState(NOW, 42);
  const auth = E.register(s, { email: 'a@b.de', username: 'Tester', password: 'geheim123', ageConfirmed: true }, NOW);
  const p = E.playerForToken(s, auth.accessToken);
  return { s, p, auth };
}

const city = (slug: string) => E.cities.find((c) => c.slug === slug)!;
const com = (slug: string) => E.commodities.find((c) => c.slug === slug)!;

describe('Mock-Engine (Vertragsformat)', () => {
  it('verlangt die Altersbestätigung (ADR-013)', () => {
    const s = E.createState(NOW, 1);
    expect(() => E.register(s, { email: 'x@y.de', username: 'Jung', password: 'geheim123' })).toThrow(/Alters/);
    expect(() => E.register(s, { email: 'x@y.de', username: 'Jung', password: 'geheim123', ageConfirmed: 'yes' })).toThrow(
      E.MockApiError,
    );
  });

  it('registriert mit Startgeld in Cent, Spieler-ID und Clan-Einladung', () => {
    const { s, p, auth } = setup();
    expect(auth.user.playerId).toBe(p.id);
    expect(E.playerDto(s, p).cash).toBe('200000');
    expect(E.myInvites(s, p).invites).toHaveLength(1);
    expect(() => E.register(s, { email: 'a@b.de', username: 'Other', password: 'geheim123', ageConfirmed: true })).toThrow(
      E.MockApiError,
    );
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
    const r = E.trade(s, p, { cityId: city('berlin').id, commodityId: gras.id, side: 'BUY', quantity: 10 }, NOW);
    expect(r.inventory.items[0]!.quantity).toBe(10);
    expect(r.inventory.capacityG).toBeNull(); // kein Fahrzeug → laut Vertrag null
    expect(BigInt(r.player.cash)).toBe(200_000n - BigInt(r.transaction.total));
    expect(() => E.trade(s, p, { cityId: city('berlin').id, commodityId: gras.id, side: 'SELL', quantity: 11 })).toThrow(
      /nicht dabei/,
    );
    // Rucksack: 60 Volumeneinheiten, Grünzeug hat Volumen 2 → max. 30
    expect(() => E.trade(s, p, { cityId: city('berlin').id, commodityId: gras.id, side: 'BUY', quantity: 25 })).toThrow(
      /Laderaum/,
    );
  });

  it('reist mit Countdown und kommt an', () => {
    const { s, p } = setup();
    E.setStartCity(s, p, city('berlin').id);
    const { travel } = E.startTravel(s, p, city('leipzig').id, NOW);
    expect(travel.toCity.name).toBe('Plattenhausen');
    expect(p.status).toBe('TRAVELING');
    E.advance(s, Date.parse(travel.arrivesAt) + 1);
    expect(p.status).toBe('IDLE');
    expect(E.playerDto(s, p).currentCity?.slug).toBe('leipzig');
    expect(p.notifications[0]!.type).toBe('TRAVEL_ARRIVED');
  });

  it('gründet Clans mit Pate und liefert Ranglisten im Vertragsformat', () => {
    const { s, p } = setup();
    p.cash = 10_000_000;
    const { clan } = E.clanCreate(s, p, { name: 'Testfamilie', tag: 'TST' }, NOW);
    expect(clan.members[0]!.role).toBe('GODFATHER');
    expect(clan.bank).toBe('0');
    expect(E.clanGet(s, s.players[Object.keys(s.players)[0]!]!, clan.id).clan.bank).toBeNull();
    const r = E.rankings(s, 'wealth', 5);
    expect(r.entries).toHaveLength(5);
    expect(r.total).toBeGreaterThan(5);
    expect('player' in r.entries[0]! && r.entries[0].rank).toBe(1);
  });

  it('exportiert und löscht das Konto (ADR-015)', () => {
    const { s, p, auth } = setup();
    expect(E.exportData(s, p).account?.email).toBe('a@b.de');
    expect(() => E.deleteAccount(s, p, 'falsch')).toThrow(/Passwort/);
    E.deleteAccount(s, p, 'geheim123');
    expect(s.players[p.id]).toBeUndefined();
    expect(() => E.playerForToken(s, auth.accessToken)).toThrow(E.MockApiError);
  });
});
