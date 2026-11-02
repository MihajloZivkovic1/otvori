import { Fragment, type ReactNode } from 'react';

/** `https://…`, `http://…` or `www.…` up to whitespace; trailing punctuation stays outside the link. */
const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<>()]*[^\s<>().,;:!?'"])/gi;

interface Props {
  text: string;
  /** Turn web addresses into links (default). Off inside a `<button>`, where nested links are invalid. */
  links?: boolean;
  as?: 'p' | 'span';
  className?: string;
}

function linkify(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    const raw = match[0];
    if (start > last) nodes.push(text.slice(last, start));
    const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    nodes.push(
      <a key={start} href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-current/50 underline-offset-2">
        {raw}
      </a>,
    );
    last = start + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Free text the venue typed in the CMS (item descriptions, promotion bodies): line breaks are kept and web addresses
 * become links that open in a new tab. Never HTML — the text is rendered as text nodes.
 */
export function RichText({ text, links = true, as: Tag = 'p', className }: Props) {
  const lines = text.split(/\r?\n/);
  return (
    <Tag className={className ? `whitespace-pre-line ${className}` : 'whitespace-pre-line'}>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? '\n' : null}
          {links ? linkify(line) : line}
        </Fragment>
      ))}
    </Tag>
  );
}
