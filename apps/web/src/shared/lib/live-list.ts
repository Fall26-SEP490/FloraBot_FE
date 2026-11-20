/** Refresh visible read-only lists without reloading the page or posting actions. */
export function liveListOptions(active = true) {
  return {
    refetchInterval: active ? 30_000 : (false as const),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: active ? ('always' as const) : (false as const),
    refetchOnReconnect: active ? ('always' as const) : (false as const),
  };
}
