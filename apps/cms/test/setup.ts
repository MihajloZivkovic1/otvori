import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { tokenStore } from '../src/lib/api';
import { setViewport } from './helpers';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  tokenStore.set(null);
  setViewport('desktop');
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn() as typeof window.scrollTo;
  document.documentElement.removeAttribute('style');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
