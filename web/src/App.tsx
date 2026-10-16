import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChartNoAxesColumn, Building2, LayoutGrid, Stethoscope, Users } from 'lucide-react';
import { TalkIcon } from './components/icons';
import { api } from './lib/api';
import { homeFor, useAuth } from './lib/auth';
import { useRealtime } from './lib/realtime';
import type { Role } from '@shared/constants';
import { AppSkeleton, StatsSkeleton } from './components/Skeletons';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { StaffLayout } from './layouts/StaffLayout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import VerificationStatus from './pages/auth/VerificationStatus';
import Home from './pages/employee/Home';
import NewRequest from './pages/employee/NewRequest';
import Tickets from './pages/employee/Tickets';
import TicketDetail from './pages/employee/TicketDetail';
import Profile from './pages/common/Profile';
import NotFound from './pages/common/NotFound';
import PsychDashboard from './pages/psych/Dashboard';
import Sessions from './pages/psych/Sessions';
import SessionDetail from './pages/psych/SessionDetail';
import AdminTickets from './pages/admin/Tickets';
import AdminTicketDetail from './pages/admin/TicketDetail';
import Accounts from './pages/admin/Accounts';
import Staff from './pages/admin/Staff';
import Units from './pages/admin/Units';

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <AppSkeleton />;
  if (!user) return <Navigate to="/masuk" replace state={{ from: loc.pathname + loc.search }} />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  if (user.role === 'employee' && user.status !== 'verified') return <VerificationStatus />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <AppSkeleton />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return <>{children}</>;
}

function AdminShell() {
  const { data } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api.get<{ pendingAccounts: number; pendingTickets: number; rescheduleRequests: number }>('/admin/overview'),
    refetchInterval: 60_000,
  });
  return (
    <StaffLayout
      label="Admin"
      profilePath="/admin/profil"
      nav={[
        { to: '/admin', label: 'Statistik', icon: ChartNoAxesColumn, end: true },
        { to: '/admin/tiket', label: 'Tiket', icon: TalkIcon, badge: (data?.pendingTickets ?? 0) + (data?.rescheduleRequests ?? 0) },
        { to: '/admin/akun', label: 'Akun karyawan', icon: Users, badge: data?.pendingAccounts },
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
      ]}
    />
  );
}

export default function App() {
  useRealtime();
  return (
    <Suspense fallback={<StatsSkeleton />}>
      <Routes>
        <Route path="/masuk" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/daftar" element={<GuestOnly><Register /></GuestOnly>} />

        <Route element={<Guard role="employee"><EmployeeLayout /></Guard>}>
          <Route index element={<Home />} />
          <Route path="ajukan" element={<NewRequest />} />
          <Route path="tiket" element={<Tickets />} />
          <Route path="tiket/:id" element={<TicketDetail />} />
          <Route path="profil" element={<Profile />} />
        </Route>

        <Route path="/psikolog" element={<Guard role="psychologist"><PsychShell /></Guard>}>
          <Route index element={<PsychDashboard />} />
          <Route path="sesi" element={<Sessions />} />
          <Route path="sesi/:id" element={<SessionDetail />} />
          <Route path="profil" element={<Profile />} />
        </Route>

        <Route path="/admin" element={<Guard role="admin"><AdminShell /></Guard>}>
          <Route index element={<AdminDashboard />} />
          <Route path="tiket" element={<AdminTickets />} />
          <Route path="tiket/:id" element={<AdminTicketDetail />} />
          <Route path="akun" element={<Accounts />} />
          <Route path="psikolog" element={<Staff />} />
          <Route path="unit" element={<Units />} />
          <Route path="profil" element={<Profile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
