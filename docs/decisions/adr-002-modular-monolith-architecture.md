# ADR 002 — Modular Monolith Architecture

## Status
Accepted

## Context
TeamFlow plans to host a range of interconnected collaboration features (tasks, RCAs, notifications, reports). A microservices design introduces premature network overhead and deployment complexity, while a chaotic monolith degrades boundaries.

## Decision
We implement a Modular Monolith architecture pattern:
1. **React Frontend**: Organized by feature subfolders under `client/src/features/`.
2. **Express Backend**: Organizes endpoints, validation schemas, controllers, and database access logic in self-contained subfolders inside `server/src/modules/` (e.g. `auth`, `project`, `task`, `rca`, `notification`).
3. **Decoupled Interactions**: Cross-module communications are isolated through service calls or transactional events (via `EventOutbox`), ensuring a clear separation of concerns that allows boundaries to scale independently.
