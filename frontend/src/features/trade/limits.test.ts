import { tradeLimit } from './limits';

describe('tradeLimit (Laderaum in Volumeneinheiten)', () => {
  const base = { cash: '100000', unitPrice: '1000', supply: 500.7, owned: 7, free: 60, unitVolume: 0.5 };
  it('begrenzt Kauf durch Bargeld', () => {
    expect(tradeLimit('BUY', base)).toEqual({ max: 100, reason: 'limitCash' });
  });
  it('begrenzt Kauf durch Laderaum (VE)', () => {
    expect(tradeLimit('BUY', { ...base, free: 20, unitVolume: 2 })).toEqual({
      max: 10,
      reason: 'limitCargo',
    });
  });
  it('begrenzt Kauf durch Bestand (abgerundet)', () => {
    expect(tradeLimit('BUY', { ...base, supply: 3.9 })).toEqual({ max: 3, reason: 'limitSupply' });
  });
  it('begrenzt Verkauf durch Besitz', () => {
    expect(tradeLimit('SELL', base)).toEqual({ max: 7, reason: 'limitOwned' });
  });
});
