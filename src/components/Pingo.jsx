import { AnimatePresence, motion } from 'framer-motion';
import { cx } from '../lib/utils';

const INK = '#2E2E30';
const EYE = '#2B1714';

function Eye({ x, closed }) {
  if (closed) {
    return <path d={`M${x - 10} 96 Q${x} 83 ${x + 10} 96`} stroke={EYE} strokeWidth="5" strokeLinecap="round" fill="none" />;
  }
  return (
    <g>
      <ellipse cx={x} cy="93" rx="8.5" ry="10" fill={EYE} />
      <circle cx={x + 3} cy="89" r="3" fill="#fff" />
    </g>
  );
}

/**
 * Пингвин Pingo — талисман и гид. Анимации на CSS, поэтому настройка «Меньше анимаций» их отключает.
 * mood: 'open' | 'happy' | 'wink'; outfit: 'none' | 'glasses' | 'scarf'.
 */
export function Pingo({ size = 96, mood = 'open', outfit = 'none', wave = false, animated = true, className, title }) {
  const leftClosed = mood === 'happy';
  const rightClosed = mood === 'happy' || mood === 'wink';
  return (
    <svg
      className={cx('pingo', animated && 'pingo--animated', wave && 'pingo--wave', className)}
      width={size}
      height={size * 1.1}
      viewBox="0 0 200 220"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <ellipse className="pingo__shadow" cx="100" cy="213" rx="50" ry="5.5" fill="#000" opacity="0.12" />
      <g className="pingo__body">
        <ellipse cx="80" cy="205" rx="17" ry="8.5" fill="#F0883E" />
        <ellipse cx="120" cy="205" rx="17" ry="8.5" fill="#F0883E" />
        <ellipse cx="100" cy="158" rx="58" ry="49" fill={INK} />
        <ellipse cx="100" cy="171" rx="42" ry="33" fill="#fff" />
        <path d="M46 150 C30 160 24 182 32 196 C42 190 52 174 54 160 Z" fill={INK} />
        <path className="pingo__flipper-r" d="M154 150 C170 160 176 182 168 196 C158 190 148 174 146 160 Z" fill={INK} />
        {outfit === 'scarf' && (
          <g>
            <path d="M44 140 Q100 168 156 140 L158 154 Q100 182 42 154 Z" fill="#F4C600" />
            <path d="M126 156 L140 190 L124 193 L115 161 Z" fill="#E0B400" />
          </g>
        )}
        <ellipse cx="100" cy="86" rx="80" ry="68" fill={INK} />
        <path
          d="M100 52 C112 36 150 30 166 56 C180 80 172 118 150 134 C134 146 116 150 100 150 C84 150 66 146 50 134 C28 118 20 80 34 56 C50 30 88 36 100 52 Z"
          fill="#fff"
        />
        <ellipse cx="56" cy="114" rx="9" ry="5.5" fill="#FF9EB5" opacity="0.6" />
        <ellipse cx="144" cy="114" rx="9" ry="5.5" fill="#FF9EB5" opacity="0.6" />
        <g className="pingo__eyes">
          <Eye x={72} closed={leftClosed} />
          <Eye x={128} closed={rightClosed} />
        </g>
        {outfit === 'glasses' && (
          <g fill="none" stroke="#141414" strokeWidth="4.5">
            <circle cx="72" cy="93" r="17" fill="rgba(255,255,255,0.15)" />
            <circle cx="128" cy="93" r="17" fill="rgba(255,255,255,0.15)" />
            <path d="M89 92 Q100 85 111 92" strokeLinecap="round" />
          </g>
        )}
        <path d="M86 110 Q100 99 114 110 Q107 123 100 124 Q93 123 86 110 Z" fill="#F07C3A" />
        <path d="M89 114 Q100 120 111 114 Q106 123 100 124 Q94 123 89 114 Z" fill="#D9622B" />
      </g>
    </svg>
  );
}

// Pingo с репликой — гид по шагам и подсказки в пустых состояниях.
export function PingoGuide({ children, mood = 'open', wave = false, size = 84, outfit, bubbleKey, className }) {
  return (
    <div className={cx('guide', className)}>
      <Pingo size={size} mood={mood} wave={wave} outfit={outfit} className="guide__pingo" />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={bubbleKey}
          className="guide__bubble"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
