# TeamFlow — Database schema (Prisma)

This document summarizes the database schema defined in `server/prisma/schema.prisma` and the available migration files under `server/prisma/migrations`.

## Datasource & Generator
- Datasource: PostgreSQL (env: `DATABASE_URL`).
- Prisma client generator: `prisma-client-js`.

## Migrations (chronological)
- 20260705000000_init_auth
- 20260705010000_init_projects
- 20260705020000_align_project_domain
- 20260705030000_add_task_management
- 20260705040000_add_task_relations
- 20260705050000_add_task_comments
- 20260705060000_add_task_attachments
- 20260705070000_add_rca_workflow
- 20260705080000_add_notifications
- 20260706093000_add_project_view_preferences
- 20260706100000_rename_preferences_to_user_preferences
- 20260706110000_add_comment_mentions
- 20260706120000_add_task_hierarchy

## High-level model groups

1) Authentication & Users
- `User`: primary account record with `id`, `name`, `email` (unique), `passwordHash`, `systemRole`, timestamps.
- `SystemRole` enum: `ADMIN`, `MEMBER`.

2) Projects & Memberships
- `Project`: `id`, `name`, optional `description`, `status` (`ACTIVE`/`ARCHIVED`), creator relation, timestamps.
- `ProjectMember`: links `User` and `Project` with `role` (enum `MANAGER`/`MEMBER`/`REVIEWER`) and unique constraint on (`projectId`, `userId`).

3) Tasks, Relations, Hierarchy
- `Task`: belongs to a `Project`; contains `title`, `description`, `status` (enum `TODO`/`IN_PROGRESS`/`BLOCKED`/`DONE`), `priority`, optional `assignee`, optional `parentId` for hierarchy, timestamps.
- `TaskRelation`: explicit dependency edges between tasks (`sourceTaskId`, `targetTaskId`) with `BLOCKS` relation and unique constraint on (source, target).
- Parent-child relationship implemented by `parentId` with index on `parentId` and `onDelete: SetNull`.

4) Activity / Audit
- `ActivityLog`: records project/task events, `actorId`, `eventType` (enum) and `metadata` (JSON). Written atomically with state changes.

5) Comments, Mentions, Attachments
- `Comment`: references `Task` and `User`, content, edit timestamps, and relation to `CommentMention`.
- `CommentMention`: links `Comment` -> `User` with unique constraint per comment/user.
- `Attachment`: stored with `storageKey` (unique), original filename, mime type, size, uploader and created timestamp.

6) RCA (Root Cause Analysis)
- `RCA`: project-scoped RCA artifact with `severity`, `status` (`DRAFT`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `CLOSED`), `reviewRound`, relations to `RCASection` and `Review`.
- `RCASection`: typed sections (`TIMELINE`, `CONTRIBUTING_FACTORS`, `CORRECTIVE_ACTIONS`, `PREVENTIVE_MEASURES`) with unique constraint per (`rcaId`, `type`).
- `Review`: reviewer rows per round with `decision` and optional comment; unique (`rcaId`, `reviewerId`, `round`).

7) Notifications & Outbox
- `EventOutbox`: transactional outbox rows storing `eventType`, `entityId`, `actorId`, immutable `metadata` (JSON), and processing state with an index on `(processingState, createdAt)`.
- `Notification`: per-recipient delivery record with `dedupKey`, `emailState`, delivery attempts and indexes to support fetch by recipient and state.

8) Preferences & Views
- `UserPreference`: per-user settings (theme, `emailOptOut`) tied to `userId` (unique).
- `ProjectViewPreference`: per-user per-project `viewMode` with unique constraint on (`userId`, `projectId`).

## Notable constraints & indexes
- Unique constraints: `User.email`, `ProjectMember(projectId,userId)`, `TaskRelation(source,target)`, `CommentMention(commentId,userId)`, `Notification(recipientId,dedupKey)`, `ProjectViewPreference(userId,projectId)`.
- Indexes: `Task.parentId`, `EventOutbox(processingState, createdAt)`, `Notification(recipientId,createdAt)`, `Notification(recipientId,read)`, `Notification(emailState, claimedAt)`.
- Cascading rules: Task/project/member and relations apply `onDelete: Cascade` for many relations; certain relations use `Restrict` or `SetNull` to preserve history.

## How to view the authoritative schema
- Primary schema file: `server/prisma/schema.prisma`.
- Migration SQL and history: `server/prisma/migrations/<migration_name>/migration.sql`.

## Suggested next steps
- Add ERD diagram exported from Prisma or a DB tool to `docs/diagrams/`.
- Generate a flattened SQL schema snapshot for release notes: `npx prisma migrate resolve` and export SQL.

---
Generated from `server/prisma/schema.prisma` (July 2026).
