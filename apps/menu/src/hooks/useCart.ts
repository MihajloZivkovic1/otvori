import { useCallback, useState } from 'react';
import { addLine, readCart, setLineQuantity, writeCart, type AddInput, type CartLine } from '../lib/cart';

/** The guest's cart for this tenant, persisted in sessionStorage on every change. */
export function useCart(tenantKey: string) {
  const [lines, setLines] = useState<CartLine[]>(() => readCart(tenantKey));

  const commit = useCallback(
    (next: CartLine[]) => {
      writeCart(tenantKey, next);
      setLines(next);
    },
    [tenantKey],
  );

  /** Returns false when the cart is full. */
  const add = useCallback(
    (input: AddInput): boolean => {
      const next = addLine(readCart(tenantKey), input);
      if (!next) return false;
      commit(next);
      return true;
    },
    [commit, tenantKey],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) => commit(setLineQuantity(readCart(tenantKey), key, quantity)),
    [commit, tenantKey],
  );

  const replace = useCallback((next: CartLine[]) => commit(next), [commit]);
  const clear = useCallback(() => commit([]), [commit]);

  return { lines, add, setQuantity, replace, clear };
}
