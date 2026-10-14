# PostulApp

Gestor de búsquedas laborales con tablero kanban. Organizá tus postulaciones por estado, buscalas y mirá tus estadísticas.

**Stack:** React + TypeScript (Vite) · Node.js + Express + TypeScript · MySQL

## Cómo correrlo
1. Base de datos (si ya la tenías creada: `docker compose down -v` primero, el esquema cambió): `docker compose up -d` (o importá `backend/schema.sql` en tu MySQL).
2. Backend: `cd backend && cp .env.example .env && npm install && npm run dev` (puerto 3001).
3. Frontend: `cd frontend && npm install && npm run dev` (puerto 5173).

## Tests
`cd backend && npm test` — Jest + Supertest contra una base MySQL aparte (`postulapp_test`, se recrea sola desde `schema.sql`). Cubren auth, validaciones, CRUD, filtros, aislamiento entre usuarios y estadísticas. Corren en GitHub Actions en cada push.

## API REST
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Devuelven un JWT (el resto de rutas lo exige en `Authorization: Bearer`) |
| GET | `/api/applications?q=&modality=&experience=&technology=&language=` | Lista con filtros |
| GET | `/api/applications/stats/monthly` | Postulaciones por mes |
| POST | `/api/applications` | Crea una postulación |
| PUT | `/api/applications/:id` | Actualiza campos (incluido `status`) |
| DELETE | `/api/applications/:id` | Elimina |

## Roadmap
- [x] CRUD + tablero con drag & drop + estadísticas + búsqueda
- [x] Autenticación (JWT) y usuarios (cada usuario ve solo lo suyo)
- [x] Filtros (modalidad, nivel, tecnología, idioma), seguimiento de entrevistas y evolución mensual
- [x] Tests de la API (Jest + Supertest) y CI con GitHub Actions
- [ ] Tests del frontend (Vitest) y flujos E2E (Playwright)
- [ ] Documentación OpenAPI
- [ ] Deploy (Vercel + backend con MySQL) y capturas en este README
