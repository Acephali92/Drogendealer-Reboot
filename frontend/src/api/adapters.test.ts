import { toNotification, toPlayer, toRanking, withTrend } from './adapters';
import type { PlayerDto } from './contract';

describe('adapters', () => {
  it('leitet currentCityId aus currentCity ab', () => {
    const dto = { currentCity: { id: 'c1', slug: 'berlin', name: 'Pleitenberg' } } as PlayerDto;
    expect(toPlayer(dto).currentCityId).toBe('c1');
    expect(toPlayer({ ...dto, currentCity: null }).currentCityId).toBeNull();
  });

  it('markiert den eigenen Ranglisten-Eintrag', () => {
    const r = toRanking(
      {
        type: 'wealth',
        total: 2,
        limit: 50,
        offset: 0,
        entries: [
          { rank: 1, player: { id: 'a', name: 'A', level: 3, clanTag: 'BVF' }, value: '100' },
          { rank: 2, player: { id: 'me', name: 'Ich', level: 1, clanTag: null }, value: '50' },
        ],
      },
      { playerId: 'me' },
    );
    expect(r.rows.map((x) => x.isMe)).toEqual([false, true]);
    expect(r.rows[0]!.tag).toBe('BVF');
  });

  it('ordnet Meldungstypen und Links zu', () => {
    const base = { id: '1', title: 't', body: null, readAt: null, createdAt: '' };
    expect(toNotification({ ...base, type: 'CLAN_INVITE', data: null })).toMatchObject({ kind: 'CLAN_INVITE', link: '/clans' });
    expect(toNotification({ ...base, type: 'X', data: { link: '/konto' } })).toMatchObject({ kind: 'SYSTEM', link: '/konto' });
    expect(toNotification({ ...base, type: 'X', data: { link: 'https://evil.example' } }).link).toBeNull();
  });

  it('leitet Preistrends aus Folgeabrufen ab', () => {
    expect(withTrend('c', 'w', '100')).toBe('FLAT');
    expect(withTrend('c', 'w', '120')).toBe('UP');
    expect(withTrend('c', 'w', '120')).toBe('UP');
    expect(withTrend('c', 'w', '90')).toBe('DOWN');
  });
});
