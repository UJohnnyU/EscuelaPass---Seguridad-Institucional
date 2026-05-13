const schedulerLocks = new Map<string, boolean>();

export async function withScheduledLock(
  name: string,
  fn: () => Promise<void>
): Promise<{ executed: boolean }> {
  if (schedulerLocks.get(name)) return { executed: false };
  schedulerLocks.set(name, true);
  try {
    await fn();
    return { executed: true };
  } finally {
    schedulerLocks.set(name, false);
  }
}
