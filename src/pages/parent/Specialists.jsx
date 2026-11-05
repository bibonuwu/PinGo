import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheckIcon, HeartIcon, MagnifyingGlassIcon, SparkleIcon, UsersThreeIcon, XIcon } from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { entryCategories, freshSlots, useCatalog } from '../../hooks/useCatalog';
import { useChildren } from '../../hooks/useBookings';
import { useNow } from '../../hooks/useNow';
import { CATEGORIES, SPECIALIZATION_MAP } from '../../lib/constants';
import { matchChild } from '../../lib/matching';
import { isSameDay, plural } from '../../lib/utils';
import { toggleFavorite } from '../../services/auth';
import { EmptyState } from '../../components/EmptyState';
import { SpecialistCard } from '../../components/SpecialistCard';
import { Button, Chip, IconButton, Input, listVariants } from '../../components/ui';

export default function Specialists() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);
  const now = useNow(60_000);
  const catalog = useCatalog();
  const children = useChildren(user.id);
  const activeChild = children?.find((c) => c.id === user.activeChildId) ?? children?.[0];

  const cat = params.get('cat') || 'all';
  const today = params.get('today') === '1';
  const onlyMatch = params.get('match') === '1';
  const onlyFav = params.get('fav') === '1';
  const favorites = useMemo(() => new Set(user.favorites ?? []), [user.favorites]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const list = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog
      .map((e) => ({ e, m: activeChild ? matchChild(activeChild, e.data) : null }))
      .filter(({ e }) => cat === 'all' || entryCategories(e).has(cat))
      .filter(({ e }) => !today || freshSlots(e.slots, now).some((s) => isSameDay(s.start, now)))
      .filter(({ m }) => !onlyMatch || m?.good)
      .filter(({ e }) => !onlyFav || favorites.has(e.id))
      .filter(({ e }) => {
        if (!q) return true;
        const hay = [e.user.name, e.data.title, e.data.description, e.data.city, ...e.data.specializations.map((s) => SPECIALIZATION_MAP[s]?.label)]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => (b.m?.score ?? 0) - (a.m?.score ?? 0) || (b.e.rating ?? 0) - (a.e.rating ?? 0));
  }, [catalog, activeChild, cat, today, onlyMatch, onlyFav, favorites, query, now]);

  const filtered = cat !== 'all' || today || onlyMatch || onlyFav || query;

  return (
    <div className="page catalog">
      <header className="page-header">
        <div className="page-header__text">
          <motion.h1 className="page-title" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            Найти специалиста
          </motion.h1>
        </div>
        <IconButton
          icon={searchOpen ? XIcon : MagnifyingGlassIcon}
          label={searchOpen ? 'Закрыть поиск' : 'Поиск'}
          size="lg"
          onClick={() => {
            setSearchOpen((o) => !o);
            if (searchOpen) setQuery('');
            else setTimeout(() => searchRef.current?.focus(), 80);
          }}
        />
      </header>

      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div className="catalog__search" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Input
              ref={searchRef}
              icon={MagnifyingGlassIcon}
              placeholder="Имя, направление или город"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              aria-label="Поиск специалиста"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="chips chips--scroll">
        <Chip active={cat === 'all'} onClick={() => setParam('cat', null)}>
          Все
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setParam('cat', cat === c.id ? null : c.id)} dot={c.color}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="chips chips--scroll chips--sm">
        {activeChild && (
          <Chip active={onlyMatch} icon={SparkleIcon} onClick={() => setParam('match', onlyMatch ? null : '1')}>
            Подходит · {activeChild.name}
          </Chip>
        )}
        <Chip active={today} icon={CalendarCheckIcon} onClick={() => setParam('today', today ? null : '1')}>
          Свободны сегодня
        </Chip>
        <Chip active={onlyFav} icon={HeartIcon} onClick={() => setParam('fav', onlyFav ? null : '1')}>
          Избранные
        </Chip>
      </div>

      {catalog && (
        <p className="catalog__count">
          {filtered ? 'Найдено' : 'В каталоге'}: {list.length} {plural(list.length, ['анкета', 'анкеты', 'анкет'])}
        </p>
      )}

      {catalog && list.length === 0 ? (
        <EmptyState
          icon={UsersThreeIcon}
          title="Никого не нашли"
          text="Попробуйте убрать часть фильтров или изменить запрос."
          action={
            <Button
              variant="primary"
              onClick={() => {
                setQuery('');
                setParams(new URLSearchParams(), { replace: true });
              }}
            >
              Сбросить фильтры
            </Button>
          }
        />
      ) : (
        <motion.div className="sp-grid" variants={listVariants} initial="hidden" animate="show">
            {list.map(({ e, m }) => (
              <SpecialistCard
                key={e.id}
                entry={e}
                match={m}
                childName={activeChild?.name}
                now={now}
                to={`/parent/specialists/${e.id}`}
                favorite={favorites.has(e.id)}
                onToggleFavorite={() => toggleFavorite(user.id, e.id)}
              />
            ))}
        </motion.div>
      )}
    </div>
  );
}
