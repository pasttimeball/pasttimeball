import { getCollection, type CollectionEntry } from 'astro:content';

export type Clipping = CollectionEntry<'clippings'>;

export async function allClippings(): Promise<Clipping[]> {
  const clippings = await getCollection('clippings');
  return clippings.sort(
    (a, b) =>
      b.data.year - a.data.year ||
      (a.data.team ?? a.data.title).localeCompare(b.data.team ?? b.data.title)
  );
}

export function decadeOf(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

export function stateOf(place: string): string {
  const parts = place.split(',');
  return (parts[parts.length - 1] ?? place).trim();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
