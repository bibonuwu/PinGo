import { Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useLiveQuery } from './hooks/useLiveQuery';
import { db } from './lib/db';
import { DEFAULT_A11Y } from './lib/constants';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './layout/AppShell';
import { FullScreenLoader, PublicOnly, RequireAuth } from './layout/Guards';
import { NavigateBridge, NotificationWatcher, PwaUpdater, ReminderWatcher } from './layout/Watchers';

import Welcome from './pages/auth/Welcome';
import Login from './pages/auth/Login';
import RoleSelect from './pages/auth/RoleSelect';
import Register from './pages/auth/Register';
import NotFound from './pages/NotFound';

// Страница, код которой загружается по требованию: родителю не нужен код модератора и наоборот.
// В отличие от React.lazy, уже скачанная страница отрисовывается сразу — lazy и после preload
// показал бы заглушку хотя бы на один кадр. Пока кода нет, страница «приостанавливается» (Suspense).
function page(load) {
  let Component = null;
  let failed = null;
  let pending = null;
  const preload = () =>
    (pending ??= load().then(
      (m) => {
        Component = m.default;
      },
      (e) => {
        pending = null;
        throw e;
      },
    ));
  function Page(props) {
    if (Component) return <Component {...props} />;
    if (failed) throw failed;
    throw preload().catch((e) => {
      failed = e;
    });
  }
  Page.preload = preload;
  return Page;
}

const ParentHome = page(() => import('./pages/parent/ParentHome'));
const Specialists = page(() => import('./pages/parent/Specialists'));
const SpecialistDetail = page(() => import('./pages/parent/SpecialistDetail'));
const BookSession = page(() => import('./pages/parent/BookSession'));
const ParentBookings = page(() => import('./pages/parent/ParentBookings'));
const ParentProfile = page(() => import('./pages/parent/ParentProfile'));
const ChildWizard = page(() => import('./pages/parent/ChildWizard'));
const ChildDetail = page(() => import('./pages/parent/ChildDetail'));
const ChildEdit = page(() => import('./pages/parent/ChildEdit'));
const SpecialistHome = page(() => import('./pages/specialist/SpecialistHome'));
const Availability = page(() => import('./pages/specialist/Availability'));
const Requests = page(() => import('./pages/specialist/Requests'));
const SpecialistProfile = page(() => import('./pages/specialist/SpecialistProfile'));
const ProfileEditor = page(() => import('./pages/specialist/ProfileEditor'));
const Training = page(() => import('./pages/specialist/Training'));
const AdminDashboard = page(() => import('./pages/admin/AdminDashboard'));
const AdminProfiles = page(() => import('./pages/admin/AdminProfiles'));
const AdminProfileReview = page(() => import('./pages/admin/AdminProfileReview'));
const AdminRating = page(() => import('./pages/admin/AdminRating'));
const AdminVolunteers = page(() => import('./pages/admin/AdminVolunteers'));
const AdminUsers = page(() => import('./pages/admin/AdminUsers'));
const AdminBroadcast = page(() => import('./pages/admin/AdminBroadcast'));
const AdminReports = page(() => import('./pages/admin/AdminReports'));
const BookingDetail = page(() => import('./pages/shared/BookingDetail'));
const Messages = page(() => import('./pages/shared/Messages'));
const Notifications = page(() => import('./pages/shared/Notifications'));
const Settings = page(() => import('./pages/shared/Settings'));
const Help = page(() => import('./pages/shared/Help'));
const VideoRoom = page(() => import('./pages/shared/VideoRoom'));
const CertificateView = page(() => import('./pages/shared/CertificateView'));

const SHARED_PAGES = [Notifications, Settings, Help];
const ROLE_PAGES = {
  parent: [
    ParentHome, Specialists, SpecialistDetail, BookSession, ParentBookings, ParentProfile,
    ChildWizard, ChildDetail, ChildEdit, BookingDetail, Messages, VideoRoom,
  ],
  specialist: [
    SpecialistHome, Availability, Requests, SpecialistProfile, ProfileEditor, Training,
    BookingDetail, Messages, VideoRoom,
  ],
  admin: [
    AdminDashboard, AdminProfiles, AdminProfileReview, AdminRating, AdminVolunteers, AdminUsers, AdminBroadcast, AdminReports,
    Messages,
  ],
};

// Для родителя действуют настройки доступности выбранного ребёнка, для остальных — свои.
function useEffectiveA11y(user) {
  const child = useLiveQuery(
    async () => (user?.role === 'parent' && user.activeChildId ? ((await db.children.get(user.activeChildId)) ?? null) : null),
    [user?.role, user?.activeChildId],
  );
  if (!user) return DEFAULT_A11Y;
  if (user.role === 'parent') return { ...DEFAULT_A11Y, ...(child?.accessibility ?? {}) };
  return { ...DEFAULT_A11Y, ...(user.accessibility ?? {}) };
}

