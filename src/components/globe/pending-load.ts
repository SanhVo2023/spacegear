/**
 * A scene's first load, started once per key and shared until a scene commits with it.
 *
 * React can throw a first render away and retry it before it commits (an update interrupts it), and
 * useState's initialiser runs again on every attempt: during a scroll on a phone that refetched the 1k
 * set five times for one canvas. `take` hands every attempt the key's pending load; `commit` (from the
 * committed scene's effect) hands it over, so a later mount starts its own. A failed load is dropped,
 * never reused, so a remount after a failure fetches again.
 */
export type PendingLoads<K, T> = {
  /** The key's pending load, or a new one from `start`. */
  take(key: K): Promise<T>;
  /** A scene committed with `load`: it owns it now. A stale `load` leaves a newer pending one alone. */
  commit(key: K, load: Promise<T>): void;
  /** Whether a load is waiting for a commit (for tests). */
  pending(key: K): boolean;
};

export function createPendingLoads<K, T>(start: (key: K) => Promise<T>): PendingLoads<K, T> {
  const loads = new Map<K, Promise<T>>();
  const drop = (key: K, load: Promise<T>) => {
    if (loads.get(key) === load) loads.delete(key);
  };
  return {
    take(key) {
      const pending = loads.get(key);
      if (pending) return pending;
      const load = start(key);
      loads.set(key, load);
      // A failed load surfaces through use() → the scene's error boundary; this also marks it handled.
      load.catch(() => drop(key, load));
      return load;
    },
    commit: drop,
    pending: (key) => loads.has(key),
  };
}
