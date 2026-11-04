import { NEED_SPECIALIZATIONS } from './constants';
import { ageFromBirthDate } from './utils';

// Простой подбор специалистов под ребёнка: совпадение потребностей со специализациями + возраст.
// Позже это место можно заменить рекомендациями от ИИ (см. концепцию).
export function matchChild(child, data) {
  if (!child || !data) return null;
  const age = ageFromBirthDate(child.birthDate);
  const ageOk = age == null || (age >= data.ageMin && age <= data.ageMax);
  const specs = new Set(data.specializations);
  const matchedNeeds = (child.needs || []).filter((n) => (NEED_SPECIALIZATIONS[n] || []).some((s) => specs.has(s)));
  const score = matchedNeeds.length * 3 + (ageOk ? 2 : -10);
  return { age, ageOk, matchedNeeds, score, good: ageOk && matchedNeeds.length > 0 };
}
