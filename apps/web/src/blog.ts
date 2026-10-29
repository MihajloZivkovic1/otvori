/** Blog helpers shared by the pages, the RSS feed and the tests. The posts live in `content/blog/*.md`. */
import { brand } from './config';

export const BLOG_CATEGORIES = ['smena', 'poslovanje', 'uporedbe'] as const;
export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export interface PostMeta {
  title: string;
  description: string;
  slug: string;
  date: Date;
  updated?: Date;
  keyword: string;
  category: BlogCategory;
  faq: { q: string; a: string }[];
}

export const BLOG_PATH = '/blog/';

export function postPath(slug: string): string {
  return `${BLOG_PATH}${slug}/`;
}

/** "29. oktobar 2026." — Serbian latin, long month. */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** ISO date (YYYY-MM-DD) for <time datetime> and JSON-LD. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole minutes at ~200 words a minute, never under 1. */
export function readingMinutes(markdown: string): number {
  const words = markdown
    .replace(/^---[\s\S]*?---/, '')
    .replace(/[#>*_`\[\]()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Newest first; a post dated in the future is left out of the list, the feed and the sitemap. */
export function publishedPosts<T extends { data: PostMeta }>(posts: T[], now = new Date()): T[] {
  return posts
    .filter((p) => p.data.date.getTime() <= now.getTime())
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function articleSchema(opts: { post: PostMeta; url: string; site: URL; image: string }) {
  const { post, url, site, image } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    keywords: post.keyword,
    articleSection: post.category,
    inLanguage: 'sr-Latn',
    datePublished: isoDate(post.date),
    dateModified: isoDate(post.updated ?? post.date),
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    image,
    author: { '@type': 'Organization', name: brand.name, url: site.href },
    publisher: {
      '@type': 'Organization',
      name: brand.name,
      url: site.href,
      logo: { '@type': 'ImageObject', url: new URL('/icons/icon-512.png', site).href },
    },
  };
}

export function breadcrumbSchema(site: URL, crumbs: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: new URL(c.path, site).href,
    })),
  };
}
