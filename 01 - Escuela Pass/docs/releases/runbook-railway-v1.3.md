# Runbook Railway v1.3

Fecha: 2026-04-26  
Objetivo: desplegar Escuela Pass con esquema formal, sin depender de parches invisibles de arranque.

## Decisión técnica

- El esquema v1.3 queda formalizado en migración TypeORM.
- `ensureRuntimeSchema` se mantiene como red de seguridad idempotente para entornos heredados, pero no reemplaza `npm run migration:run`.
- En Railway se debe ejecutar la migración antes de publicar tráfico a la versión nueva.

## Variables requeridas

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- Variables de correo/push si están habilitadas en producción.
- Volumen persistente configurado para archivos subidos.

## Pasos de despliegue

1. Verificar que la base actual tiene respaldo reciente.
2. Ejecutar en Railway Shell o job temporal:

   ```bash
   npm run migration:run
   ```

3. Revisar que la migración `InstitutionalV13RuntimeSchema1778100000000` quede registrada en la tabla `migrations`.
4. Desplegar la app con `npm run start:prod`.
5. Probar smoke test:
   - Login `ADMINISTRATIVO`.
   - Crear asignatura, asignar docente a grupo y crear sesión con día/hora.
   - Entrar como alumno/docente y validar horario.
   - Crear circuito de recogida con `Otro vehículo o taxi`.
   - Exportar auditoría lifecycle en `.xlsx`.
   - Revisar dashboard operativo y finanzas.

## Si falla la migración

- No publicar nueva versión.
- Revisar permisos del usuario de base sobre tipos enum y tablas.
- Si falla por enum `circuit_status`, aplicar la instrucción documentada en la migración `CircuitPadreEnCamino1776100000000` con usuario dueño del tipo.
- Restaurar desde backup solo si hubo una migración parcialmente aplicada que no puede completarse de forma idempotente.

## Criterio de salida

- Migraciones OK.
- Backend build/lint/e2e OK.
- Frontend build/lint OK.
- Smoke test funcional por rol OK.
