import { EventEmitter } from 'node:events';
import type { OrderingEvent } from '@qr-menu/shared';

/**
 * In-process fan-out of ordering events to the SSE streams of one restaurant (events.ts → sse.ts).
 *
 * Single API instance for now. With several instances every publish would also go to Redis pub/sub
 * (channel per restaurant) and each instance would forward what it receives to its own streams; the interface
 * below stays the same, only `publish()` grows a Redis PUBLISH and a subscriber feeds `emitter`.
 */
class OrderingBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  publish(restaurantId: string, event: OrderingEvent): void {
    this.emitter.emit(restaurantId, event);
  }

  subscribe(restaurantId: string, listener: (event: OrderingEvent) => void): () => void {
    this.emitter.on(restaurantId, listener);
    return () => this.emitter.off(restaurantId, listener);
  }

  /** Open streams for a restaurant (tests, diagnostics). */
  subscribers(restaurantId: string): number {
    return this.emitter.listenerCount(restaurantId);
  }
}

export const orderingBus = new OrderingBus();
