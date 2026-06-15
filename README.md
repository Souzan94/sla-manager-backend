# SLA Backend

A NestJS backend service that enforces SLA (Service Level Agreement) deadlines for Zendesk support tickets. It calculates business-hours-aware warning and breach datetimes, queues timed jobs via Bull/Redis, auto-creates Zendesk triggers and webhooks, and applies tags to tickets when SLA milestones are reached.

Built for **GROWON** as the backend for the SLA-APP Zendesk application.

---

## How It Works

1. Admin configures business hour schedules, holidays, and SLA rules in the Zendesk app (SLA-APP)
2. Creating an SLA rule triggers the backend to create two Zendesk triggers:
   - **Start trigger** — fires when a new ticket matches the rule; sends a webhook to schedule SLA jobs
   - **Breach trigger** — fires when a ticket is tagged as breached; sends the breach notification email
3. On startup, the backend also auto-creates three Zendesk webhooks (main, pause, resume) and two system triggers (pause + resume) for handling ticket on-hold/resume flows
4. When Zendesk fires the start webhook, the backend:
   - Loads the linked business hours schedule and holidays from the database
   - Calculates the **breach datetime** by counting forward through business hours (skipping closed days, weekends, and holidays)
   - Calculates the **warning datetime** by counting backward from the breach datetime
   - Queues two delayed jobs in the Bull/Redis queue: `warning` and `breach`
5. **On warning job fire**: checks if the ticket is already solved/closed — if not, adds tag `sla_warning_alert` to the ticket
6. **On breach job fire**: applies the configured breach tags to the ticket (if not already solved/closed)
7. Jobs can be **paused** (e.g., ticket put on hold) and **resumed** with the remaining delay preserved in the database
8. On server restart, the **SLA recovery service** re-queues any pending jobs from the database to prevent missed deadlines

---

## Modules

| Module | Responsibility |
|---|---|
| `auth` | Issues short-lived JWT tokens for the Zendesk frontend app |
| `webhooks` | Creates and manages Zendesk webhooks (SLA_MAIN, SLA_PAUSE, SLA_RESUME) on startup |
| `triggers` | Creates, updates, and deletes Zendesk triggers for SLA rules and system flows |
| `slarules` | CRUD for SLA rules; orchestrates trigger creation/deletion on rule save/delete |
| `schedules` | Business hour schedules — named weekly timetables with per-day open/close times |
| `holidays` | Holiday date ranges excluded from SLA time calculations |
| `sla-jobs` | Core SLA engine — computes warning/breach datetimes, queues Bull jobs, handles pause/resume |
| `scheduled-jobs` | Persists job state in PostgreSQL (pending / paused / completed) for recovery |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS (Node.js) |
| Language | TypeScript |
| Database | PostgreSQL (via TypeORM) |
| Queue | Bull + Redis |
| Date/Time | Day.js (UTC, timezone, isBetween plugins) |
| HTTP Client | Axios (Zendesk API calls) |
| Auth | JWT (`jsonwebtoken`) |
| Process Manager | PM2 (`ecosystem.config.js`) |
| Containerization | Docker Compose (PostgreSQL + Redis) |

---

## Database Entities

| Entity | Table | Purpose |
|---|---|---|
| `SlaRule` | `sla_rules` | SLA rule config: name, schedule, hours, tags, recipients, email, Zendesk trigger IDs |
| `Schedule` | `schedules` | Named business hour schedule with linked days |
| `ScheduleDay` | `schedule_days` | Per-day config: dayOfWeek, startTime, endTime, isWorkingDay |
| `Holiday` | `holidays` | Holiday date ranges |
| `Trigger` | `triggers` | Zendesk trigger IDs per domain |
| `Webhook` | `webhooks` | Zendesk webhook IDs per domain |
| `ScheduledJob` | `scheduled_jobs` | Job state: ticketId, type, executeAt, status, remainingDelayMs |

---

## Configuration

Create a `.env` file in the project root:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=sla_user
DB_PASSWORD=sla_password
DB_DATABASE=sla_db
TYPEORM_SYNCHRONIZE=true

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Zendesk
ZENDESK_SUBDOMAIN=your-subdomain
ZENDESK_EMAIL=admin@example.com
ZENDESK_API_TOKEN=your_zendesk_api_token

# Webhook endpoints (publicly reachable URLs for your backend)
WEBHOOK_ENDPOINT=https://your-domain.com/sla-jobs/schedule
PAUSE_WEBHOOK_ENDPOINT=https://your-domain.com/sla-jobs/pause
RESUME_WEBHOOK_ENDPOINT=https://your-domain.com/sla-jobs/resume

# Auth
JWT_SECRET=your_jwt_secret
```

---

## Running Locally

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Install dependencies
npm install

# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

---

## Project Structure

```
src/
├── main.ts
├── app.module.ts
├── auth/                    # JWT token endpoint
├── webhooks/                # Zendesk webhook management
├── triggers/                # Zendesk trigger management
├── slarules/                # SLA rule CRUD + trigger orchestration
├── schedules/               # Business hour schedules
├── holidays/                # Holiday management
├── sla-jobs/
│   ├── sla-jobs.service.ts  # SLA datetime calculation + job queuing
│   ├── sla-jobs.processor.ts # Bull queue processor: warning + breach handlers
│   └── sla-recovery.service.ts # Startup job recovery from DB
├── scheduled-jobs/          # Job state persistence
└── guards/                  # JWT auth guard
```

---

## Related

This service is the backend for the [SLA-APP](https://github.com/Souzan94/SLA-APP) Zendesk nav bar configuration app.

---

## License

Private — built for a client (GROWON).
