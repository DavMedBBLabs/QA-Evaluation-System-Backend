# QA Roadmap Quest – Backend

> Production-grade REST API that powers the **QA Roadmap Quest** platform. Built with TypeScript, Express and PostgreSQL, it delivers JWT-secured authentication, AI-driven question generation, multi-stage evaluations and granular progress tracking.

---

## ✨ Key Features

• **JWT Authentication** – short-lived access tokens with refresh flow  
• **AI Question Generator** – leverages OpenRouter LLMs to create open-text & multiple-choice questions on-the-fly  
• **Dynamic Evaluations** – multi-stage attempts, automatic scoring, individual feedback  
• **PostgreSQL + TypeORM** – typed entities & migrations  
• **Security Hardening** – Helmet, CORS, rate-limiting and structured error handling  
• **Modular Codebase** – clear separation of entities, routes, services & middleware

---

## 📦 Requirements

* Node.js ≥ 18 (LTS recommended)  
* PostgreSQL ≥ 13  
* An [OpenRouter](https://openrouter.ai/) API key (for AI generation)

---

## 🚀 Quick-start

```bash
# 1. Clone & install
$ git clone https://github.com/<your-org>/qa-roadmap-backend.git
$ cd qa-roadmap-backend
$ npm install

# 2. Configure environment
$ cp .env.example .env           # then edit the values

# 3. Generate DB schema & data
$ npm run db:migrate

# 4. Launch in development mode
$ npm run dev                    # nodemon + ts-node
```

Open `http://localhost:3001/health` to verify the server is running.

---

## 🔧 Environment Variables

All variables are required unless stated otherwise.

```env
DATABASE_URL=postgresql://user:password@localhost:5432/qa_roadmap
JWT_SECRET=super-long-and-random
OPENROUTER_API_KEY=sk-...
PORT=3001                       # optional – default 3001
NODE_ENV=development            # development | production
CORS_ORIGIN=http://localhost:3000
```

> Use **SSL mode** for managed Postgres services (Aiven, Supabase, …). The included TLS settings accept self-signed certs in dev but you should enforce proper certs in production.

---

## 🗂️ Project Structure (high-level)

```
src/
  config/         # DB & other runtime configs
  entities/       # TypeORM models
  middleware/     # auth, logger, error-handler, …
  routes/         # Express routers (auth, evaluations, …)
  services/       # external integrations (OpenRouter, …)
  migrations/     # SQL/TypeORM migration scripts
  server.ts       # app entrypoint
```

---

## 🛣️ Main Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST   | /api/auth/register | User sign-up |
| POST   | /api/auth/login    | Login & receive JWT |
| POST   | /api/auth/refresh  | Refresh access token |
| GET    | /api/questions/generate | AI-generate questions for a stage |
| POST   | /api/evaluations/start | Begin a new attempt |
| POST   | /api/evaluations/:attemptId/submit | Submit answers |
| GET    | /api/evaluations/attempts | Retrieve user’s attempt history |

A full, up-to-date Postman collection is provided in `docs/postman_collection.json` (coming soon).

---

## 🛠️ Scripts

| Script | Purpose |
|--------|---------|
| npm run dev      | Start development server (nodemon + ts-node) |
| npm run build    | Transpile TypeScript to `dist/` |
| npm start        | Run compiled JS (production) |
| npm run db:migrate | Build & execute latest migrations |

---

## ☁️ Deployment Guide

1. **Provision PostgreSQL** (managed service or self-hosted).  
2. Set all env vars on your host/CI provider.  
3. `npm ci && npm run build`  
4. Run migrations: `node dist/migrations/run-migrations.js`.  
5. Launch: `node dist/server.js` (or via PM2, Docker, etc.).

Docker & CI examples will be added in a future release.

---

## 🧑‍💻 Contributing

Bug reports and feature requests are welcome! Please open an issue or submit a pull request following the guidelines in **DEVELOPER_GUIDE.md**.

---

## 📄 License

MIT © 2025 QA Roadmap Quest Team