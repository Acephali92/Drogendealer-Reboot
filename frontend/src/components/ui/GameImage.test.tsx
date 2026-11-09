import { fireEvent, render, screen } from '@testing-library/react';
import { GameImage } from './GameImage';

vi.mock('virtual:game-images', () => ({
  imageFallbacks: {
    goods: 'goods/_fallback.svg',
    vehicles: null,
    weapons: null,
    armor: null,
    crew: null,
    ships: null,
  },
}));

const icon = <span data-testid="icon">?</span>;

describe('GameImage – Fallback-Kette (ADR-020)', () => {
  it('zeigt das Bild mit Anzeigename als alt-Text, lazy geladen', () => {
    render(<GameImage image="goods/gras.webp" category="goods" name="Grünzeug" fallback={icon} />);
    const img = screen.getByRole('img', { name: 'Grünzeug' });
    expect(img).toHaveAttribute('src', '/images/goods/gras.webp');
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('fällt bei Ladefehler auf den Kategorie-Platzhalter und dann auf das Symbol zurück', () => {
    render(<GameImage image="goods/gras.webp" category="goods" name="Grünzeug" fallback={icon} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByRole('img')).toHaveAttribute('src', '/images/goods/_fallback.svg');
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('nutzt ohne Bildfeld direkt den Platzhalter', () => {
    render(<GameImage image={null} category="goods" name="Grünzeug" fallback={icon} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/images/goods/_fallback.svg');
  });

  it('zeigt ohne Bild und ohne Platzhalter sofort das Symbol', () => {
    render(<GameImage image={undefined} category="vehicles" name="Kleinwagen" fallback={icon} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('ignoriert unsichere Pfade und zeigt nie den Schlüssel', () => {
    const { container } = render(
      <GameImage image="../../etc/passwd.png" category="vehicles" name="Kleinwagen" fallback={icon} />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.textContent).not.toContain('passwd');
  });
});
