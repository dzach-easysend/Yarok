/**
 * Translates a report status string into a Hebrew display label.
 */

const STATUS_LABELS: Record<string, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  cleaned: "נוקה",
  invalid: "לא תקין",
};

export const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
