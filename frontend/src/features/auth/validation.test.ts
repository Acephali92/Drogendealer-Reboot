import { validateRegistration } from './validation';

describe('Registrierungsvalidierung', () => {
  it('akzeptiert gültige Eingaben', () => {
    expect(validateRegistration({ email: 'a@b.de', username: 'Dealer_1', password: '12345678' })).toEqual({
      email: null,
      username: null,
      password: null,
    });
  });
  it('lehnt ungültige Eingaben ab', () => {
    const r = validateRegistration({ email: 'x', username: 'ab', password: 'kurz' });
    expect(r.email).not.toBeNull();
    expect(r.username).not.toBeNull();
    expect(r.password).not.toBeNull();
    expect(validateRegistration({ email: 'a@b.de', username: 'mit leer', password: '12345678' }).username).not.toBeNull();
  });
});
