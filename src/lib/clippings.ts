import { getCollection, type CollectionEntry } from 'astro:content';

export type Clipping = CollectionEntry<'clippings'>;

export async function allClippings(): Promise<Clipping[]> {
  const clippings = await getCollection('clippings');
  const now = new Date();
  return clippings
    .filter((c) => !c.data.draft && c.data.posted <= now)
    .sort(
    (a, b) =>
      b.data.posted.valueOf() - a.data.posted.valueOf() ||
      (a.data.team ?? a.data.title).localeCompare(b.data.team ?? b.data.title)
  );
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
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
