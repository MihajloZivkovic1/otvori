import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { api, bearer, createCategory, createItem, publish, registerUser } from './helpers.js';

async function photo(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 120, g: 60, b: 70 } } }).png().toBuffer();
}

describe('POST /items/:id/image', () => {
  async function setup() {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const category = await createCategory(owner, { name: { sr: 'Kafa' } });
    const item = await createItem(owner, { categoryId: category.id, name: { sr: 'Espreso' }, priceCents: 18000 });
    await publish(owner);
    const url = `/api/admin/restaurants/${owner.restaurantId}/items/${item.id}/image`;
    return { owner, item, url, slug: owner.memberships[0]!.restaurant.slug };
  }

  it('stores the 800×800 photo and a 160×160 row thumbnail, and serves both on the public menu', async () => {
    const { owner, url, slug } = await setup();
    const res = await api.post(url).set(bearer(owner.accessToken)).attach('image', await photo(1200, 900), 'photo.png');
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toMatch(/\.webp$/);
    expect(res.body.thumbnailUrl).toMatch(/-thumb\.webp$/);
    expect(res.body.thumbnailUrl).not.toBe(res.body.imageUrl);

    const file = (u: string) => path.join(env.UPLOADS_DIR, new URL(u).pathname.replace(/^\/uploads\//, ''));
    expect(existsSync(file(res.body.imageUrl))).toBe(true);
    const thumb = await sharp(file(res.body.thumbnailUrl)).metadata();
    expect([thumb.width, thumb.height]).toEqual([160, 160]);

    const menu = await api.get(`/api/public/${slug}/menu`);
    expect(menu.body.categories[0].items[0].thumbnailUrl).toBe(res.body.thumbnailUrl);
  });

  it('rejects SVG and images with too many pixels instead of decoding them', async () => {
    const { owner, url } = await setup();
    const svg = await api
      .post(url)
      .set(bearer(owner.accessToken))
      .attach('image', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'), { filename: 'x.svg', contentType: 'image/svg+xml' });
    expect(svg.status).toBe(415);

    // A 7000×7000 PNG of one colour compresses to a few KB but would decode to 49 MP (> the 40 MP guard).
    const bomb = await photo(7000, 7000);
    expect(bomb.byteLength).toBeLessThan(8 * 1024 * 1024);
    const res = await api.post(url).set(bearer(owner.accessToken)).attach('image', bomb, 'bomb.png');
    expect(res.status).toBe(415);
  });
});