function Experience({ children }) {
  const { user } = useAuth();
  const a = useEffectiveA11y(user);
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.textSize = a.textSize;
    el.dataset.lineSpacing = a.lineSpacing;
    el.toggleAttribute('data-reduce-motion', a.reduceMotion);
    el.toggleAttribute('data-high-contrast', a.highContrast);
    el.toggleAttribute('data-readable', a.readableFont);
  }, [a.textSize, a.lineSpacing, a.reduceMotion, a.highContrast, a.readableFont]);
  return <MotionConfig reducedMotion={a.reduceMotion ? 'always' : 'user'}>{children}</MotionConfig>;
}

function SessionServices() {
  const { user } = useAuth();
  const role = user?.role;

  // Код всех страниц своего кабинета скачиваем заранее, пока пользователь смотрит первую:
  // потом переходы мгновенные. Ошибку сети здесь не показываем — страница повторит загрузку при переходе.
  useEffect(() => {
    if (!ROLE_PAGES[role]) return undefined;
    const t = setTimeout(() => {
      for (const p of [...ROLE_PAGES[role], ...SHARED_PAGES]) p.preload().catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [role]);

  if (!user) return null;
  return (
    <>
      <NotificationWatcher user={user} />
      <ReminderWatcher user={user} />
    </>
  );
}

const sharedRoutes = (
  <>
    <Route path="notifications" element={<Notifications />} />
    <Route path="settings" element={<Settings />} />
    <Route path="help" element={<Help />} />
  </>
);

export default function App() {
  return (
    // v7_startTransition: переход — это startTransition, и пока новая страница не готова, видна прежняя.
    <BrowserRouter future={{ v7_startTransition: true }}>
      <ToastProvider>
        <AuthProvider>
          <Experience>
            <NavigateBridge />
            <PwaUpdater />
            <SessionServices />
            <Suspense fallback={<FullScreenLoader />}>
              <Routes>
                <Route element={<PublicOnly />}>
                  <Route path="/" element={<Welcome />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<RoleSelect />} />
                  <Route path="/register/:role" element={<Register />} />
                </Route>

                <Route path="/room/:id" element={<RequireAuth><VideoRoom /></RequireAuth>} />
                <Route path="/certificate/:id" element={<RequireAuth><CertificateView /></RequireAuth>} />
                <Route path="/parent/onboarding" element={<RequireAuth role="parent"><ChildWizard onboarding /></RequireAuth>} />
                <Route path="/parent/children/new" element={<RequireAuth role="parent"><ChildWizard /></RequireAuth>} />

                <Route path="/parent" element={<RequireAuth role="parent"><AppShell role="parent" /></RequireAuth>}>
                  <Route index element={<ParentHome />} />
                  <Route path="specialists" element={<Specialists />} />
                  <Route path="specialists/:id" element={<SpecialistDetail />} />
                  <Route path="specialists/:id/book" element={<BookSession />} />
                  <Route path="bookings" element={<ParentBookings />} />
                  <Route path="bookings/:id" element={<BookingDetail viewer="parent" />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="messages/:id" element={<Messages />} />
                  <Route path="profile" element={<ParentProfile />} />
                  <Route path="children/:id" element={<ChildDetail />} />
                  <Route path="children/:id/edit" element={<ChildEdit />} />
                  {sharedRoutes}
                </Route>

                <Route path="/specialist" element={<RequireAuth role="specialist"><AppShell role="specialist" /></RequireAuth>}>
                  <Route index element={<SpecialistHome />} />
                  <Route path="availability" element={<Availability />} />
                  <Route path="requests" element={<Requests />} />
                  <Route path="requests/:id" element={<BookingDetail viewer="specialist" />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="messages/:id" element={<Messages />} />
                  <Route path="profile" element={<SpecialistProfile />} />
                  <Route path="profile/edit" element={<ProfileEditor />} />
                  <Route path="training" element={<Training />} />
                  {sharedRoutes}
                </Route>

                <Route path="/admin" element={<RequireAuth role="admin"><AppShell role="admin" /></RequireAuth>}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="profiles" element={<AdminProfiles />} />
                  <Route path="profiles/:id" element={<AdminProfileReview />} />
                  <Route path="rating" element={<AdminRating />} />
                  <Route path="volunteers" element={<AdminVolunteers />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="broadcast" element={<AdminBroadcast />} />
                  <Route path="reports" element={<AdminReports />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="messages/:id" element={<Messages />} />
                  {sharedRoutes}
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </Experience>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
