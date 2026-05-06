# Convención de comentarios (código)

**Objetivo:** comentarios útiles para mantenimiento y entrega institucional, sin ruido.

## Idioma y tono

- **Español** en comentarios y documentación en código (alineado al resto del proyecto).
- Frases completas cuando aporten contexto; evitar telegráficos incomprensibles.
- No usar el comentario para repetir el nombre obvio del símbolo (p. ej. “constructor” sobre un `constructor` vacío).

## Qué sí documentar

- **Cabezal de archivo** (opcional pero recomendado en módulos con lógica de negocio): rol del módulo y dependencias relevantes hacia otros bounded contexts.
- **APIs públicas**: controladores Nest (prefijos, reglas de autorización resumidas), guards, pipes que alteren datos.
- **DTOs y tipos compartidos**: JSDoc breve en la clase o en propiedades no evidentes (unidades, formatos, restricciones de negocio).
- **Algoritmos o ramas no obvias**: por qué existe un `if` especial, límites temporales, idempotencia, compensación.
- **Integraciones externas**: FCM, Mapbox, pasarelas o correo — qué variable de entorno las gobierna y qué falla de forma silenciosa vs. explícita.

## Qué no hace falta documentar

- Entidades TypeORM cuyos nombres y columnas coinciden con el dominio y no hay regla oculta.
- Cada método CRUD que solo delegue en el repositorio.
- Tests salvo que el caso de prueba documente una regla de negocio contraintuitiva.

## Frontend (React)

- Componentes de página: una o dos líneas sobre el rol de la pantalla y el rol de usuario objetivo si no es obvio por la ruta.
- Hooks y utilidades compartidas (`lib/`): contrato de uso (cuándo llamarlos, efectos secundarios).

## Preferencias técnicas

- En **TypeScript**, preferir tipos claros y nombres descriptivos antes que comentarios largos.
- Respetar **accesibilidad**: no sustituir `aria-*` o labels visibles con comentarios en código.
- Para cambios temporales o deuda técnica, preferir un TODO con referencia a issue o decisión (“hasta migración X”).
