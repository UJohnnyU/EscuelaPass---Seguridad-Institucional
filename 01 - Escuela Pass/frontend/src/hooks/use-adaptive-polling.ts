import { useCallback, useEffect, useRef, useState } from 'react';

type UseAdaptivePollingOptions = {
  enabled: boolean;
  intervalFocused: number;
  intervalBlurred: number;
  onPoll: (args: { signal: AbortSignal }) => Promise<void> | void;
};

export function useAdaptivePolling({
  enabled,
  intervalFocused,
  intervalBlurred,
  onPoll
}: UseAdaptivePollingOptions) {
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const onPollRef = useRef(onPoll);

  useEffect(() => {
    onPollRef.current = onPoll;
  }, [onPoll]);

  const cancel = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    setRefreshing(false);
  }, []);

  const pollNow = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRefreshing(true);
    try {
      await onPollRef.current({ signal: controller.signal });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'CanceledError') {
        if (controller.signal.aborted) return;
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      cancel();
      return;
    }

    let disposed = false;
    const schedule = () => {
      if (disposed) return;
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      const delay = isHidden ? intervalBlurred : intervalFocused;
      timerRef.current = window.setTimeout(async () => {
        await pollNow();
        schedule();
      }, Math.max(1000, delay));
    };

    const onVisibilityChange = () => {
      if (disposed) return;
      if (document.visibilityState === 'visible') {
        void pollNow();
      }
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
      }
      schedule();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    schedule();

    return () => {
      disposed = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      cancel();
    };
  }, [cancel, enabled, intervalBlurred, intervalFocused, pollNow]);

  return { refreshing, cancel, pollNow };
}
