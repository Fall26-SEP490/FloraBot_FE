export type KioskOption = { id: string; name?: string | null; code?: string | null };

export function kioskOptions(items: KioskOption[]) {
  const unique = new Map<string, { id: string; label: string }>();
  for (const item of items) {
    if (!item.id) continue;
    const label =
      [item.code, item.name !== item.code ? item.name : null].filter(Boolean).join(' · ') ||
      item.id;
    unique.set(item.id, { id: item.id, label });
  }
  return [...unique.values()].sort((a, b) =>
    a.label.localeCompare(b.label, 'vi', { numeric: true }),
  );
}

export function matchesKiosk(id: string | null | undefined, selected: string) {
  return !selected || id === selected;
}
