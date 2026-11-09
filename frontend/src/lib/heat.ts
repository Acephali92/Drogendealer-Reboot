/** Fahndungsstufe 0–3 aus Heat 0–100 (Texte: i18n `heat.*`). */
export function heatLevel(h: number) {
  return h >= 75 ? 3 : h >= 50 ? 2 : h >= 25 ? 1 : 0;
}
