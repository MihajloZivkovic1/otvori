/** Mobile navigation disclosure: `[data-nav-toggle]` (aria-expanded + aria-controls) opens the panel it controls. */
export function initNav(root: ParentNode): void {
  const toggle = root.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  const panel = toggle ? root.querySelector<HTMLElement>(`#${toggle.getAttribute('aria-controls')}`) : null;
  if (!toggle || !panel) return;

  const set = (open: boolean) => {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    toggle.querySelector('.nav-open-icon')?.classList.toggle('hidden', open);
    toggle.querySelector('.nav-close-icon')?.classList.toggle('hidden', !open);
  };

  toggle.addEventListener('click', () => set(panel.hidden === true));
  panel.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('a')) set(false);
  });
  root.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape' && !panel.hidden) {
      set(false);
      toggle.focus();
    }
  });
}
