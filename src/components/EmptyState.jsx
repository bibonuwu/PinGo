import { motion } from 'framer-motion';
import { cx } from '../lib/utils';
import { Pingo } from './Pingo';

// Пустое состояние в стиле макетов: жёлтый круг с иконкой, шаги и кнопка действия.
export function EmptyState({ icon: Icon, pingo, title, text, steps, bullets, action, className }) {
  return (
    <motion.div
      className={cx('empty', className)}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      {pingo ? (
        <Pingo size={110} mood="open" wave className="empty__pingo" />
      ) : (
        Icon && (
          <motion.div
            className="empty__icon"
            initial={{ scale: 0.4, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.05 }}
          >
            <Icon size={40} weight="fill" />
          </motion.div>
        )
      )}
      <h2 className="empty__title">{title}</h2>
      {text && <p className="empty__text">{text}</p>}
      {steps && (
        <ol className="empty__card empty__steps">
          {steps.map((s, i) => (
            <li key={s}>
              <span className="empty__num">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      )}
      {bullets && (
        <ul className="empty__card empty__bullets">
          {bullets.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {action && <div className="empty__action">{action}</div>}
    </motion.div>
  );
}
