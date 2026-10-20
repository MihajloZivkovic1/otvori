import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { eventBodies, mockFetch, renderMenu, serveFixtures } from './helpers';

const scans = (spy: ReturnType<typeof mockFetch>) => eventBodies(spy).filter((body) => body.type === 'scan');

describe('table number from the QR code', () => {
  it('reads /t/<number> on the host-based form (no slug in the path)', async () => {
    const fetchSpy = mockFetch(serveFixtures);
    renderMenu('/t/12');
    await screen.findByText('2 stavke');
    await waitFor(() => expect(scans(fetchSpy)).toEqual([expect.objectContaining({ type: 'scan', tableNumber: 12 })]));
    const stored = Object.keys(sessionStorage).find((key) => key.startsWith('tabla.table.'));
    expect(stored && sessionStorage.getItem(stored)).toBe('12');
  });

  it('still accepts the older ?t= query', async () => {
    const fetchSpy = mockFetch(serveFixtures);
    renderMenu('/r/kafeterija?t=12');
    await screen.findByText('2 stavke');
    await waitFor(() => expect(scans(fetchSpy)).toEqual([expect.objectContaining({ type: 'scan', tableNumber: 12 })]));
    expect(sessionStorage.getItem('tabla.table.kafeterija')).toBe('12');
  });

  it('ignores a malformed table segment and still shows the menu', async () => {
    const fetchSpy = mockFetch(serveFixtures);
    renderMenu('/r/kafeterija/t/abc');
    await screen.findByText('2 stavke');
    await waitFor(() => expect(scans(fetchSpy)).toHaveLength(1));
    expect(scans(fetchSpy)[0]).not.toHaveProperty('tableNumber');
    expect(sessionStorage.getItem('tabla.table.kafeterija')).toBeNull();
  });
});
