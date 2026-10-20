const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z', и: 'i', ј: 'j', к: 'k',
  л: 'l', љ: 'lj', м: 'm', н: 'n', њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'c', у: 'u',
  ф: 'f', х: 'h', ц: 'c', ч: 'c', џ: 'dz', ш: 's',
};

const SPECIAL: Record<string, string> = { đ: 'dj', ß: 'ss', æ: 'ae', ø: 'o', ł: 'l' };

/** Turn a restaurant name into a DNS-safe label: lowercase ASCII letters, digits and hyphens. */
export function slugify(input: string, maxLength = 40): string {
  const lower = input.toLowerCase();
  let out = '';
  for (const ch of lower) {
    out += CYRILLIC_TO_LATIN[ch] ?? SPECIAL[ch] ?? ch;
  }
  out = out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  if (out.length < 3) out = out ? `${out}-menu` : 'restaurant';
  return out;
}
