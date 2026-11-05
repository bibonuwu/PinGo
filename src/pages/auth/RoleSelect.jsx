import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useThemeColor } from '../../hooks/useThemeColor';
import { BackButton } from '../../components/PageHeader';

const ROLES = [
  {
    to: '/register/parent',
    label: 'Родитель',
    hint: 'Ищу поддержку для ребёнка',
    img: '/images/role-parent.png',
    className: 'role-card--parent',
  },
  {
    to: '/register/specialist',
    label: 'Специалист / волонтёр',
    hint: 'Хочу заниматься с детьми',
    img: '/images/role-specialist.png',
    className: 'role-card--specialist',
  },
];

export default function RoleSelect() {
  useThemeColor('#FFFFFF');
  const { account, needsProfile, signOut } = useAuth();
  return (
    <div className="roles">
      <div className="roles__top">
        <BackButton to="/" />
      </div>
      <motion.h1 className="roles__title" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        Я…
      </motion.h1>
      <motion.p className="roles__sub" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
        выберите, что подходит вам
      </motion.p>
      <div className="roles__grid">
        {ROLES.map((r, i) => (
          <motion.div
            key={r.to}
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 22, delay: 0.12 + i * 0.1 }}
            whileHover={{ y: -6 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link to={r.to} className={`role-card ${r.className}`}>
              <span className="role-card__label">{r.label}</span>
              <span className="role-card__hint">{r.hint}</span>
              <img src={r.img} alt="" className="role-card__img" />
            </Link>
          </motion.div>
        ))}
      </div>
      {needsProfile ? (
        <p className="roles__footer">
          Вы вошли как {account?.email} — выберите роль, чтобы завершить регистрацию.{' '}
          <button type="button" className="link-btn" onClick={signOut}>
            Выйти
          </button>
        </p>
      ) : (
        <p className="roles__footer">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      )}
      <p className="roles__note">Модераторов добавляет команда Pingo — регистрация для них не нужна.</p>
    </div>
  );
}
