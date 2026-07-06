# AI-Agent Build-Process Documentation

This document describes how AI coding agents were utilized alongside human guidance to implement, audit, and polish the TeamFlow codebase.

## Development Workflow
1. **Human-Directed Requirements & Approvals**: Every feature implementation plan (e.g. mentions, task visualisations, or subtask hierarchies) required explicit, stage-by-stage approval before code was modified.
2. **Structural Research and Codebase Inspection**: Agents scanned existing code structures and database schema files before drafting implementation plans to prevent structural regression.
3. **Staged Implementation Plans**: Features were designed in logical components (database migrations first, then backend validation schemas, controllers, frontend views, and verification tests).
4. **Verification Suites**: Independent verification files (`verify_*.js`) were run to validate correctness on both new features and existing regressions.
5. **Git Diff and Formatting Checks**: Staged diff formatting was checked for trailing whitespaces (`git diff --check` and `git diff --cached --check`) before committing.

## Key Human Inspections & Critical Corrections
* **Hierarchy Cycles Resolution**: Early implementation plans proposed recursive cycle traversal using standard database lookups. Human review redirected this to use an explicit visited-Set algorithm running inside the transaction client (`tx`) to prevent database deadlock states.
* **Storage Realism**: While conceptual documents requested object storage integration, human review verified local filesystem mock drivers were preferred to match test environment setups.

## Limitations of AI-Generated Code
* AI agents can introduce boilerplate discrepancies if paths or configurations are not checked against the live system.
* Complex integration states and dependency lockfiles require detailed review to prevent version mismatches.
* Automated tests verify logic rules, but overall visual layout flow and responsiveness requires manual inspection at target viewport resolutions.
