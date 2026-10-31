import 'server-only';
import { parseLocations, type LocationsState } from './landing-data';

export async function loadLandingLocations(): Promise<LocationsState> {
  let initial: LocationsState;
  try {
    // Use the same configured upstream as /api; never forward the visitor's credentials.
    const origin = process.env.API_PROXY_TARGET;
    if (!origin) throw new Error('API_PROXY_TARGET is not configured');
    const response = await fetch(`${origin.replace(/\/$/, '')}/api/kiosk-locations`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error('Locations unavailable');
    initial = { items: parseLocations(await response.json()), error: false };
  } catch {
    initial = { items: [], error: true };
  }
  return initial;
}
