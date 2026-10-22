/** Route helpers: the slug prefix (/r/:slug) is only present in the dev / fallback form of the URLs. */

export function menuPath(pathSlug: string | undefined): string {
  return pathSlug ? `/r/${encodeURIComponent(pathSlug)}` : '/';
}

export function orderPath(pathSlug: string | undefined, orderId: string): string {
  return `${pathSlug ? `/r/${encodeURIComponent(pathSlug)}` : ''}/order/${encodeURIComponent(orderId)}`;
}
