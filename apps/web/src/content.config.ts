import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';
import { BLOG_CATEGORIES } from './blog';

/**
 * Blog posts: `content/blog/*.md` (Serbian, latin). The frontmatter `slug` is the URL (`/blog/<slug>/`); `keyword`
 * is the search query the post targets, `faq` renders as the accordion at the end of the post and as FAQPage JSON-LD.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/blog' }),
  schema: z.object({
    title: z.string().min(10),
    description: z.string().min(50).max(200),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug: lowercase words separated by dashes'),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    keyword: z.string().min(3),
    category: z.enum(BLOG_CATEGORIES),
    faq: z
      .array(z.object({ q: z.string().min(5), a: z.string().min(20) }))
      .min(1)
      .max(8),
  }),
});

export const collections = { blog };
