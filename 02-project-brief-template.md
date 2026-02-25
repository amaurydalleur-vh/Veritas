> ⚡ **FOR: Claude Projects (manual workflow via claude.ai)** — Not for the mini PC orchestrator.

# Project Brief — [Update This and Paste at Start of Every Conversation]

> **Instructions:** Fill this out once per project. Update it as things change. Paste it at the start of each new agent conversation alongside any handoff brief. This is your single source of truth — when something changes (new API, new dependency, restructured folders), update it here and nowhere else.

---

## Active Projects

### 1. [Project Name]
**What:** [One-sentence description of the project and what it does.]
**Stack:** [e.g., Next.js, React, TypeScript, Tailwind CSS. Deployed on Vercel.]
**Data sources:** [e.g., APIs, databases, third-party services the project relies on.]
**Key features:** [Top 3-5 features or capabilities.]
**Repo/deploy:** [GitHub URL and deployment URL]

### 2. [Project Name]
**What:** [One-sentence description.]
**Stack:** [Technologies used.]
**Infra:** [Infrastructure details — hosting, containers, etc.]
**Repo:** [GitHub URL]

<!-- Add more projects as needed. Remove this comment when filling in. -->

---

## Tech Stack Reference

| Layer | Technologies |
|-------|-------------|
| Frontend | [e.g., Next.js (App Router), React, TypeScript, Tailwind CSS, Vercel] |
| Backend | [e.g., Python 3.11+, Flask, Docker, Docker Compose] |
| Database | [e.g., PostgreSQL, Redis, SQLite] |
| APIs | [e.g., Alchemy, Etherscan, OpenAI, Stripe] |
| Tools | [e.g., VS Code, GitHub, Docker Desktop] |

---

## Current File Structure (Update As You Build)

> Paste or describe the current folder structure of whichever project you're working on. This helps agents understand what already exists.

```
[paste your current project tree here, e.g.:]
my-project/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── api/
│       └── ...
├── components/
│   └── ...
├── .env.local
├── package.json
└── ...
```

---

## Environment Variables in Use

> List all env vars currently in your .env files so agents don't create duplicates or use wrong names.

| Variable | Project | What It Does |
|----------|---------|-------------|
| `EXAMPLE_API_KEY` | [project-name] | [What this key is for] |
| `DATABASE_URL` | [project-name] | [Database connection string] |

---

## Recent Changes / Current State

> Update this section whenever you complete a significant piece of work. Agents read this to understand where things stand.

- **[Date]:** [What changed — e.g., "Deployed v1 of dashboard with live data"]
- **[Date]:** [What changed]
