import { tradeLimit } from './limits';

describe('tradeLimit', () => {
  const base = { cash: '100000', unitPrice: '1000', supply: 500, owned: 7, freeG: 50_000, unitWeightG: 1 };
  it('begrenzt Kauf durch Bargeld', () => {
    expect(tradeLimit('BUY', base)).toEqual({ max: 100, reason: 'limitCash' });
  });
  it('begrenzt Kauf durch Laderaum', () => {
    expect(tradeLimit('BUY', { ...base, freeG: 40 })).toEqual({ max: 40, reason: 'limitCargo' });
  });
  it('begrenzt Kauf durch Angebot', () => {
    expect(tradeLimit('BUY', { ...base, supply: 3 })).toEqual({ max: 3, reason: 'limitSupply' });
  });
  it('begrenzt Verkauf durch Bestand', () => {
    expect(tradeLimit('SELL', base)).toEqual({ max: 7, reason: 'limitOwned' });
  });
});
