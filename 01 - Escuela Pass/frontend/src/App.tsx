/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

/**
 * Árbol de rutas de la aplicación autenticada y pública (login, recuperación de contraseña, módulos por rol).
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FcmBootstrap } from '@/components/FcmBootstrap';
import { useAuth } from '@/context/useAuth';
import { AppShell } from '@/components/AppShell';
import { PrivacyGate } from '@/components/PrivacyGate';
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
import { BoletinesPage } from '@/pages/modulos/BoletinesPage';
import { CalificacionesDocentePage } from '@/pages/modulos/CalificacionesDocentePage';
import { MisCalificacionesPage } from '@/pages/modulos/MisCalificacionesPage';
import { PeriodosAcademicosPage } from '@/pages/PeriodosAcademicosPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { SchoolRosterPage } from '@/pages/SchoolRosterPage';
import { VisitasPage } from '@/pages/modulos/VisitasPage';
import { ReunionesPage } from '@/pages/modulos/ReunionesPage';
import { AnotacionesDocentePage } from '@/pages/modulos/AnotacionesDocentePage';

function AuthenticatedShell() {
  const { user } = useAuth();
  return (
    <ErrorBoundary>
      <PrivacyGate>
        <AppShell key={user?.id} />
      </PrivacyGate>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FcmBootstrap />
      <ErrorBoundary>
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
          <Route path="modulos/reuniones" element={<ReunionesPage />} />
          <Route path="modulos/visitas-externas" element={<VisitasPage />} />
          <Route
            path="modulos/anotaciones-docente"
            element={
              <RoleGate allow={['ADMIN', 'ADMINISTRATIVO', 'DOCENTE']}>
                <AnotacionesDocentePage />
              </RoleGate>
            }
          />
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
      </ErrorBoundary>
    </AuthProvider>
  );
}
