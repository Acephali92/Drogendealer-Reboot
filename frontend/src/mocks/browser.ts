import { setupWorker } from 'msw/browser';
import { getHandlers } from './handlers';

export async function startMocks(mode: 'all' | 'hybrid') {
  const worker = setupWorker(...getHandlers(mode));
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
  console.info(
    `%c[Mock-API] aktiv (${mode === 'all' ? 'komplett simuliert' : 'Auth echt, Spiel simuliert'})`,
    'color:#ffb547',
  );
}
