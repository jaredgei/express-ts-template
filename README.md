# Express.js + TypeScript Template

A lightweight, production-ready boilerplate for API services built with Express.js, TypeScript, and PostgreSQL using Drizzle ORM.

---

## 🚀 Quick Start

### 1. Database Setup

Start the local PostgreSQL database using Docker Compose:

```bash
docker compose up -d
```

### 2. Environment Variables

Verify your connection credentials in the `.env` file:

```env
PORT=8008
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/express_ts
```

### 3. Application Setup

Install dependencies and launch the hot-reloading development server:

```bash
npm install
npm run dev
```

---

## 🛠️ Database Migrations (Drizzle ORM)

All database models are located in standard TypeScript files under `src/models/` and registered in [src/models/index.ts](file:///Users/jared/Developer/express-ts/src/models/index.ts).

### Development Workflow Commands:

- **Schema Sync (Direct Push):** Instantly sync schema modifications directly to the database without generating SQL migration files (ideal for rapid development):

  ```bash
  npm run db:push
  ```

- **Generate SQL Migration:** Generate a schema migration file inside the `drizzle/` directory based on your TypeScript models:

  ```bash
  npm run db:generate
  ```

- **Apply SQL Migrations:** Apply all pending SQL migrations to the database:

  ```bash
  npm run db:migrate
  ```

- **Drizzle Studio (Visual DB Explorer):** Launch a local browser-based GUI to view and modify your database tables:
  ```bash
  npm run db:studio
  ```

---

## 💻 Commands Reference

- `npm run dev` — Starts the development server with nodemon and ts-node.
- `npm run typecheck` — Runs TypeScript compiler check (`tsc --noEmit`).
- `npm run lint` — Lints files with ESLint.
- `npm run format` — Formats files with Prettier.
