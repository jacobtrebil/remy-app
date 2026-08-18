import type { RemyEvent, Severity } from '@/lib/types';

export const SeverityStyle: Record<Severity, { label: string; color: string; tint: string }> = {
  critical: { label: 'SAFETY', color: '#D93025', tint: 'rgba(217, 48, 37, 0.12)' },
  warning: { label: 'REVIEW', color: '#E8890C', tint: 'rgba(232, 137, 12, 0.12)' },
  info: { label: 'ACTIVITY', color: '#435999', tint: 'rgba(67, 89, 153, 0.12)' },
};

/**
 * Categories the pipeline uses for events that imply immediate physical risk.
 * Everything else flagged for review is a warning; unflagged events are activity.
 */
const CRITICAL_CATEGORIES = new Set([
  'stove_safety',
  'night_exit',
  'wandering',
  'fall',
  'fire',
  'smoke',
]);

export function severityOf(event: RemyEvent): Severity {
  if (CRITICAL_CATEGORIES.has(event.remy_category)) return 'critical';
  return event.needs_review ? 'warning' : 'info';
}

export function severityStyle(severity: Severity) {
  return SeverityStyle[severity];
}

/** "Stove Safety" from "stove_safety" — categories are snake_case slugs. */
export function humanizeCategory(category: string): string {
  return category
    .split('_')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
}
