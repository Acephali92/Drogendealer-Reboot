import { validateRegistration } from './validation';

describe('Registrierungsvalidierung', () => {
  it('akzeptiert gültige Eingaben', () => {
    expect(validateRegistration({ email: 'a@b.de', username: 'Dealer_1', password: '12345678', ageConfirmed: true })).toEqual({
      ageConfirmed: null,
      email: null,
      username: null,
      password: null,
    });
  });
  it('lehnt ungültige Eingaben ab', () => {
    const r = validateRegistration({ email: 'x', username: 'ab', password: 'kurz', ageConfirmed: false });
    expect(r.ageConfirmed).not.toBeNull();
    expect(r.email).not.toBeNull();
    expect(r.username).not.toBeNull();
    expect(r.password).not.toBeNull();
    expect(
      validateRegistration({ email: 'a@b.de', username: 'mit leer', password: '12345678', ageConfirmed: true }).username,
    ).not.toBeNull();
  });
});
