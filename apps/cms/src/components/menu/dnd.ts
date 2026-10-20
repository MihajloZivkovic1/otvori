import { KeyboardSensor, PointerSensor, useSensor, useSensors, type Modifier } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

/** Lists only move vertically. */
export const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

export function useListSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}
