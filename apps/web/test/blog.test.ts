import { describe, expect, it } from 'vitest';
import {
  articleSchema,
  formatDate,
  isoDate,
  postPath,
  publishedPosts,
  readingMinutes,
  type PostMeta,
} from '../src/blog';

const post: PostMeta = {
  title: 'Kako napraviti QR meni za restoran',
  description: 'Vodič korak po korak.',
  slug: 'kako-napraviti-qr-meni-za-restoran',
  date: new Date('2026-10-29'),
  keyword: 'qr meni za restoran',
  category: 'smena',
  faq: [{ q: 'Pitanje?', a: 'Odgovor koji je dovoljno dugačak.' }],
};

describe('blog helpers', () => {
  it('formats dates in Serbian latin and ISO', () => {
    expect(formatDate(post.date)).toBe('29. oktobar 2026.');
    expect(isoDate(post.date)).toBe('2026-10-29');
  });

  it('builds the post URL under /blog/', () => {
    expect(postPath(post.slug)).toBe('/blog/kako-napraviti-qr-meni-za-restoran/');
  });

  it('estimates reading time from the body without the frontmatter', () => {
    const body = '---\ntitle: x\n---\n' + 'reč '.repeat(650);
    expect(readingMinutes(body)).toBe(3);
    expect(readingMinutes('kratko')).toBe(1);
  });

  it('lists published posts newest first and hides future ones', () => {
    const a = { data: { ...post, date: new Date('2026-10-01') } };
    const b = { data: { ...post, date: new Date('2026-10-20') } };
    const future = { data: { ...post, date: new Date('2027-01-01') } };
    expect(publishedPosts([a, future, b], new Date('2026-10-29')).map((p) => p.data.date)).toEqual([
      b.data.date,
      a.data.date,
    ]);
  });

  it('describes the article with dates, keyword and publisher', () => {
    const site = new URL('https://otvori.menu');
    const schema = articleSchema({
      post,
      url: 'https://otvori.menu/blog/x/',
      site,
      image: 'https://otvori.menu/og-blog.png',
    });
    expect(schema.datePublished).toBe('2026-10-29');
    expect(schema.dateModified).toBe('2026-10-29');
    expect(schema.keywords).toBe(post.keyword);
    expect(schema.publisher.logo.url).toBe('https://otvori.menu/icons/icon-512.png');
  });
});
