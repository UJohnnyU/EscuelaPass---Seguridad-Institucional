/**
 * Capa decorativa de burbujas muy suaves (inspiración tipo particle/bubble, sin dependencias).
 * Debe ir detrás del contenido con opacidad baja para no competir con el formulario.
 */
const BUBBLES: { size: number; left: string; top: string; delay: number; duration: number; blur: number }[] = [
  { size: 100, left: '8%', top: '72%', delay: 0, duration: 26, blur: 40 },
  { size: 140, left: '78%', top: '8%', delay: 2, duration: 22, blur: 50 },
  { size: 70, left: '65%', top: '45%', delay: 1, duration: 18, blur: 35 },
  { size: 90, left: '20%', top: '15%', delay: 4, duration: 24, blur: 38 },
  { size: 55, left: '45%', top: '60%', delay: 0.5, duration: 20, blur: 28 },
  { size: 120, left: '88%', top: '55%', delay: 3, duration: 28, blur: 45 },
  { size: 65, left: '5%', top: '40%', delay: 5, duration: 21, blur: 32 },
  { size: 85, left: '52%', top: '22%', delay: 1.5, duration: 23, blur: 36 },
  { size: 95, left: '30%', top: '80%', delay: 2.5, duration: 25, blur: 42 },
  { size: 50, left: '92%', top: '30%', delay: 6, duration: 19, blur: 25 },
  { size: 110, left: '38%', top: '5%', delay: 3.5, duration: 27, blur: 48 },
  { size: 75, left: '12%', top: '88%', delay: 4.5, duration: 22, blur: 34 },
  { size: 60, left: '70%', top: '78%', delay: 1, duration: 17, blur: 30 },
  { size: 80, left: '58%', top: '12%', delay: 7, duration: 24, blur: 38 },
  { size: 72, left: '25%', top: '50%', delay: 2, duration: 20, blur: 33 },
  { size: 88, left: '82%', top: '70%', delay: 5.5, duration: 26, blur: 40 }
];

export function BubbleField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {BUBBLES.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full will-change-transform"
          style={{
            width: b.size,
            height: b.size,
            left: b.left,
            top: b.top,
            animation: `bubbleDrift ${b.duration}s ease-in-out infinite`,
            animationDelay: `${b.delay}s`,
            filter: `blur(${b.blur}px)`,
            background:
              'radial-gradient(circle at 30% 30%, rgba(147, 197, 253, 0.14), rgba(37, 99, 235, 0.06) 45%, transparent 70%)',
            opacity: 0.85
          }}
        />
      ))}
    </div>
  );
}
