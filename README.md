# AI Development Team — Tier-Based Architecture (v3.0)

**Major Change from v2.5:** This is no longer a sequential pipeline. It's a **tier-based parallel workflow** that's 33% faster and matches professional development teams.

---

## Architecture Overview

```
TIER 1: DISCOVERY & PLANNING
System Architect → Product Manager

TIER 2: DESIGN & CONTRACTS (Parallel)
Designer ←→ API Architect

TIER 3: IMPLEMENTATION (Parallel)
Frontend Developer ←→ Backend Developer

TIER 4: QUALITY ASSURANCE (Sequential)
Security Auditor → System Tester

TIER 5: DEPLOYMENT
DevOps Engineer

TIER 6: DOCUMENTATION (Async - Runs Throughout)
Technical Writer
```

---

## Complete Agent Roster

### Core Pipeline Agents (10 Required)

| # | Agent | Tier | File | Role |
|---|-------|------|------|------|
| 1 | System Architect | Tier 1 | `03-system-architect.md` | Technical blueprint |
| 2 | Product Manager | Tier 1 | `04-product-manager.md` | Requirements breakdown |
| 3 | Designer | Tier 2 | `05-designer.md` | Design system, component specs |
| 4 | API Architect | Tier 2 | `06-api-architect.md` | API contracts, data schemas |
| 5 | Frontend Developer | Tier 3 | `07-frontend-developer.md` | UI implementation |
| 6 | Backend Developer | Tier 3 | `08-backend-developer.md` | API routes, business logic |
| 7 | Security Auditor | Tier 4 | `09-security-auditor.md` | Security review |
| 8 | System Tester | Tier 4 | `10-system-tester.md` | Integration testing |
| 9 | DevOps Engineer | Tier 5 | `11-devops-engineer.md` | Deployment automation |
| 10 | Technical Writer | Tier 6 | `12-technical-writer.md` | Documentation (async) |

---

## Why Tier-Based is 33% Faster

**Sequential (v2.5):** 30 hours (3 hours × 10 agents)
**Tier-Based (v3.0):** 12 hours (parallel work streams)

**Key improvement:** Designer + API Architect work simultaneously, Frontend + Backend implement in parallel.

---

## Setup

### 1. Create 10 Claude Projects

| Project | Custom Instructions |
|---------|-------------------|
| System Architect | `01-shared-context.md` + `03-system-architect.md` |
| Product Manager | `01-shared-context.md` + `04-product-manager.md` |
| Designer | `01-shared-context.md` + `05-designer.md` |
| API Architect | `01-shared-context.md` + `06-api-architect.md` |
| Frontend Developer | `01-shared-context.md` + `07-frontend-developer.md` |
| Backend Developer | `01-shared-context.md` + `08-backend-developer.md` |
| Security Auditor | `01-shared-context.md` + `09-security-auditor.md` |
| System Tester | `01-shared-context.md` + `10-system-tester.md` |
| DevOps Engineer | `01-shared-context.md` + `11-devops-engineer.md` |
| Technical Writer | `01-shared-context.md` + `12-technical-writer.md` |

### 2. Fill Out Project Brief

Copy `02-project-brief-template.md` and customize for your project.

### 3. Paste Brief at Start of Every Conversation

The project brief goes at the START of every new conversation with any agent.

---

## Workflow

```
TIER 1: Architect + PM (define what to build)
    ↓ Handoff Brief
TIER 2: Designer + API Architect (define how to build it - parallel)
    ↓ Handoff Briefs
TIER 3: Frontend + Backend (implement - parallel)
    ↓ Handoff Briefs
TIER 4: Security → Tester (verify - sequential for security)
    ↓ Handoff Brief
TIER 5: DevOps (deploy)
    ↓
TIER 6: Technical Writer (document - async throughout)
```

---

## Key Concepts

### Contract-Based Development

**API Architect** creates a contract that both Frontend and Backend implement:
- Endpoint definitions
- Request/response types
- Error handling
- Authentication

**Result:** No mismatched assumptions between teams.

### Security First

**Security Auditor runs BEFORE System Tester**. This is critical for DeFi:
- Catches vulnerabilities before functional testing
- Prevents shipping with security holes
- Non-negotiable for blockchain projects

### Async Documentation

**Technical Writer** documents as features complete:
- API contract done → Document API
- Component built → Document component
- Deployment complete → Document deployment

**Result:** Always-current documentation.

---

## When to Use Which Agents

### Small Project (4-6 hours)
- PM + API Architect + Frontend/Backend + Tester

### Medium Project (12-15 hours)
- Full pipeline with all 10 agents

### DeFi Project (15-20 hours)
- Full pipeline + Security Auditor is MANDATORY

---

## See Also

- Full documentation in this folder
- `advanced/guides/ARCHITECTURE_BLUEPRINT.md` for detailed tier information
- `QUICK_START.md` for 30-minute setup
