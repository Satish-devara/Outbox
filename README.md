# Outbox — Production-Grade Email Scheduler

> A ReachInbox internship assignment — built with BullMQ + Redis + PostgreSQL + Elasticsearch + React.js

![Status](https://img.shields.io/badge/status-running-brightgreen)
![Backend](https://img.shields.io/badge/backend-Express%20%2B%20TypeScript-blue)
![Queue](https://img.shields.io/badge/queue-BullMQ%20%2B%20Redis-red)
![DB](https://img.shields.io/badge/db-PostgreSQL-blue)
![Search](https://img.shields.io/badge/search-Elasticsearch%208.11-yellow)
![Dashboard](https://img.shields.io/badge/dashboard-Bull%20Board%20UI-orange)
![Frontend](https://img.shields.io/badge/frontend-React.js%20%2B%20Vite%20%2B%20Tailwind-blue)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                           │
│                    React.js Dashboard (port 3000)               │
│               [Live BullMQ Dashboard @ port 3001/admin/queues]  │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────────┐
│                    Express.js Backend (port 3001)               │
│                                                                 │
│  POST /api/emails  ──▶  EmailService  ──▶  PostgreSQL           │
│                              │        ──▶  Elasticsearch Index  │
│                              │                                  │
│                              └──▶  BullMQ Queue                 │
│                                       │                         │
│                              Redis (persistent)                 │
│                                       │                         │
│                         BullMQ Worker (concurrency 5)           │
│                              │ (provider throttling delay)      │
│                              └──▶  Ethereal SMTP (multi-sender) │
│                              └──▶  Update DB & Elasticsearch    │
└─────────────────────────────────────────────────────────────────┘
```

### Why BullMQ + Redis (not cron)?

| Concern | Cron | BullMQ + Redis |
|---|---|---|
| Survives restarts | ❌ Jobs lost | ✅ Persisted in Redis |
| Exact scheduling | ❌ Nearest minute | ✅ Millisecond precision |
| Retry on failure | ❌ Manual | ✅ Built-in exponential back-off |
| Visibility | ❌ None | ✅ Queue stats + job state |
| Horizontal scale | ❌ Duplicates | ✅ Workers compete fairly |

---

## 📁 Project Structure

```
Outbox/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts      # PostgreSQL pool
│   │   │   └── redis.ts         # IORedis singleton
│   │   ├── queues/
│   │   │   └── emailQueue.ts    # BullMQ Queue + schedule/cancel helpers
│   │   ├── workers/
│   │   │   └── emailWorker.ts   # BullMQ Worker (sends via Ethereal)
│   │   ├── routes/
│   │   │   └── email.routes.ts  # Express router
│   │   ├── controllers/
│   │   │   └── email.controller.ts  # Zod-validated controllers
│   │   ├── services/
│   │   │   ├── email.service.ts # Business logic
│   │   │   └── smtp.service.ts  # Ethereal email sending
│   │   ├── models/
│   │   │   └── email.model.ts   # TypeScript interfaces
│   │   ├── middleware/
│   │   │   └── errorHandler.ts  # Centralised error handling
│   │   ├── migrations/
│   │   │   └── run.ts           # Idempotent DB migration
│   │   └── index.ts             # Bootstrap + graceful shutdown
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── index.html               # React mount root
│   ├── vite.config.ts           # Vite + Tailwind + proxy config
│   ├── src/
│   │   ├── App.tsx              # Main React dashboard & tabs
│   │   ├── main.tsx             # React DOM entrypoint
│   │   ├── index.css            # Tailwind CSS v4 styling & animations
│   │   ├── components/
│   │   │   ├── Header.tsx       # Top bar & live indicators
│   │   │   ├── QueueStats.tsx   # Live BullMQ metrics
│   │   │   ├── ScheduleForm.tsx # Schedule email with presets
│   │   │   └── EmailTable.tsx   # Email records, search & details
│   │   ├── lib/
│   │   │   ├── api.ts           # Typed API client
│   │   │   └── utils.ts         # Formatting & badge helpers
│   │   └── types/
│   │       └── email.ts         # Shared TypeScript interfaces
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker + Docker Compose

### 1. Clone the repo

```bash
git clone https://github.com/Satish-devara/Outbox.git
cd Outbox
```

### 2. Start infrastructure (Redis + PostgreSQL + Elasticsearch)

```bash
docker-compose up -d
```

### 3. Start the backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The backend will:
1. Connect to PostgreSQL
2. Run idempotent migrations (creates `emails` table)
3. Connect to Redis & register BullMQ queue
4. Connect to Elasticsearch & index schema
5. Mount live BullMQ dashboard at `/admin/queues`
6. Start HTTP server on port `3001`

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📡 API Reference

### Schedule an Email

```http
POST /api/emails
Content-Type: application/json

{
  "to": "test@example.com",
  "subject": "Hello from Outbox!",
  "body": "<h1>Hello!</h1><p>This email was scheduled via Outbox.</p>",
  "scheduledAt": "2026-10-25T12:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "to_address": "test@example.com",
    "subject": "Hello from Outbox!",
    "status": "scheduled",
    "scheduled_at": "2026-10-25T12:00:00.000Z",
    "job_id": "uuid",
    ...
  }
}
```

### List Emails

```http
GET /api/emails              # All emails
GET /api/emails?status=scheduled
GET /api/emails?status=sent
GET /api/emails?status=failed
```

### Get a Single Email

```http
GET /api/emails/:id
```

### Cancel a Scheduled Email

```http
DELETE /api/emails/:id
```

### Queue Stats

```http
GET /api/queue/stats

# Response:
{
  "success": true,
  "data": {
    "waiting": 0,
    "delayed": 3,
    "active": 1,
    "completed": 42,
    "failed": 0
  }
}
```

### Health Check

```http
GET /health
```

---

## 🔑 Key Design Decisions

### 1. BullMQ Delay-Based Scheduling

Instead of cron jobs, we use BullMQ's `delay` option:

```typescript
const delay = scheduledAt.getTime() - Date.now();
await queue.add('send-email', data, { delay, jobId: emailId });
```

The job sleeps in Redis until the exact millisecond — surviving server restarts because Redis is persistent.

### 2. Idempotent Job IDs

We use the PostgreSQL `email.id` (UUID) as the BullMQ `jobId`. This prevents duplicate jobs even if the API is called twice.

### 3. Graceful Shutdown

```typescript
process.on('SIGTERM', async () => {
  server.close(async () => {
    await stopEmailWorker(); // finish in-flight jobs
    await closeRedis();
    process.exit(0);
  });
});
```

### 4. Worker Auto-Recovery

On every startup, `startEmailWorker()` creates a new `Worker` instance that connects to Redis and automatically resumes processing any delayed/waiting jobs from the queue. No manual intervention needed.

### 5. Ethereal Email

Ethereal creates a disposable SMTP test account. Every sent email gets a preview URL (e.g., `https://ethereal.email/message/...`) stored in the DB, visible in the dashboard.

---

## 🖥 Dashboard Features

| Feature | Details |
|---|---|
| **Schedule Email** | Form with recipient, subject, HTML body, and datetime picker |
| **Scheduled tab** | Lists all pending emails with countdown, cancel button |
| **Sent tab** | Lists sent emails with Ethereal preview link |
| **Queue stats** | Live metrics: delayed, waiting, active, completed, failed |
| **Auto-refresh** | Stats every 5s, email lists every 8s |
| **Expandable rows** | Click ▼ to see full details, body preview, job ID |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend language | TypeScript (Node.js) |
| HTTP framework | Express.js |
| Queue | BullMQ |
| Queue store | Redis 7 (via ioredis) |
| Relational Database | PostgreSQL 15 (via pg) |
| Search Engine | Elasticsearch 8.11 (via @elastic/elasticsearch) |
| Live Dashboard | Bull Board (@bull-board/express) |
| Validation | Zod |
| SMTP | Ethereal Email (nodemailer) |
| Frontend | React.js 19 + Vite |
| Styling | Tailwind CSS v4 |
| Infra | Docker Compose |

---

*Built for the ReachInbox Software Development Internship Assignment.*
