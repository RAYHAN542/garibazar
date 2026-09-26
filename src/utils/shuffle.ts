/**
 * Fisher-Yates shuffle -- returns a new array with the items in random
 * order, leaving the original array untouched. Used to fairly rotate which
 * boosted/sponsored listings a visitor sees when there are far more boosted
 * posts than can reasonably be shown at once (see App.tsx's
 * filteredAdListings and the ad-interleaving logic in filteredListings).
 */
export function shuffleArray<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
