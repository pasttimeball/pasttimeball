import rss from '@astrojs/rss';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { allClippings } from '../lib/clippings';

const publicDir = fileURLToPath(new URL('../../public', import.meta.url));

function imageBytes(imagePath) {
  try {
    return statSync(publicDir + imagePath).size;
  } catch {
    return 0;
  }
}

export async function GET(context) {
  const clippings = await allClippings();
  return rss({
    title: 'Past Time Ball',
    description:
      'Scanned newspaper clippings of old baseball and softball stories, ads and teams, with a soft spot for great historical team names.',
    site: context.site,
    items: clippings.map((c) => {
      const description =
        c.data.blurb ??
        (c.data.team
          ? `The ${c.data.team} of ${c.data.place}, as reported by the ${c.data.newspaper} in ${c.data.year}.`
          : `From the pages of the ${c.data.newspaper}, ${c.data.place}, ${c.data.year}.`);
      const imageUrl = new URL(c.data.image, context.site).href;
      return {
        title: c.data.title,
        description,
        link: `/clippings/${c.id}/`,
        categories: c.data.tags,
        pubDate: c.data.posted,
        enclosure: {
          url: imageUrl,
          length: imageBytes(c.data.image),
          type: 'image/jpeg',
        },
        content: `<p><img src="${imageUrl}" alt="${(c.data.alt ?? '').replace(/"/g, '&quot;')}" /></p><p>${description}</p>`,
      };
    }),
  });
}
