/* eslint-disable react-refresh/only-export-components */
/** Skeletons de altura fija para evitar CLS (Cumulative Layout Shift). */

function Row({ height = 56 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-lg bg-slate-200/60"
      style={{ height }}
      role="presentation"
      aria-hidden="true"
    />
  );
}

function Card({ height = 200 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-xl bg-slate-100"
      style={{ height }}
      role="presentation"
      aria-hidden="true"
    />
  );
}

function Avatar({ size = 48 }: { size?: number }) {
  return (
    <div
      className="animate-pulse shrink-0 rounded-full bg-slate-200/60"
      style={{ width: size, height: size }}
      role="presentation"
      aria-hidden="true"
    />
  );
}

function Text({ width = '60%', height = 16 }: { width?: string | number; height?: number }) {
  return (
    <div
      className="animate-pulse rounded bg-slate-200/60"
      style={{ width, height }}
      role="presentation"
      aria-hidden="true"
    />
  );
}

export const Skeleton = { Row, Card, Avatar, Text };
