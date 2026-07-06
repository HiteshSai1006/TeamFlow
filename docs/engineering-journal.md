# Engineering Journal - TeamFlow Development

## 2026-07-04: Repository Setup & Foundation
*   **Problem**: Establish monorepo workspace for client and server.
*   **Decision**: Configured ESM imports on client and server. Set up PostgreSQL 15 in Docker.
*   **Verification**: Verified database handshakes and express route health parameters.

## 2026-07-04: JWT Authentication and Security
*   **Requirement**: Implement secure authentication layers.
*   **Decision**: Decided to use HttpOnly secure cookies containing JWT web tokens (commit `321f4e1`).
*   **Verification**: Route protection checks.

## 2026-07-04: Projects and Memberships
*   **Requirement**: Scope collaboration areas to projects with specific user roles.
*   **Decision**: Created `Project` and `ProjectMember` tables. Roles: `MEMBER`, `REVIEWER`, `MANAGER` (commit `321f4e1`).
*   **Verification**: Prohibited cross-project tasks and routes edits.

## 2026-07-04: Core Task Management
*   **Requirement**: Support priority, status, assignee, and due dates on tasks.
*   **Decision**: Created the `Task` model. Enforced transition paths: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE` (commit `321f4e1`).
*   **Verification**: Prohibited illegal status transitions.

## 2026-07-05: Incident Investigation and RCA Workflow
*   **Requirement**: Capture structured post-mortems with reviewer approvals.
*   **Decision**: Added `RCA` and `RCASection` models. An RCA cannot close until all reviewers submit approval comments (commit `321f4e1`).
*   **Verification**: Handled in `verify_rca.js` asserting reviewer counters.

## 2026-07-05: Unified Notifications and Transactional Outbox
*   **Requirement**: Asynchronous alert dispatch without dropping notifications.
*   **Decision**: Added `EventOutbox` and `Notification` models. Claims run in the background using `SKIP LOCKED` queries (commit `9667771`).
*   **Verification**: Handled in `verify_notifications.js` checking concurrent thread claims.

## 2026-07-05: Reports & Filtered CSV Export
*   **Requirement**: Export search results to CSV and render velocity graphs.
*   **Decision**: Staged CSV stream exports matching active search filters (commit `d90f522` and `7201679`).
*   **Verification**: Executed in `verify_export.js` and `verify_reports.js`.

## 2026-07-05: Visualisation Modes & Persisted View Preferences
*   **Requirement**: Provide Kanban, Calendar, and List layouts that persist.
*   **Decision**: Created `ProjectViewPreference` database model to store tab selection states per user per project (commit `31eb1d1`).
*   **Verification**: Executed in `verify_preferences.js`.

## 2026-07-05: Theme Customisation & UI Polish
*   **Requirement**: Toggle light/dark themes instantly and fix visual backdrops.
*   **Decision**: Set `UserPreference.theme` and set CSS transitions for modern glassmorphic look (commit `53a2dc1` and `94cf8e6`).
*   **Verification**: Executed in `verify_theme.js`.

## 2026-07-06: Task Hierarchy and Parent Tasks
*   **Requirement**: Optional parent task and subtask hierarchy.
*   **Decision**: Implemented `parentId` self-relations. Validated cycles inside transaction scopes using a visited-Set ancestor loop checker (commit `e16ad37`).
*   **Verification**: Handled in `verify_hierarchy.js` proving loop blocks and project bounds.
