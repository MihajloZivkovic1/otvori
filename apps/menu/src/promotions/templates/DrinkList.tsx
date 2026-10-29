import type { TemplateProps } from '../types';
import { itemById } from '../types';
import { HighballIcon, MargaritaIcon, SpritzIcon } from './DrinkIcons';

/**
 * Template 1 — the printed cocktail card (design/cocktail-menu.pdf): vertical title on the left, three line-art
 * drinks, a thin rounded panel with the entries in one or two columns (left column left-aligned, right column
 * right-aligned), the venue's logo text in the logo spot.
 */
export function DrinkList({ promotion, copy }: TemplateProps<'drink_list'>) {
  const { content } = promotion;
  const two = content.columns === 2 && content.entries.length > 1;
  const split = two ? Math.ceil(content.entries.length / 2) : content.entries.length;
  const columns = two ? [content.entries.slice(0, split), content.entries.slice(split)] : [content.entries];
  const logo = content.logoText?.trim() || '';

  return (
    <article className="promo promo-drinks" aria-label={promotion.title}>
      <div className="promo-dl-side">
        {logo ? <div className={`promo-dl-logo${logo.length <= 3 ? ' is-mark' : ''}`}>{logo}</div> : <div />}
        <h2 className="promo-dl-title" style={{ margin: 0 }}>
          <span>{promotion.title}</span>
        </h2>
      </div>
      <div className="promo-dl-icons">
        <MargaritaIcon />
        <SpritzIcon />
        <HighballIcon />
      </div>
      <div className="promo-dl-panel">
        <div className={`promo-dl-columns${two ? ' is-two' : ''}`}>
          {columns.map((entries, column) => (
            <ul key={column} className={`promo-dl-col${two && column === 1 ? ' is-right' : ''}`}>
              {entries.map((entry, index) => {
                const item = itemById(promotion, entry.menuItemId);
                const unavailable = item ? !item.isAvailable : false;
                return (
                  <li key={`${entry.name}-${index}`} className={`promo-dl-entry${unavailable ? ' is-unavailable' : ''}`}>
                    <span className="promo-dl-name">{entry.name}</span>
                    {entry.lines.length > 0 && (
                      <ul className="promo-dl-lines">
                        {entry.lines.map((line, lineIndex) => (
                          <li key={lineIndex} className="promo-dl-line">
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                    {unavailable && (
                      <span className="promo-dl-line" style={{ fontStyle: 'italic' }}>
                        {copy.unavailable}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
        {content.subtitle ? <p className="promo-dl-foot">{content.subtitle}</p> : null}
      </div>
    </article>
  );
}
