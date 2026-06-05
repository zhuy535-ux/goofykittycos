import type { AvailabilityStatus } from '../types';

/**
 * Permissions matrix for the constraint engine.
 *
 * Red    → hard-locked. Cannot click. Tooltip: "Time is Non-negotiable."
 * Yellow → selectable WITH a coordination warning.
 * Green  → freely selectable.
 * undefined (free time / no event) → selectable.
 */
export interface SlotPermission {
  selectable: boolean;
  warning?: string;
  tooltip: string;
}

export function isSlotSelectable(status: AvailabilityStatus | undefined): SlotPermission {
  switch (status) {
    case 'red':
      return { selectable: false, tooltip: 'Time is Non-negotiable.' };
    case 'yellow':
      return {
        selectable: true,
        warning: 'This time is flexible but requires coordination.',
        tooltip: 'Flexible — confirmation required.',
      };
    case 'green':
      return { selectable: true, tooltip: 'Free — open for booking.' };
    default:
      return { selectable: true, tooltip: 'Free.' };
  }
}

/** Reduce a list of overlapping statuses to the most restrictive one. */
export function worstStatus(list: AvailabilityStatus[]): AvailabilityStatus | undefined {
  if (list.includes('red')) return 'red';
  if (list.includes('yellow')) return 'yellow';
  if (list.includes('green')) return 'green';
  return undefined;
}
