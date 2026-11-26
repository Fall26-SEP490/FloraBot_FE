const windowMs = 30 * 24 * 60 * 60 * 1000;

export function validPickupTime(pickup: Date, now = Date.now()) {
  const delay = pickup.getTime() - now;
  return Number.isFinite(delay) && delay > 0 && delay <= windowMs;
}

export function pickupTimeAllowed(day: string, time: string, now = Date.now()) {
  return Boolean(day && time) && validPickupTime(new Date(`${day}T${time}:00+07:00`), now);
}
