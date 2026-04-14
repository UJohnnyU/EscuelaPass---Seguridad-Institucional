import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthProvider';
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
import { StudentSchedulePage } from '@/pages/StudentSchedulePage';
import { SchoolsAdminPage } from '@/pages/SchoolsAdminPage';
import {
  AcademicoPage,
  AdministracionPage,
  ComunicacionPage,
  FinanzasPage,
  HerramientasPage,
  ModulosHubPage,
  VisitasPage
} from '@/pages/modulos/Operativos';
import { AnotacionesDocentePage } from '@/pages/modulos/AnotacionesDocentePage';
import { CalificacionesDocentePage } from '@/pages/modulos/CalificacionesDocentePage';

function AuthenticatedShell() {
  const { user } = useAuth();
  return <AppShell key={user?.id} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
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
              <RoleGate allow={['ALUMNO']}>
                <StudentSchedulePage />
              </RoleGate>
            }
          />
          <Route path="institucion" element={<InstitutionPage />} />
          <Route
            path="escuelas"
            element={
              <RoleGate allow={['ADMIN']}>
                <SchoolsAdminPage />
              </RoleGate>
            }
          />
          <Route path="modulos" element={<ModulosHubPage />} />
          <Route path="modulos/comunicacion" element={<ComunicacionPage />} />
          <Route path="modulos/finanzas" element={<FinanzasPage />} />
          <Route path="modulos/academico" element={<AcademicoPage />} />
          <Route
            path="modulos/calificaciones-docente"
            element={
              <RoleGate allow={['DOCENTE']}>
                <CalificacionesDocentePage />
              </RoleGate>
            }
          />
          <Route
            path="modulos/anotaciones-docente"
            element={
              <RoleGate allow={['DOCENTE']}>
                <AnotacionesDocentePage />
              </RoleGate>
            }
          />
          <Route path="modulos/visitas" element={<VisitasPage />} />
          <Route path="modulos/administracion" element={<AdministracionPage />} />
          <Route path="modulos/herramientas" element={<HerramientasPage />} />
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
