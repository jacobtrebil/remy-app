import type { Severity } from '@/lib/types';

/** Colors are shared by the badge, the card border and the status dot. */
export const SeverityStyle: Record<Severity, { label: string; color: string; tint: string }> = {
  critical: { label: 'CRITICAL', color: '#D93025', tint: 'rgba(217, 48, 37, 0.12)' },
  warning: { label: 'WARNING', color: '#E8890C', tint: 'rgba(232, 137, 12, 0.12)' },
  info: { label: 'INFO', color: '#3C87F7', tint: 'rgba(60, 135, 247, 0.12)' },
};

export function severityStyle(severity: Severity) {
  return SeverityStyle[severity] ?? SeverityStyle.info;
}
