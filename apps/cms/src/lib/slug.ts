const MAP: Record<string, string> = { š: 's', đ: 'dj', č: 'c', ć: 'c', ž: 'z', ß: 'ss', æ: 'ae', ø: 'o', ł: 'l' };
const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', ђ: 'dj', е: 'e', ж: 'z', з: 'z', и: 'i', ј: 'j', к: 'k', л: 'l', љ: 'lj', м: 'm', н: 'n',
  њ: 'nj', о: 'o', п: 'p', р: 'r', с: 's', т: 't', ћ: 'c', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'c', џ: 'dz', ш: 's',
};

/** The same slug the API derives from a name (lowercase ASCII, hyphens), for the wizard's live suggestion. */
export function slugify(input: string, maxLength = 40): string {
  let out = '';
  for (const ch of input.toLowerCase()) out += CYRILLIC[ch] ?? MAP[ch] ?? ch;
  out = out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return out;
}
