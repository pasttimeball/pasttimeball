import rss from '@astrojs/rss';
import { allClippings } from '../lib/clippings';

export async function GET(context) {
  const clippings = await allClippings();
  return rss({
    title: 'Past Time Ball',
    description:
      'Scanned newspaper clippings of old baseball and softball stories, ads and teams, with a soft spot for great historical team names.',
    site: context.site,
    items: clippings.map((c) => ({
      title: c.data.title,
      description:
        c.data.blurb ??
        (c.data.team
          ? `The ${c.data.team} of ${c.data.place}, as reported by the ${c.data.newspaper} in ${c.data.year}.`
          : `From the pages of the ${c.data.newspaper}, ${c.data.place}, ${c.data.year}.`),
      link: `/clippings/${c.id}/`,
      categories: c.data.tags,
      pubDate: c.data.posted,
    })),
  });
}
