/**
 * Accordion with one item open at a time (the first is open on load).
 * Each trigger is `button[aria-expanded][aria-controls]`; the panel toggles the `hidden` attribute.
 */
export function initFaq(root: ParentNode): void {
  const container = root.querySelector('[data-faq]');
  if (!container) return;
  const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>('button[aria-controls]'));

  const setOpen = (button: HTMLButtonElement, open: boolean) => {
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
    const panel = root.querySelector<HTMLElement>(`#${button.getAttribute('aria-controls')}`);
    if (panel) panel.hidden = !open;
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      buttons.forEach((other) => setOpen(other, other === button && !open));
    });
    button.addEventListener('keydown', (event) => {
      const index = buttons.indexOf(button);
      const next =
        event.key === 'ArrowDown'
          ? index + 1
          : event.key === 'ArrowUp'
            ? index - 1
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : -1;
      if (next >= 0 && next < buttons.length) {
        event.preventDefault();
        buttons[next]?.focus();
      }
    });
  });
}
