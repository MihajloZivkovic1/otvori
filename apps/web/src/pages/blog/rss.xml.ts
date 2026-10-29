import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { postPath, publishedPosts } from '../../blog';
import { t } from '../../i18n';

export async function GET(context: APIContext) {
  const dict = t('sr');
  const posts = publishedPosts(await getCollection('blog'));
  return rss({
    title: `otvori — ${dict.blog.eyebrow}`,
    description: dict.blog.description,
    site: context.site ?? 'https://otvori.menu',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postPath(post.data.slug),
      categories: [dict.blog.categories[post.data.category]],
    })),
    customData: '<language>sr-Latn</language>',
  });
}
