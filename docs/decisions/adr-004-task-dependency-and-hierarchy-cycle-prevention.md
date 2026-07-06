# ADR 004 — Task Dependency and Hierarchy Cycle Prevention

## Status
Accepted

## Context
A task in TeamFlow can have optional subtasks (a parent-child hierarchy) and can also block or be blocked by other tasks (dependencies). Combining these relationship types or allowing cycles (e.g. Task A blocking itself or Task A being a parent of its parent) corrupts project schedule data.

## Decision
We decouple hierarchies and dependencies into distinct schemas, enforcing cycle prevention in transactions.

### Key Rules
1. **Decoupled Relational Models**:
   - **TaskHierarchy**: Modeled via a self-referencing nullable `parentId` relation directly on the `Task` model.
   - **TaskRelation**: Modeled via a separate table mapping `sourceTaskId` to `targetTaskId` with type `BLOCKS`.
2. **Cycle Prevention**:
   - **Task Relations**: Breadth-first search traverses the dependency links to ensure adding a relationship does not form a loop.
   - **Task Hierarchy**: On updating `parentId`, the system walks up parent nodes using a visited set to detect loops.
3. **Transaction Scopes**: All lookups and validations run inside a database transaction (`tx`) to prevent race conditions from concurrent updates.
4. **Project Isolation**: Cycle checkers validate relationships within the same project. Attempting cross-project parenting blocks with a `400 Bad Request`.
