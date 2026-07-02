import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const clippings = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/clippings' }),
  schema: z.object({
    title: z.string(),
    team: z.string().optional(),
    place: z.string(),
    year: z.number().int(),
    newspaper: z.string(),
    source: z.string(),
    image: z.string(),
    alt: z.string(),
    tags: z.array(z.string()),
    blurb: z.string().optional(),
  }),
});

export const collections = { clippings };
