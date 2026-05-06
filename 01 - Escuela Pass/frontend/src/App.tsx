/**
 * Árbol de rutas de la aplicación autenticada y pública (login, recuperación de contraseña, módulos por rol).
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthProvider';
import { FcmBootstrap } from '@/components/FcmBootstrap';
import { NotifToast } from '@/components/NotifToast';
import { useAuth } from '@/context/useAuth';
import { AppShell } from '@/components/AppShell';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { RoleGate } from '@/components/RoleGate';
import { AppHomePage } from '@/pages/AppHomePage';
import { CircuitDetailPage } from '@/pages/CircuitDetailPage';
import { CircuitPadrePage } from '@/pages/CircuitPadrePage';
import { CircuitTodayPage } from '@/pages/CircuitTodayPage';
import { EscanerAccesoPage } from '@/pages/EscanerAccesoPage';
import { HomePage } from '@/pages/HomePage';
import { ImportExportPage } from '@/pages/ImportExportPage';
import { InstitutionPage } from '@/pages/InstitutionPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { PerfilPage } from '@/pages/PerfilPage';
import { ScheduleHubPage } from '@/pages/ScheduleHubPage';
import { SchoolsAdminPage } from '@/pages/SchoolsAdminPage';
import {
  AcademicoPage,
  AdministracionPage,
  ComunicacionPage,
  FinanzasPage
} from '@/pages/modulos/Operativos';
import { AnotacionesDocentePage } from '@/pages/modulos/AnotacionesDocentePage';
import { BoletinesPage } from '@/pages/modulos/BoletinesPage';
import { CalificacionesDocentePage } from '@/pages/modulos/CalificacionesDocentePage';
import { MisCalificacionesPage } from '@/pages/modulos/MisCalificacionesPage';
import { ReunionesPage } from '@/pages/modulos/ReunionesPage';
import { VisitasPage } from '@/pages/modulos/VisitasPage';
import { PeriodosAcademicosPage } from '@/pages/PeriodosAcademicosPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { SchoolRosterPage } from '@/pages/SchoolRosterPage';

function AuthenticatedShell() {
  const { user } = useAuth();
  return <AppShell key={user?.id} />;
}

export default function App() {
  return (
    <AuthProvider>
      <FcmBootstrap />
      <NotifToast />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar-contrasena" element={<ForgotPasswordPage />} />
        <Route path="/restablecer-contrasena" element={<ResetPasswordPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AuthenticatedShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<AppHomePage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route
            path="horario"
            element={
              <RoleGate allow={['ALUMNO', 'DOCENTE', 'ADMIN', 'ADMINISTRATIVO']}>
                <ScheduleHubPage />
              </RoleGate>
            }
          />
          <Route path="institucion" element={<InstitutionPage />} />
          <Route
            path="gestion-escolar"
            element={
              <RoleGate allow={['ADMIN', 'ADMINISTRATIVO']}>
                <SchoolRosterPage />
              </RoleGate>
            }
          />
          <Route
            path="escuelas"
            element={
              <RoleGate allow={['ADMIN']}>
                <SchoolsAdminPage />
              </RoleGate>
            }
          />
          <Route path="modulos" element={<Navigate to="/app" replace />} />
          <Route path="modulos/comunicacion" element={<ComunicacionPage />} />
          <Route path="modulos/finanzas" element={<FinanzasPage />} />
          <Route path="modulos/academico" element={<AcademicoPage />} />
          <Route
            path="modulos/calificaciones-docente"
            element={
              <RoleGate allow={['ADMIN', 'ADMINISTRATIVO', 'DOCENTE']}>
                <CalificacionesDocentePage />
              </RoleGate>
            }
          />
          <Route
            path="modulos/mis-calificaciones"
            element={
              <RoleGate allow={['ALUMNO', 'PADRE', 'ADMIN', 'ADMINISTRATIVO']}>
                <MisCalificacionesPage />
              </RoleGate>
            }
          />
          <Route
            path="modulos/boletines"
            element={
              <RoleGate allow={['ADMIN', 'ADMINISTRATIVO', 'DOCENTE', 'ALUMNO', 'PADRE']}>
                <BoletinesPage />
              </RoleGate>
            }
          />
          <Route
            path="modulos/periodos-academicos"
            element={
              <RoleGate allow={['ADMIN', 'ADMINISTRATIVO']}>
                <PeriodosAcademicosPage />
              </RoleGate>
            }
          />
          <Route
            path="modulos/anotaciones-docente"
            element={
              <RoleGate allow={['DOCENTE', 'ADMIN', 'ADMINISTRATIVO']}>
                <AnotacionesDocentePage />
              </RoleGate>
            }
          />
          <Route path="modulos/visitas" element={<VisitasPage />} />
          <Route path="modulos/reuniones" element={<ReunionesPage />} />
          <Route
            path="modulos/administracion"
            element={
              <RoleGate allow={['ADMIN', 'ADMINISTRATIVO']}>
                <AdministracionPage />
              </RoleGate>
            }
          />
          <Route path="modulos/herramientas" element={<Navigate to="/app/perfil" replace />} />
          <Route
            path="importaciones"
            element={
              <RoleGate allow={['ADMIN', 'ADMINISTRATIVO', 'DOCENTE']}>
                <ImportExportPage />
              </RoleGate>
            }
          />
          <Route
            path="acceso/escaner"
            element={
              <RoleGate allow={['ADMIN', 'ADMINISTRATIVO', 'DOCENTE']}>
                <EscanerAccesoPage />
              </RoleGate>
            }
          />
          <Route
            path="circuito/hoy"
            element={
              <RoleGate allow={['DOCENTE', 'ADMIN', 'ADMINISTRATIVO']}>
                <CircuitTodayPage />
              </RoleGate>
            }
          />
          <Route
            path="circuito/:id"
            element={
              <RoleGate allow={['PADRE', 'DOCENTE', 'ADMIN', 'ADMINISTRATIVO']}>
                <CircuitDetailPage />
              </RoleGate>
            }
          />
          <Route
            path="circuito"
            element={
              <RoleGate allow={['PADRE', 'ADMIN', 'ADMINISTRATIVO']}>
                <CircuitPadrePage />
              </RoleGate>
            }
          />
        </Route>
        <Route path="/panel" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
