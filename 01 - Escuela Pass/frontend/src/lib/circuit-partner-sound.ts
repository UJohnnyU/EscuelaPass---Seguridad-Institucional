/**
 * Aviso cuando la contraparte (padre ↔ plantel) actualiza el circuito mientras ambos siguen el detalle.
 * Diseño distinto a la campana de notificaciones (NotificationsBadge: dos tonos agudos breves en sine).
 * Aquí: triada mayor ascendente suave (triangle + low-pass), más cuerpo y duración ~0,85 s.
 */

export const CIRCUIT_FLOW_MUTE_STORAGE_KEY = 'ep-circuit-flow-muted';

export type CircuitPartnerSoundFields = {
  status: string;
  teacherSignal: string | null;
  parentReceiptConfirmedAt?: string | null;
  parentConfirmDeadlineAt?: string | null;
  arrivalSnapshotAt?: string | null;
};

export function circuitPartnerActivitySignature(r: CircuitPartnerSoundFields): string {
  return [
    r.status,
    r.teacherSignal ?? '',
    r.parentReceiptConfirmedAt ?? '',
    r.parentConfirmDeadlineAt ?? '',
    r.arrivalSnapshotAt ?? ''
  ].join('|');
}

const MIN_INTERVAL_MS = 550;

let lastPlayAt = 0;

export function playCircuitPartnerAlert(): void {
  if (typeof window === 'undefined') return;
  if (window.localStorage.getItem(CIRCUIT_FLOW_MUTE_STORAGE_KEY) === '1') return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  const now = Date.now();
  if (now - lastPlayAt < MIN_INTERVAL_MS) return;
  lastPlayAt = now;

  const AudioCtx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  void (async () => {
    try {
      const ctx = new AudioCtx();
      await ctx.resume().catch(() => undefined);
      const t0 = ctx.currentTime;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, t0);
      master.gain.exponentialRampToValueAtTime(0.42, t0 + 0.06);
      master.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.92);
      master.connect(ctx.destination);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2200, t0);
      lp.Q.setValueAtTime(0.7, t0);
      lp.connect(master);

      /** G4, C5, E5 — evita 880/1320 Hz de la campana de notificaciones */
      const freqs = [392.0, 523.25, 659.25];
      const step = 0.11;
      const noteDur = 0.38;

      freqs.forEach((freq, i) => {
        const start = t0 + i * step;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.88, start + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, start + noteDur);

        osc.connect(g);
        g.connect(lp);
        osc.start(start);
        osc.stop(start + noteDur + 0.02);
      });

      window.setTimeout(() => void ctx.close(), 1200);
    } catch {
      /* autoplay / permisos */
    }
  })();
}
