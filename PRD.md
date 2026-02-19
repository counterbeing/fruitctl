You want a disciplined local capability broker, not “AI has root on my Mac.” Good. Let’s write this like you’re actually going to build it instead of vibe-coding a liability.

⸻

PRD: Local Apple Integration Gateway (LAIG)

1. Overview

A local TypeScript RPC server running on macOS that exposes strictly controlled, approval-gated capabilities for:
 • Things
 • Apple Reminders
 • Apple Calendar

It acts as a capability broker between Openclaw and macOS-native apps.

All mutating operations require explicit human approval (initially 100%).

⸻

2. Goals

Functional
 • Read/write:
 • Things
 • Reminders
 • Calendar
 • Structured validation
 • Clear error semantics usable by an agent
 • Audit logging
 • Approval workflow for every write
 • Discoverable “skills” contract

Non-Goals
 • No generic shell access
 • No filesystem browsing
 • No arbitrary AppleScript execution
 • No background silent mutation

⸻

3. High-Level Architecture

Openclaw (remote)
        ↓
Secure RPC (mTLS or Tailscale)
        ↓
LAIG (TypeScript server)
        ↓
Adapters:

- ThingsAdapter
- RemindersAdapter
- CalendarAdapter
        ↓
Native:
- Things URL / Shortcuts
- remindctl
- EventKit / AppleScript

⸻

4. Core System Components

4.1 Server Layer
 • Fastify or Express (Fastify preferred)
 • Zod for request validation
 • Strict route allowlist
 • JSON-only API
 • Append-only structured log

⸻

4.2 Approval Engine

All writes follow:
 1. Agent calls write endpoint
 2. Server validates + generates Proposal
 3. Proposal stored in local DB (SQLite)
 4. User approves via:
 • CLI
 • Web UI
 • macOS notification
 5. On approval → adapter executes

State machine:

PENDING → APPROVED → EXECUTED
       ↘ REJECTED

⸻

5. Functional Requirements

5.1 Things Integration

Integration method:
 • things:///add?... URL scheme
 • Optional: Shortcuts invocation

Read
 • list_projects
 • list_todos(project?)
 • get_todo(id)

Write (approval required)
 • create_todo
 • update_todo
 • complete_todo
 • delete_todo

Constraints
 • Optional allowlist of:
 • projects
 • tags

⸻

5.2 Reminders Integration

Integration method:
 • remindctl --json

Read
 • list_lists
 • list_reminders(list)
 • get_reminder(id)

Write (approval required)
 • add_reminder
 • update_reminder
 • complete_reminder
 • delete_reminder

Constraints
 • List-level allowlist (e.g. “Groceries” only for mutation)

⸻

5.3 Calendar Integration

Integration method:
 • EventKit wrapper OR AppleScript bridge

Read
 • list_calendars
 • list_events(range)
 • get_event(id)

Write (approval required)
 • create_event
 • update_event
 • delete_event

Constraints
 • Calendar-level allowlist
 • Max time range per query

⸻

6. API Design

6.1 Read Example

POST /reminders/list

Request:

{
  "list": "Groceries"
}

Response:

{
  "items": [
    {
      "id": "abc123",
      "title": "Milk",
      "completed": false
    }
  ]
}

⸻

6.2 Write Example

POST /things/create

Request:

{
  "title": "Call contractor",
  "project": "House",
  "tags": ["urgent"]
}

Response:

{
  "proposal_id": "p-1234",
  "status": "PENDING_APPROVAL"
}

⸻

6.3 Approval

POST /proposals/p-1234/approve

⸻

7. Validation Strategy
 • Zod schemas per endpoint
 • Enums for:
 • list names
 • calendar names
 • project names (optional cache)
 • Reject unknown fields
 • Max string lengths
 • Sanitize URLs
 • No arbitrary date math beyond reasonable window

⸻

8. Error Model (Agent-Friendly)

Structured error contract:

{
  "error": {
    "code": "LIST_NOT_ALLOWED",
    "message": "Writes to list 'Personal' are not permitted",
    "retryable": false,
    "details": {}
  }
}

Standard error codes:
 • VALIDATION_ERROR
 • NOT_FOUND
 • LIST_NOT_ALLOWED
 • CALENDAR_NOT_ALLOWED
 • PROPOSAL_NOT_FOUND
 • EXECUTION_FAILED
 • APPROVAL_REQUIRED

Errors must:
 • Never expose internal stack traces
 • Always return deterministic code

⸻

9. Skill Discovery Mechanism

Expose:

GET /skills

Returns machine-readable skill spec:

{
  "version": "1.0.0",
  "capabilities": [
    {
      "name": "create_reminder",
      "requires_approval": true,
      "params_schema": { ... }
    }
  ]
}

Auto-generated from:
 • Zod schemas
 • Route metadata

This allows Openclaw to dynamically ingest new capabilities after deploy.

Versioned.
Backward compatible.

⸻

10. Security Requirements
 • Bind to localhost OR Tailscale interface only
 • mTLS or signed JWT
 • Dedicated macOS user
 • No shell tool exposed
 • No dynamic execution
 • Append-only audit log
 • Rate limiting

⸻

11. Observability
 • Structured logs (JSON)
 • Proposal lifecycle logging
 • Adapter execution timing
 • Error frequency metrics

⸻

12. Storage

SQLite:

Tables:
 • proposals
 • audit_log
 • config (allowlists)

No external DB needed.

⸻

13. Future Extensions
 • Per-capability approval policy
 • Auto-approval for low-risk writes
 • Identity separation (run under Openclaw Apple ID)
 • iMessage integration
 • Per-user policy profiles

⸻

14. Risk Analysis

Primary risks:
 • Argument injection
 • URL scheme abuse
 • AppleScript surface expansion
 • Prompt injection leading to unsafe tool selection

Mitigations:
 • No generic execution endpoints
 • Strict parameter schemas
 • Approval gating
 • No filesystem exposure

⸻

15. Definition of Done (v1)
 • Can read/write:
 • Things
 • Reminders
 • Calendar
 • All writes require approval
 • Skill endpoint auto-generated
 • Errors deterministic
 • Audit log functional
 • No shell access exposed
 • Fully documented API schema

⸻

This is not a “toy integration.” This is a proper capability firewall around your Apple life.

And frankly, given how much you like control, this architecture will scratch that itch nicely.
