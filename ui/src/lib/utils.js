import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with clsx and merges Tailwind classes with tailwind-merge.
 * Used across shadcn and modernized design system primitives.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
