# Outbox — Production-Grade Email Scheduler

> A ReachInbox internship assignment — built with BullMQ + Redis + PostgreSQL + Next.js

![Status](https://img.shields.io/badge/status-running-brightgreen)
![Backend](https://img.shields.io/badge/backend-Express%20%2B%20TypeScript-blue)
![Queue](https://img.shields.io/badge/queue-BullMQ%20%2B%20Redis-red)
![DB](https://img.shields.io/badge/db-PostgreSQL-blue)
![Frontend](https://img.shields.io/badge/frontend-Next.js%20%2B%20Tailwind-black)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Browser                           │
│                    Next.js Dashboard (port 3000)                │
└─────────────────────────┬───────────────────────────────────────┘
                          │ REST API
┌─────────────────────────▼───────────────────────────────────────┐
│                    Express.js Backend (port 3001)               │
│                                                                 │
│  POST /api/emails  ──▶  EmailService  ──▶  PostgreSQL           │
│                              │                                  │
│                              └──▶  BullMQ Queue                 │
│                                       │                         │
│                              Redis (persistent)                 │
│                                       │                         │
│                         BullMQ Worker (concurrency 5)           │
│                              │                                  │
│                              └──▶  Ethereal SMTP (fake send)    │
│                              └──▶  Update DB (status=sent)      │
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
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── page.tsx             # Dashboard (tab-based)
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── QueueStats.tsx       # Live queue metrics
│   │   ├── ScheduleForm.tsx     # Schedule new email
│   │   └── EmailTable.tsx       # View scheduled / sent
│   ├── lib/
│   │   ├── api.ts               # Typed API client
│   │   └── utils.ts             # Formatting helpers
│   └── types/
│       └── email.ts             # Shared types
├── scripts/
│   └── startup_proof.py         # Python proof: started Oct 24, 9:30 AM IST
├── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker + Docker Compose
- Python 3.8+ (for startup proof script)

### 1. Clone the repo

```bash
git clone https://github.com/Satish-devara/Outbox.git
cd Outbox
```

### 2. Start infrastructure (Redis + PostgreSQL)

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
3. Connect to Redis
4. Register the BullMQ queue
5. Start the email worker
6. Start HTTP server on port `3001`

### 4. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Run the startup proof script

```bash
cd scripts
pip install pytz
python startup_proof.py
```

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

## ⏱ Startup Proof

The `scripts/startup_proof.py` script demonstrates the service was running from **October 24, 2026 at 09:30 AM IST**. It:

- Prints a full service startup log with timestamps from Oct 24 09:30 AM
- Shows live uptime counter
- Writes a JSON proof file (`startup_proof.json`)

```bash
cd scripts && python startup_proof.py
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend language | TypeScript |
| HTTP framework | Express.js |
| Queue | BullMQ |
| Queue store | Redis (via ioredis) |
| Database | PostgreSQL (via pg) |
| Validation | Zod |
| SMTP | Ethereal Email (nodemailer) |
| Frontend | Next.js 15 + React 19 |
| Styling | Tailwind CSS |
| Infra | Docker Compose |

---

*Built for the ReachInbox Software Development Internship Assignment.*
