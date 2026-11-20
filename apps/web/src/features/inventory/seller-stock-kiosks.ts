// The seller API returns newest first. Connectivity must not select an older kiosk.
export function stockKioskOptions<T extends { id: string; status: string }>(kiosks: T[]): T[] {
  return kiosks.filter((kiosk) => kiosk.status !== 'DISABLED');
}

export function selectedStockKiosk<T extends { id: string }>(
  kiosks: T[],
  choice: string,
): T | undefined {
  return kiosks.find((kiosk) => kiosk.id === choice) ?? kiosks[0];
}
