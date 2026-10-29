import type { PromotionTemplate } from '@qr-menu/shared';
import type { PromotionLike } from '@qr-menu/menu/promotions';

const sampleItems = [
  { id: 'sample-1', name: 'Flat white', description: 'Dupli espresso, mleko', priceCents: 28000, imageUrl: null, thumbnailUrl: null, isAvailable: true },
  { id: 'sample-2', name: 'Kroasan', description: 'Puter, lisnato testo', priceCents: 22000, imageUrl: null, thumbnailUrl: null, isAvailable: true },
];

/** Static content for the template picker previews (step 1). */
export const SAMPLES: Record<PromotionTemplate, PromotionLike> = {
  drink_list: {
    template: 'drink_list',
    title: 'Cocktail Menu',
    imageUrl: null,
    items: [],
    content: {
      logoText: 'Vaš lokal',
      columns: 2,
      entries: [
        { name: 'Negroni', lines: ['Gin', 'Campari', 'Vermut'] },
        { name: 'Hugo', lines: ['Penušavo vino', 'Sirup od zove'] },
        { name: 'Mohito', lines: ['Rum', 'Limeta', 'Nana'] },
        { name: 'Aperol Spritz', lines: ['Aperol', 'Penušavo vino'] },
      ],
    },
  },
  featured_items: {
    template: 'featured_items',
    title: 'Preporuka nedelje',
    imageUrl: null,
    items: sampleItems,
    content: { intro: 'Barista bira.', items: [{ menuItemId: 'sample-1', badge: 'Novo' }, { menuItemId: 'sample-2' }] },
  },
  deal: {
    template: 'deal',
    title: 'Happy hour',
    imageUrl: null,
    items: [sampleItems[0]!],
    content: { headline: '2 kafe za cenu 1', description: 'Radnim danima od 16 do 18h.', priceCents: 28000, oldPriceCents: 56000, menuItemId: 'sample-1' },
  },
  notice: {
    template: 'notice',
    title: 'Obaveštenje',
    imageUrl: null,
    items: [],
    content: { headline: 'Nova bašta je otvorena', body: 'Od subote sedite napolju — 20 mesta više, isti meni.' },
  },
};
