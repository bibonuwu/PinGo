import { useAuth, homePath } from '../context/AuthContext';
import { Pingo } from '../components/Pingo';
import { ButtonLink } from '../components/ui';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="not-found">
      <Pingo size={140} mood="wink" wave />
      <h1>404</h1>
      <p>Кажется, Pingo уплыл не туда. Такой страницы нет.</p>
      <ButtonLink to={user ? homePath(user.role) : '/'} variant="dark" size="lg">
        На главную
      </ButtonLink>
    </div>
  );
}
