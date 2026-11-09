import { api, ApiError } from './client';
import { useAuth } from '@/stores/auth';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  beforeEach(() => {
    useAuth.getState().clear();
    vi.restoreAllMocks();
  });

  it('sendet Bearer-Token und parst JSON', async () => {
    useAuth.getState().setSession({ accessToken: 'A1', refreshToken: 'R1' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { ok: 1 }));
    await expect(api('GET', '/x')).resolves.toEqual({ ok: 1 });
    const init = fetchMock.mock.calls[0]![1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer A1');
  });

  it('erneuert bei 401 den Token (Rotation) und wiederholt die Anfrage', async () => {
    useAuth.getState().setSession({ accessToken: 'ALT', refreshToken: 'R1' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'abgelaufen' } }))
      .mockResolvedValueOnce(json(200, { accessToken: 'NEU', refreshToken: 'R2' }))
      .mockResolvedValueOnce(json(200, { ok: 2 }));
    await expect(api('GET', '/x')).resolves.toEqual({ ok: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(useAuth.getState().refreshToken).toBe('R2');
    expect(useAuth.getState().accessToken).toBe('NEU');
  });

  it('meldet ab, wenn der Refresh scheitert', async () => {
    useAuth.getState().setSession({ accessToken: 'ALT', refreshToken: 'R1' });
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }))
      .mockResolvedValueOnce(json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } }));
    await expect(api('GET', '/x')).rejects.toBeInstanceOf(ApiError);
    expect(useAuth.getState().refreshToken).toBeNull();
  });

  it('übersetzt das Fehlerformat {error:{code,message}}', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json(409, { error: { code: 'INSUFFICIENT_FUNDS', message: 'zu arm' } }),
    );
    await expect(api('POST', '/trade', { anonymous: true })).rejects.toMatchObject({
      status: 409,
      code: 'INSUFFICIENT_FUNDS',
    });
  });
});
