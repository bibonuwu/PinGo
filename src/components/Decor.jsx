import { useMemo } from 'react';
import { motion } from 'framer-motion';

// Декоративные фигуры с экрана приветствия (по макету): смайлик, тёмные «листья», сердечко.
export function Smiley({ size = 220, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="100" fill="#FFE100" />
      <path d="M48 76 Q60 92 72 76" stroke="#141414" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M108 76 Q120 92 132 76" stroke="#141414" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M58 116 Q88 156 118 116" stroke="#141414" strokeWidth="7" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Blob({ size = 200, className, color = '#282828' }) {
  return (
    <svg className={className} width={size} height={size * 1.25} viewBox="0 0 160 200" aria-hidden="true">
      <path d="M40 6 C96 -6 152 40 158 104 C164 160 132 196 92 194 C44 192 6 150 2 96 C-2 52 8 14 40 6 Z" fill={color} />
    </svg>
  );
}

export function Heart({ size = 150, className }) {
  return (
    <svg className={className} width={size} height={size * 0.9} viewBox="0 0 200 180" aria-hidden="true">
      <path
        d="M100 172 C40 132 4 100 4 58 C4 26 28 4 58 4 C78 4 92 16 100 30 C108 16 122 4 142 4 C172 4 196 26 196 58 C196 100 160 132 100 172 Z"
        fill="#FFB3C8"
      />
      <ellipse cx="62" cy="86" rx="12" ry="8" fill="#FF7A9E" opacity="0.7" />
      <rect x="84" y="56" width="8" height="22" rx="4" fill="#141414" />
      <rect x="128" y="56" width="8" height="22" rx="4" fill="#141414" />
      <path d="M86 96 Q110 124 134 96" stroke="#141414" strokeWidth="7" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// Праздничный «салют» при завершении профиля ребёнка.
const COLORS = ['#F4C600', '#FFAF04', '#8B5CF6', '#3B82F6', '#22C55E', '#FFB3C8', '#141414'];

export function Confetti({ count = 26 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const dist = 120 + Math.random() * 140;
        return {
          id: i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 60,
          rotate: Math.random() * 540 - 270,
          color: COLORS[i % COLORS.length],
          size: 8 + Math.random() * 8,
          round: i % 3 === 0,
          delay: Math.random() * 0.15,
        };
      }),
    [count],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="confetti__piece"
          style={{
            background: p.color,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            borderRadius: p.round ? '50%' : 3,
          }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0.4 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 160], opacity: [1, 1, 0], rotate: p.rotate, scale: 1 }}
          transition={{ duration: 1.6, delay: p.delay, ease: 'easeOut', times: [0, 0.45, 1] }}
        />
      ))}
    </div>
  );
}
