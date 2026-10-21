import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarRange, ChartNoAxesColumn, Building2, Headset, LayoutGrid, Stethoscope, Users } from 'lucide-react';
import { TalkIcon } from './components/icons';
import { api } from './lib/api';
import { homeFor, useAuth } from './lib/auth';
import { useRealtime } from './lib/realtime';
import { useKeyboardFlag } from './lib/viewport';
import type { Role } from '@shared/constants';
import { BrandLoader } from './components/Brand';
import { SupportWidget } from './components/support/SupportWidget';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { StaffLayout } from './layouts/StaffLayout';
import Login from './pages/auth/Login';

// Halaman dimuat saat dibuka supaya unduhan awal kecil; halaman milik peran yang login diunduh diam-diam setelahnya.
const pages = {
  Home: () => import('./pages/employee/Home'),
  Booking: () => import('./pages/employee/Booking'),
  Registrations: () => import('./pages/employee/Registrations'),
  RegistrationDetail: () => import('./pages/employee/RegistrationDetail'),
  Availability: () => import('./pages/common/Availability'),
  Profile: () => import('./pages/common/Profile'),
  NotFound: () => import('./pages/common/NotFound'),
  PsychDashboard: () => import('./pages/psych/Dashboard'),
  Sessions: () => import('./pages/psych/Sessions'),
  SessionDetail: () => import('./pages/psych/SessionDetail'),
  AdminTickets: () => import('./pages/admin/Tickets'),
  AdminTicketDetail: () => import('./pages/admin/TicketDetail'),
  Employees: () => import('./pages/admin/Employees'),
  Staff: () => import('./pages/admin/Staff'),
  Units: () => import('./pages/admin/Units'),
  AdminSupport: () => import('./pages/admin/Support'),
  AdminDashboard: () => import('./pages/admin/Dashboard'),
};
const Home = lazy(pages.Home);
const Booking = lazy(pages.Booking);
const Registrations = lazy(pages.Registrations);
const RegistrationDetail = lazy(pages.RegistrationDetail);
const Availability = lazy(pages.Availability);
const Profile = lazy(pages.Profile);
const NotFound = lazy(pages.NotFound);
const PsychDashboard = lazy(pages.PsychDashboard);
const Sessions = lazy(pages.Sessions);
const SessionDetail = lazy(pages.SessionDetail);
const AdminTickets = lazy(pages.AdminTickets);
const AdminTicketDetail = lazy(pages.AdminTicketDetail);
const Employees = lazy(pages.Employees);
const Staff = lazy(pages.Staff);
const Units = lazy(pages.Units);
const AdminSupport = lazy(pages.AdminSupport);
const AdminDashboard = lazy(pages.AdminDashboard);

const PRELOAD: Record<string, (keyof typeof pages)[]> = {
  employee: ['Home', 'Booking', 'Registrations', 'RegistrationDetail', 'Profile'],
  psychologist: ['PsychDashboard', 'Sessions', 'SessionDetail', 'Availability', 'Profile'],
  admin: ['AdminDashboard', 'AdminTickets', 'AdminTicketDetail', 'Availability', 'Employees', 'Staff', 'Units', 'AdminSupport', 'Profile'],
};

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <BrandLoader />;
  if (!user) return <Navigate to="/masuk" replace state={{ from: loc.pathname + loc.search }} />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <BrandLoader />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function AdminShell() {
  const { data } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get<{ awaitingReport: number; today: number; upcoming: number }>('/admin/overview'),
    refetchInterval: 60_000,
  });
  const { data: support } = useQuery({
    queryKey: ['support', 'threads', ''],
    queryFn: () => api.get<{ unread: number }>('/support/threads'),
    refetchInterval: 60_000,
  });
  return (
    <StaffLayout
      label="Admin"
      profilePath="/admin/profil"
      nav={[
        { to: '/admin', label: 'Dashboard', icon: ChartNoAxesColumn, end: true },
        { to: '/admin/sesi', label: 'Sesi konseling', icon: TalkIcon, badge: data?.awaitingReport },
        { to: '/admin/bantuan', label: 'Chat bantuan', icon: Headset, badge: support?.unread },
        { to: '/admin/ketersediaan', label: 'Ketersediaan psikolog', icon: CalendarRange },
        { to: '/admin/pekerja', label: 'Data pekerja', icon: Users },
        { to: '/admin/psikolog', label: 'Psikolog & admin', icon: Stethoscope },
        { to: '/admin/unit', label: 'Unit kerja', icon: Building2 },
      ]}
    />
  );
}

function PsychShell() {
  return (
    <StaffLayout
      label="Psikolog"
      profilePath="/psikolog/profil"
      nav={[
        { to: '/psikolog', label: 'Beranda', icon: LayoutGrid, end: true },
        { to: '/psikolog/sesi', label: 'Sesi saya', icon: CalendarDays },
        { to: '/psikolog/ketersediaan', label: 'Jadwal & ketersediaan', icon: CalendarRange },
      ]}
    />
  );
}

export default function App() {
  useRealtime();
  useKeyboardFlag();
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const t = window.setTimeout(() => PRELOAD[user.role]?.forEach((k) => void pages[k]().catch(() => {})), 2000);
    return () => window.clearTimeout(t);
  }, [user?.role]);
  return (
    <Suspense fallback={<BrandLoader />}>
      <Routes>
        <Route path="/masuk" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/daftar" element={<Navigate to="/masuk" replace />} />

        <Route element={<Guard role="employee"><EmployeeLayout /></Guard>}>
          <Route index element={<Home />} />
          <Route path="buat-janji" element={<Booking />} />
          <Route path="pendaftaran" element={<Registrations />} />
          <Route path="pendaftaran/:id" element={<RegistrationDetail />} />
          <Route path="profil" element={<Profile />} />
        </Route>

        <Route path="/psikolog" element={<Guard role="psychologist"><PsychShell /></Guard>}>
          <Route index element={<PsychDashboard />} />
          <Route path="sesi" element={<Sessions />} />
          <Route path="sesi/:id" element={<SessionDetail />} />
          <Route path="ketersediaan" element={<Availability />} />
          <Route path="profil" element={<Profile />} />
        </Route>

        <Route path="/admin" element={<Guard role="admin"><AdminShell /></Guard>}>
          <Route index element={<AdminDashboard />} />
          <Route path="sesi" element={<AdminTickets />} />
          <Route path="sesi/:id" element={<AdminTicketDetail />} />
          <Route path="ketersediaan" element={<Availability />} />
          <Route path="pekerja" element={<Employees />} />
          <Route path="psikolog" element={<Staff />} />
          <Route path="unit" element={<Units />} />
          <Route path="bantuan" element={<AdminSupport />} />
          <Route path="profil" element={<Profile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <SupportWidget />
    </Suspense>
  );
}
