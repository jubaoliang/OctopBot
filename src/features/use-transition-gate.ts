import { useCallback, useEffect, useRef } from 'react';

import { HAS_STACK_TRANSITION_EVENTS } from '@/platform/stack-transition';

/**
 * expo-router's untyped useNavigation() does not expose the native stack's
 * transition events; this is the minimal shape the gate depends on. The
 * runtime object is the real stack navigation for the screen. `isFocused`
 * rides along because callers gate background work on focus too.
 */
export type TransitionAwareNavigation = {
  addListener: (event: 'transitionStart' | 'transitionEnd', callback: () => void) => () => void;
  isFocused: () => boolean;
};

/**
 * Upper bound for waiting out a push transition before heavy work starts.
 * Platform pushes run ~300–350ms; 600ms covers a frame-dropped push on a slow
 * device while keeping the tax on mounts that emit no transition events at
 * all (deep-link cold start, notification tap) under a perceptible stall.
 */
const TRANSITION_WAIT_TIMEOUT_MS = 600;

/**
 * Gate for mount-time work that would jank a screen transition. The first
 * frames of a push are spent rendering the incoming screen; a fetch whose
 * reply lands mid-animation (self-hosted servers answer in milliseconds)
 * turns the push into a stutter. Callers render their loading state during
 * the transition and start real work once `waitSettled()` resolves.
 *
 * The wait is bounded so a missed or interrupted transitionEnd (deep link
 * with no transition, back-swipe cancelled mid-push) can never strand the
 * caller: a timed-out wait releases the gate and clears the flag, so later
 * calls on the same screen are not taxed with the same stall.
 *
 * Same idiom as the thread screen's history replay — one hook so every
 * pushed screen defers its mount work identically.
 */
export function useTransitionGate(navigation: TransitionAwareNavigation) {
  const inFlightRef = useRef(false);
  const waitersRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    const releaseAll = () => {
      inFlightRef.current = false;
      const waiters = waitersRef.current;
      waitersRef.current = [];
      waiters.forEach(waiter => {
        waiter();
      });
    };
    // Armed before any listener: the push's transitionStart can beat this
    // passive effect on a fast mount, and a missed start would make the
    // gate silently skip (mid-push work). A mount with no transition at
    // all (deep link) simply rides the bounded timeout instead. Web emits
    // no transition events, so arming there would stall every open.
    if (HAS_STACK_TRANSITION_EVENTS) {
      inFlightRef.current = true;
    }
    const startSub = navigation.addListener('transitionStart', () => {
      inFlightRef.current = true;
    });
    const endSub = navigation.addListener('transitionEnd', releaseAll);
    return () => {
      startSub();
      endSub();
      // Release any pending wait so it cannot outlive this screen, and
      // clear the flag so a re-subscription never inherits a stale true.
      releaseAll();
    };
  }, [navigation]);

  const waitSettled = useCallback((): Promise<void> => {
    if (!inFlightRef.current) {
      return Promise.resolve();
    }
    return new Promise<void>(resolve => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      const waiter = () => {
        if (timer !== null) {
          clearTimeout(timer);
        }
        waitersRef.current = waitersRef.current.filter(w => w !== waiter);
        resolve();
      };
      // The timeout is a one-shot gate release: after it fires the
      // transition can no longer be relied on, so the flag clears too.
      timer = setTimeout(() => {
        inFlightRef.current = false;
        waiter();
      }, TRANSITION_WAIT_TIMEOUT_MS);
      waitersRef.current.push(waiter);
    });
  }, []);

  return { waitSettled };
}

/**
 * The shared gated-mount policy: run `load` once the push transition
 * settles, skip while `enabled` is false, and drop the reply if the screen
 * left (or the query changed) before the gate released. `load` is expected
 * to be a useCallback whose own deps carry the screen's query keys — its
 * identity change is what re-runs the effect, so no deps pass-through (and
 * no lint suppression) is needed here. `load` receives an isCancelled
 * checker for mid-flight work and must own its error state; the catch below
 * only keeps a future caller's slip from becoming an unhandled rejection.
 */
export function useGatedLoad(
  waitSettled: () => Promise<void>,
  enabled: boolean,
  load: (isCancelled: () => boolean) => void | Promise<void>,
): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    void (async () => {
      await waitSettled();
      if (!cancelled) {
        await Promise.resolve(load(() => cancelled)).catch(() => undefined);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, waitSettled, load]);
}
