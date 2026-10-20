import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, CalendarRange, ChartNoAxesColumn, Building2, LayoutGrid, Stethoscope, Users } from 'lucide-react';
import { TalkIcon } from './components/icons';
import { api } from './lib/api';
import { homeFor, useAuth } from './lib/auth';
import { useRealtime } from './lib/realtime';
import type { Role } from '@shared/constants';
import { BrandLoader } from './components/Brand';
import { EmployeeLayout } from './layouts/EmployeeLayout';
import { StaffLayout } from './layouts/StaffLayout';
import Login from './pages/auth/Login';
import Home from './pages/employee/Home';
import Booking from './pages/employee/Booking';
import Registrations from './pages/employee/Registrations';
import RegistrationDetail from './pages/employee/RegistrationDetail';
import Availability from './pages/common/Availability';
import Profile from './pages/common/Profile';
import NotFound from './pages/common/NotFound';
import PsychDashboard from './pages/psych/Dashboard';
import Sessions from './pages/psych/Sessions';
import SessionDetail from './pages/psych/SessionDetail';
import AdminTickets from './pages/admin/Tickets';
import AdminTicketDetail from './pages/admin/TicketDetail';
import Employees from './pages/admin/Employees';
import Staff from './pages/admin/Staff';
import Units from './pages/admin/Units';

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));

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
  return (
    <StaffLayout
      label="Admin"
      profilePath="/admin/profil"
      nav={[
        { to: '/admin', label: 'Dashboard', icon: ChartNoAxesColumn, end: true },
        { to: '/admin/sesi', label: 'Sesi konseling', icon: TalkIcon, badge: data?.awaitingReport },
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
          <Route path="profil" element={<Profile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
