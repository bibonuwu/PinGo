import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeftIcon } from '@phosphor-icons/react';
import { cx } from '../lib/utils';
import { IconButton } from './ui';

export function BackButton({ to, label = 'Назад', variant = 'soft', className }) {
  const navigate = useNavigate();
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(to || '/', { replace: true });
  };
  return <IconButton icon={ArrowLeftIcon} label={label} variant={variant} onClick={goBack} className={className} />;
}

export function PageHeader({ title, subtitle, back, actions, className, eyebrow }) {
  return (
    <header className={cx('page-header', className)}>
      {back && <BackButton to={typeof back === 'string' ? back : undefined} />}
      <div className="page-header__text">
        {eyebrow && <div className="page-header__eyebrow">{eyebrow}</div>}
        <motion.h1
          className="page-title"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {title}
        </motion.h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
