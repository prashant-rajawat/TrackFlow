# TrackFlow — Bug Tracking & Issue Management SaaS (Phases 1–8)

TrackFlow is a production-grade, human-centered SaaS web application engineered for modern software and product teams to track bugs, manage work, collaborate, and streamline delivery workflows. Inspired by the speed, clarity, and ergonomic quality of platforms like Linear and Jira, TrackFlow prioritizes high signal-to-noise design, strict typography, robust security, and reliable full-stack architecture.

---

## 1. Project Introduction

TrackFlow delivers a complete full-stack SaaS platform featuring:
- **Phase 1 Foundations**: Authoritative MongoDB persistence, full-stack authentication, JWT sessions with server revocation, password encryption via bcrypt, responsive SaaS shell, and design system.
- **Phase 2 Collaboration & Multi-Tenancy**: Dynamic workspace management, live slug generation, role-based access control (OWNER, ADMIN, MEMBER, VIEWER), Last Owner Protection, team member directory, atomic ownership transfer, and cryptographic email invitation workflows.
- **Phase 3 Project Management**: Workspace-scoped projects with unique keys, project-level roles (`PROJECT_ADMIN`, `DEVELOPER`, `VIEWER`), archive/restore lifecycle, and last-admin protection.
- **Phase 3.1 Production Safety Hardening**: Strict separation between production MongoDB enforcement and explicit opt-in development memory mode, opt-in idempotent dev demo seeding, hardened CORS origin checks, and same-site cookie defaults.
- **Phase 4 Issue & Ticket Management**: Project-scoped and workspace-wide issue tracking with atomic per-project sequential keys (`KEY-1`, `KEY-2`), full CRUD + quick status/priority/assignee endpoints, project-member assignee verification, mass-assignment protection, and responsive issue list/details UI.
- **Phase 5 Interactive Kanban Board**: Workspace-wide (`/board`) and project-scoped (`/projects/:projectId/board`) drag-and-drop Kanban boards built with `@dnd-kit/core`, supporting Pointer, Touch, and column-stepping Keyboard navigation, optimistic status transitions with API rollback, per-project RBAC read-only enforcement, slide-over issue detail drawers, and live search/project/priority/assignee filtering.
- **Phase 6 Issue Comments & Collaboration**: Threaded issue discussions integrated across Issue Details pages (`/issues/:issueId`, `/projects/:projectId/issues/:issueId`) and the Kanban `KanbanIssueDrawer`, supporting top-level comments, 1-level chronological replies (`parentCommentId`), inline editing (`editedAt`), content-redacted soft deletion (`deletedAt`) preserving replies, chronological sorting/load-more pagination, and `VIEWER` / `DEVELOPER` / `PROJECT_ADMIN` RBAC enforcement.
- **Phase 7 Advanced Search, Filtering, Sorting & Pagination**: Server-side query validation, regex-safe keyword search across issue keys/titles/descriptions/assignees/reporters, multi-value OR/AND filters (`status`, `priority`, `type`, `assigneeId` including `UNASSIGNED`, `reporterId`, `projectId`, due date presets & ranges, created date ranges), semantic priority/status sorting with deterministic pagination, URL query parameter synchronization (`useSearchParams`), debounced search with stale-request cancellation, active filter chips, and `ProjectDetailsPage` Issues tab integration.
- **Phase 8 RBAC Hardening & Issue File Attachments**: Unified `PermissionService` matrix across projects, issues, comments, and attachments; environment-aware attachment storage abstraction (`S3StorageAdapter`, `SupabaseStorageAdapter`, development `LocalDevStorageAdapter`, fail-closed `UnconfiguredStorageAdapter` in production); magic-byte + MIME + extension + path-traversal validation; idempotent uploads with rollback; secure `nosniff` authenticated file serving; and frontend `AttachmentSection`, `AttachmentPreviewModal`, `DeleteAttachmentDialog`, and permission-aware Project/Issue UI controls.

---

## 2. Project Objectives

- **High-Integrity Foundations**: Provide a real, enterprise-grade full-stack Node.js + Express + React + TypeScript web application with zero mock data and no fake buttons.
- **Permanent UI/UX Design System**: Enforce the universal SaaS design constitution (zero-pill metadata, single-elevation surfaces, legible type scales, WCAG 2.2 AA accessibility, responsive viewports from 320px to 1440px+).
- **Secure Authentication Slice**: Implement cryptographically secure registration, login, session persistence, and logout with server-side validation.
- **Transparent Roadmap & State Separation**: Clearly separate active implemented features from planned future phases with dedicated branded "Coming Soon" pages and distinct 404 error handling.

---

## 3. Features & Use Cases

- **User Registration**: Create an account with name, validated email, and minimum-security password with live visual requirement verification.
- **User Authentication**: Secure sign-in with email and password, issuing 7-day JWT credentials via HTTP-only cookie and Bearer tokens.
- **Session Persistence & Retrieval**: `/api/auth/me` verifies existing browser sessions automatically on page load and window refresh.
- **Secure Sign Out**: Clears cookies and purges client session state.
- **System Health Telemetry**: Live check (`/api/health`) reporting database connectivity, operational status, and server uptime.
- **Responsive SaaS Shell**: Collapsible sidebar, mobile navigation drawer, workspace context modal, and profile dropdown menu.
- **Dashboard Getting Started**: Phase-driven onboarding guidance and honest zero-metric empty states.

---

## 4. Technology Stack & Rationale

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | Component-driven architecture, strict compile-time type safety. |
| **Bundler & Dev Server** | Vite 8 | Near-instant startup, ES modules, modern asset pipeline. |
| **Styling** | Tailwind CSS v4 | Utility-first CSS, custom dark mode variant, zero CSS bundle bloat. |
| **Drag & Drop** | `@dnd-kit/core` | Accessible Pointer, Touch, and Keyboard Kanban board interactions. |
| **Routing** | React Router v7 | Declarative nested routing, public/protected route barriers. |
| **Icons** | Lucide React | Consistent, lightweight, accessible SVG icon library. |
| **Validation** | Zod v4 | Declarative schema validation shared between client and server. |
| **Backend Runtime** | Node.js + Express | Battle-tested REST API server, flexible middleware composition. |
| **Database & ODM** | MongoDB + Mongoose 9 | Schemas, pre-save hooks, unique indexes, and document persistence. |
| **Security & Auth** | BcryptJS + JWT + Helmet | Salted password hashing, tamper-proof session tokens, security headers. |
| **Testing** | Vitest + Supertest | Blazing fast ESM test runner and end-to-end HTTP endpoint assertions. |

---

## 5. Project Architecture

TrackFlow uses a unified full-stack architecture where a root Express server (`server.ts`) handles API routes (`/api/*`) and mounts Vite development middleware in dev mode, or serves the compiled production SPA bundle (`dist/`) in production.

```
                          ┌───────────────────────────┐
                          │    Browser Client (SPA)   │
                          │   React 19 + TypeScript   │
                          └─────────────┬─────────────┘
                                        │ HTTP / Cookie (Credentials: include)
                                        ▼
                          ┌───────────────────────────┐
                          │    Express Server (3000)  │
                          │    Helmet + CORS + JWT    │
                          └──────┬─────────────┬──────┘
                                 │             │
                  ┌──────────────┴──────┐      └────────────────┐
                  ▼                     ▼                       ▼
          /api/auth Routes      /api/health Route         Vite Middlewares
          (Register, Login,      (DB & Server State)      (Dev SPA / dist)
           Me, Logout)
                  │
                  ▼
          Model Adapters (User, Workspace, Project, Invitation, RevokedToken)
               ┌────────────────────┼────────────────────┐
               ▼                    ▼                    ▼
      MongoDB / Mongoose     In-Memory Adapter    503 Degraded / Throw
      (Prod + Dev w/ URI)    (Explicit Dev/Test)  (Prod w/o URI or Disconnected)
```

---

## 6. Folder Structure

```
├── .env.example                  # Environment variable configuration template
├── index.html                    # HTML entry point with Plus Jakarta Sans & JetBrains Mono
├── metadata.json                 # AI Studio applet metadata
├── package.json                  # Scripts and dependencies
├── server.ts                     # Root full-stack server entry point (Express + Vite)
├── tsconfig.json                 # TypeScript compiler configuration
├── vite.config.ts                # Vite configuration with path aliases
│
├── server/                       # Backend Source Code
│   └── src/
│       ├── app.ts                # Express application setup, Helmet, CORS, cookie parser
│       ├── config/
│       │   └── db.ts             # MongoDB Mongoose connection and status tracking
│       ├── controllers/
│       │   └── auth.controller.ts# Register, login, getMe, logout logic
│       ├── middleware/
│       │   ├── auth.middleware.ts# JWT extraction (cookie & bearer), requireAuth guard
│       │   └── error.middleware.ts# Global error and 404 JSON handlers
│       ├── models/
│       │   └── User.ts           # Mongoose User schema, pre-save bcrypt hook, memory adapter
│       ├── routes/
│       │   ├── auth.routes.ts    # /api/auth endpoints
│       │   └── health.routes.ts  # /api/health endpoint
│       └── validators/
│           ├── auth.validator.ts # Zod registration and login validation schemas
│           ├── issue.validator.ts# Issue mutation validation schemas
│           └── issueQuery.validator.ts # Issue search, filter, sort & pagination query validation
│
├── src/                          # Frontend Source Code
│   ├── App.tsx                   # Main React component with providers
│   ├── index.css                 # Tailwind CSS v4 imports and font definitions
│   ├── main.tsx                  # React DOM render entry
│   ├── components/
│   │   ├── attachments/          # AttachmentSection, AttachmentPreviewModal, DeleteAttachmentDialog
│   │   ├── board/
│   │   │   ├── KanbanBoard.tsx   # @dnd-kit DndContext, Pointer/Touch/Keyboard sensors, mobile tabs
│   │   │   ├── KanbanCard.tsx    # Draggable card with dedicated GripVertical handle & lock guard
│   │   │   ├── KanbanColumn.tsx  # Droppable workflow column (TODO, IN_PROGRESS, DONE)
│   │   │   └── KanbanIssueDrawer.tsx # Slide-over details drawer wrapping IssueDetailsPanel
│   │   ├── comments/             # CommentSection, CommentComposer, CommentItem, CommentReply, CommentActions, CommentSkeleton, DeleteCommentDialog
│   │   ├── common/
│   │   │   ├── Button.tsx        # Standardized accessible button (zero-pill)
│   │   │   └── Input.tsx         # Accessible input with error state and password toggle
│   │   ├── feedback/
│   │   │   ├── EmptyState.tsx    # Domain empty state with action buttons
│   │   │   └── LoadingSkeleton.tsx # Skeleton placeholders
│   │   ├── issues/               # CreateIssueModal, IssueForm, IssueList, IssueDetailsPanel, DeleteIssueDialog, IssueSearchBar, IssueFilterPanel, ActiveFilterChips, IssueSortDropdown, IssuePagination, IssueResultsSummary, IssueSearchEmptyState, IssueDiscoveryToolbar
│   │   └── layout/
│   │       ├── AppShell.tsx      # Responsive desktop/mobile SaaS application layout
│   │       ├── Header.tsx        # Top Bar contract with breadcrumbs and user menu
│   │       └── Sidebar.tsx       # Implemented & planned Phase 1-10 navigation items
│   ├── context/
│   │   ├── AuthContext.tsx       # Session state, login, register, logout hooks
│   │   ├── ToastContext.tsx      # Accessible toast notifications
│   │   └── WorkspaceContext.tsx  # Multi-tenant active workspace context & switcher
│   ├── pages/
│   │   ├── auth/                 # LoginPage, RegisterPage
│   │   ├── board/
│   │   │   └── KanbanBoardPage.tsx # Global (/board) & Project (/projects/:projectId/board) controller
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx # Authenticated dashboard with workspace & project/issue overview
│   │   ├── feedback/
│   │   │   ├── ComingSoonPage.tsx# Dedicated roadmap feature preview page
│   │   │   └── NotFoundPage.tsx  # Distinct 404 error page
│   │   ├── issues/               # IssuesPage (URL-synced discovery), IssueDetailsPage
│   │   └── projects/             # ProjectsPage, ProjectDetailsPage (with discovery-enabled Issues tab)
│   ├── routes/
│   │   ├── AppRoutes.tsx         # Central route switch
│   │   ├── ProtectedRoute.tsx    # Auth guard with skeleton loader
│   │   └── PublicRoute.tsx       # Redirection guard for authenticated users
│   ├── services/                 # api.ts, auth/workspace/project/issue/comment services
│   ├── types/                    # auth, workspace, project, issue, comment interfaces
│   └── utils/
│       ├── boardFilters.ts       # Pure Kanban search, priority, assignee, grouping helpers
│       └── issueQuery.ts         # URLSearchParams sync, preset bounds & active chip utilities
│
└── tests/                        # Automated Test Suites
    ├── backend/
    │   ├── auth.test.ts          # Auth API tests (11 tests)
    │   ├── board.test.ts         # Kanban status transitions, RBAC, 503 & workflow tests (6 tests)
    │   ├── comment.test.ts       # Comment CRUD, 1-level replies, RBAC, soft delete & workflow tests (10 tests)
    │   ├── issue.test.ts         # Issue CRUD & sequence concurrency tests (16 tests)
    │   ├── issue_search.test.ts  # Search, multi-filter, semantic sort, pagination & security tests (6 suites)
    │   ├── project.test.ts       # Project & ProjectMember RBAC tests (7 tests)
    │   ├── rbac_and_attachments.test.ts # Phase 8 RBAC matrix, upload validation, magic bytes, rollback & storage tests
    │   ├── safety_and_db.test.ts # DB mode, CORS, cookie & seeding safety tests (11 tests)
    │   └── workspace_and_rbac.test.ts # Multi-tenant RBAC, invites & ownership transfer (19 tests)
    └── frontend/
        ├── attachments_and_rbac.test.tsx # Phase 8 AttachmentSection, preview, download, delete & Project/Issue RBAC tests
        ├── board.test.tsx        # Kanban UI, dnd-kit keyboard drag, rollback & filters (7 tests)
        ├── comment.test.tsx      # CommentSection, composer validation, replies, edit, delete & RBAC tests (7 tests)
        ├── issue.test.tsx        # IssueForm, CreateIssueModal, IssueList & Details tests (7 tests)
        ├── issue_search.test.tsx # Search debounce, filters, chips, sort, pagination & URL sync tests (4 tests)
        ├── navigation.test.ts    # Sidebar configuration and separation tests (2 tests)
        └── validation.test.ts    # Zod form validation contract tests (5 tests)
```

---

## 7. Database Design

### User Collection (`users`)
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `_id` / `id` | ObjectId / String | Yes | Primary Key | Unique user identifier. |
| `fullName` | String | Yes | Min 2, Max 100 chars | User's full display name. |
| `email` | String | Yes | Unique index, Lowercase | Valid work email address. |
| `passwordHash` | String | Yes | Bcrypt hash (salt 10) | Securely salted password hash. |
| `avatarUrl` | String | No | Default: `""` | User avatar image URL. |
| `role` | String | Yes | Enum: `'user'`, `'admin'` | Global account role. |
| `createdAt` | Date | Auto | Timestamps | Account creation timestamp. |
| `updatedAt` | Date | Auto | Timestamps | Last update timestamp. |

### Workspace Collection (`workspaces`)
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `_id` / `id` | ObjectId / String | Yes | Primary Key | Unique workspace identifier. |
| `name` | String | Yes | Min 2, Max 60 chars | Workspace name. |
| `slug` | String | Yes | Unique index, Lowercase, alphanumeric + hyphen | URL slug identifier. |
| `description` | String | No | Max 300 chars | Optional workspace description. |
| `ownerId` | ObjectId | Yes | Ref: `User` | User ID of the workspace creator. |
| `createdAt` | Date | Auto | Timestamps | Creation timestamp. |
| `updatedAt` | Date | Auto | Timestamps | Last update timestamp. |

### WorkspaceMember Collection (`workspacemembers`)
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `_id` / `id` | ObjectId / String | Yes | Primary Key | Unique membership record identifier. |
| `workspaceId` | ObjectId | Yes | Ref: `Workspace`, Indexed | Workspace ID. |
| `userId` | ObjectId | Yes | Ref: `User`, Indexed | User ID. |
| `role` | String | Yes | Enum: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER` | Workspace role. |
| `joinedAt` | Date | Yes | Default: `Date.now` | Date member joined. |
| *(Index)* | Compound | Yes | `{ workspaceId: 1, userId: 1 }` (Unique) | Enforces single membership per user per workspace. |

### Invitation Collection (`invitations`)
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `_id` / `id` | ObjectId / String | Yes | Primary Key | Unique invitation identifier. |
| `workspaceId` | ObjectId | Yes | Ref: `Workspace`, Indexed | Workspace ID. |
| `invitedEmail`| String | Yes | Lowercase, Valid email | Recipient work email. |
| `inviterId` | ObjectId | Yes | Ref: `User` | Member who issued invitation. |
| `role` | String | Yes | Enum: `ADMIN`, `MEMBER`, `VIEWER` | Assigned role on acceptance. |
| `tokenHash` | String | Yes | Unique SHA256 hex string | Hashed secret token (raw token never stored). |
| `status` | String | Yes | Enum: `PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED` | Invitation lifecycle status. |
| `expiresAt` | Date | Yes | Default: 7 days | Expiration timestamp. |
| `acceptedAt` | Date | No | Timestamp | Acceptance timestamp. |

### Issue Collection (`issues`)
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `_id` / `id` | ObjectId / String | Yes | Primary Key | Unique issue identifier. |
| `title` | String | Yes | Trimmed, Min 3, Max 120 | Issue summary title. |
| `description` | String | Yes | Trimmed, Min 1, Max 10000 | Detailed issue description. |
| `issueKey` | String | Yes | Unique index, Uppercase (`KEY-1`) | Atomic per-project sequential issue key. |
| `projectId` | ObjectId | Yes | Ref: `Project`, Indexed | Parent project identifier. |
| `workspaceId` | ObjectId | Yes | Ref: `Workspace`, Indexed | Parent workspace identifier. |
| `reporterId` | ObjectId | Yes | Ref: `User`, Indexed | Server-derived authenticated creator ID. |
| `assigneeId` | ObjectId \| null | No | Ref: `User`, Indexed, Default: `null` | Active project member assigned to issue. |
| `type` | String | Yes | Enum: `BUG`, `FEATURE`, `TASK` | Classification type (`BUG` default). |
| `priority` | String | Yes | Enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` | Severity/urgency (`MEDIUM` default). |
| `status` | String | Yes | Enum: `TODO`, `IN_PROGRESS`, `DONE` | Workflow status (`TODO` default). |
| `dueDate` | Date \| null | No | Default: `null` | Optional target due date. |
| *(Indexes)* | Compound | Yes | `{ projectId: 1, createdAt: -1 }`, `{ workspaceId: 1, createdAt: -1 }`, `{ workspaceId: 1, updatedAt: -1 }`, `{ projectId: 1, status: 1, updatedAt: -1 }`, `{ projectId: 1, priority: 1, updatedAt: -1 }`, `{ workspaceId: 1, status: 1, updatedAt: -1 }`, `{ projectId: 1, assigneeId: 1, updatedAt: -1 }`, `{ projectId: 1, dueDate: 1 }` | Fast filtered, sorted, and paginated listing within project & workspace. |

### Comment Collection (`comments`)
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `_id` / `id` | ObjectId / String | Yes | Primary Key | Unique comment identifier. |
| `issueId` | ObjectId | Yes | Ref: `Issue`, Indexed | Parent issue identifier. |
| `projectId` | ObjectId | Yes | Ref: `Project`, Indexed | Parent project identifier (server-derived). |
| `workspaceId` | ObjectId | Yes | Ref: `Workspace`, Indexed | Parent workspace identifier (server-derived). |
| `authorId` | ObjectId | Yes | Ref: `User`, Indexed | Server-derived authenticated author ID. |
| `parentCommentId` | ObjectId \| null | No | Ref: `Comment`, Indexed, Default: `null` | Top-level parent comment ID (strictly 1-level replies). |
| `content` | String | No | Trimmed, Max 2000 chars | Comment body (redacted to `""` on soft delete). |
| `editedAt` | Date \| null | No | Default: `null` | Last edit timestamp. |
| `deletedAt` | Date \| null | No | Default: `null` | Soft-deletion timestamp preserving reply thread structure. |
| *(Indexes)* | Compound | Yes | `{ issueId: 1, createdAt: 1 }`, `{ projectId: 1, createdAt: 1 }`, `{ workspaceId: 1, createdAt: 1 }`, `{ parentCommentId: 1, createdAt: 1 }` | Chronological issue threads, cascade cleanup, and reply lookups. |

### Attachment Collection (`attachments`)
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `_id` / `id` | ObjectId / String | Yes | Primary Key | Unique attachment identifier. |
| `originalName` | String | Yes | Sanitized, Max 255 chars | Original uploaded filename. |
| `storedFileName` | String | Yes | Internal UUID name, Hidden in DTOs | Random server-generated stored filename. |
| `fileExtension` | String | Yes | `png`, `jpg`, `webp`, `pdf`, `txt`, `csv`, `docx`, `xlsx` | Validated canonical file extension. |
| `storageKey` | String | Yes | Unique index, Hidden in DTOs | Server-generated storage object path/key. |
| `storageProvider` | String | Yes | Enum: `local-dev`, `s3`, `cloudinary`, `supabase`, `memory-test`, `unconfigured` | Storage backend used for the object. |
| `mimeType` | String | Yes | Verified magic-byte MIME | Canonical content type (`image/png`, `image/jpeg`, `image/webp`, `application/pdf`, `text/plain`, `text/csv`, `.docx`, `.xlsx`). |
| `sizeBytes` | Number | Yes | `1` to `10485760` (10 MB) | Byte size of uploaded file. |
| `checksum` | String | No | SHA256 hex digest | Integrity digest of uploaded bytes. |
| `idempotencyKey` | String | No | Sparse per-issue index | Client retry deduplication key. |
| `issueId` | ObjectId | Yes | Ref: `Issue`, Indexed | Parent issue identifier. |
| `projectId` | ObjectId | Yes | Ref: `Project`, Indexed | Parent project identifier (server-derived). |
| `workspaceId` | ObjectId | Yes | Ref: `Workspace`, Indexed | Parent workspace identifier (server-derived). |
| `uploadedBy` | ObjectId | Yes | Ref: `User`, Indexed | Server-derived uploader user ID. |
| *(Indexes)* | Compound | Yes | `{ storageKey: 1 }` (Unique), `{ issueId: 1, createdAt: -1 }`, `{ projectId: 1, createdAt: -1 }`, `{ workspaceId: 1, createdAt: -1 }`, `{ issueId: 1, idempotencyKey: 1 }` | Fast issue attachment queries, cascade deletes, and idempotency checks. |

### RevokedToken Collection (`revokedtokens`)
| Field | Type | Required | Constraints | Description |
| :--- | :--- | :--- | :--- | :--- |
| `tokenHash` | String | Yes | Unique SHA256 hex string | Hash of revoked JWT token. |
| `expiresAt` | Date | Yes | TTL Index (`expireAfterSeconds: 0`) | Automatic cleanup after JWT expiry. |

---

## 8. API Documentation

### Authentication Endpoints (`/api/auth`)

#### 1. Register User
- **Method**: `POST`
- **Path**: `/api/auth/register`
- **Body**: `{ "fullName": "Jane Doe", "email": "jane@company.com", "password": "Password123!", "confirmPassword": "Password123!" }`
- **Response (201 Created)**: Returns `{ success: true, data: { user, token } }`.

#### 2. User Login
- **Method**: `POST`
- **Path**: `/api/auth/login`
- **Body**: `{ "email": "jane@company.com", "password": "Password123!" }`
- **Response (200 OK)**: Sets HTTP-only `trackflow_token` cookie and returns user data + token.

#### 3. Current User Session
- **Method**: `GET`
- **Path**: `/api/auth/me`
- **Headers**: Cookie `trackflow_token` or `Authorization: Bearer <token>`
- **Response (200 OK)**: Returns the authenticated user record.
- **Response (401 Unauthorized)**: If session expired, revoked, or missing.

#### 4. Logout (with Server-Side Token Revocation)
- **Method**: `POST`
- **Path**: `/api/auth/logout`
- **Response (200 OK)**: Hashes and stores the JWT in `RevokedToken` and clears `trackflow_token` cookie.

### Workspace Endpoints (`/api/workspaces`)

#### 1. List Workspaces
- **Method**: `GET`
- **Path**: `/api/workspaces`
- **Response (200 OK)**: Returns all workspaces the authenticated user belongs to, including `role` and `memberCount`.

#### 2. Create Workspace
- **Method**: `POST`
- **Path**: `/api/workspaces`
- **Body**: `{ "name": "Acme Engineering", "slug": "acme-eng", "description": "Core software team" }`
- **Response (201 Created)**: Creates workspace, generates unique slug if omitted, and assigns caller as `OWNER`.

#### 3. Get Workspace Details
- **Method**: `GET`
- **Path**: `/api/workspaces/:workspaceId`
- **Response (200 OK)**: Returns workspace metadata and caller's member role.

#### 4. Update Workspace
- **Method**: `PATCH`
- **Path**: `/api/workspaces/:workspaceId`
- **Access**: OWNER or ADMIN
- **Body**: `{ "name": "Acme Dev", "description": "Updated description" }`
- **Response (200 OK)**: Returns updated workspace.

#### 5. Delete Workspace
- **Method**: `DELETE`
- **Path**: `/api/workspaces/:workspaceId`
- **Access**: OWNER only
- **Response (200 OK)**: Deletes workspace, cascades member deletions, and cleans invitations.

### Member & Team Endpoints (`/api/workspaces/:workspaceId/members`)

#### 1. List Workspace Members
- **Method**: `GET`
- **Path**: `/api/workspaces/:workspaceId/members`
- **Access**: Any workspace member
- **Response (200 OK)**: Returns member list with populated user profiles (`fullName`, `email`, `avatarUrl`) and roles.

#### 2. Update Member Role
- **Method**: `PATCH`
- **Path**: `/api/workspaces/:workspaceId/members/:memberId`
- **Access**: OWNER or ADMIN (Admins cannot assign OWNER or modify fellow Admins/Owners)
- **Body**: `{ "role": "ADMIN" }`
- **Response (200 OK)**: Updates member role.

#### 3. Remove Member
- **Method**: `DELETE`
- **Path**: `/api/workspaces/:workspaceId/members/:memberId`
- **Access**: OWNER or ADMIN (Last Owner Protection strictly enforced)
- **Response (200 OK)**: Removes member from workspace.

#### 4. Leave Workspace
- **Method**: `POST`
- **Path**: `/api/workspaces/:workspaceId/members/leave`
- **Access**: Any member (Sole owner blocked by Last Owner Protection)
- **Response (200 OK)**: Caller leaves workspace.

#### 5. Initiate Ownership Transfer
- **Method**: `POST`
- **Path**: `/api/workspaces/:workspaceId/transfer-ownership`
- **Access**: OWNER only
- **Body**: `{ "recipientUserId": "6732f91..." }`
- **Response (200 OK)**: Sets pending owner transfer on workspace.

#### 6. Accept Ownership Transfer
- **Method**: `POST`
- **Path**: `/api/workspaces/:workspaceId/transfer-ownership/accept`
- **Access**: Recipient (`pendingOwnerId`) only
- **Response (200 OK)**: Atomically transfers ownership, promotes recipient to OWNER, and demotes previous owner to ADMIN.

#### 7. Cancel Ownership Transfer
- **Method**: `POST`
- **Path**: `/api/workspaces/:workspaceId/transfer-ownership/cancel`
- **Access**: OWNER or pending recipient
- **Response (200 OK)**: Clears pending transfer.

### Invitation Endpoints (`/api/workspaces/:workspaceId/invitations` & `/api/invitations`)

#### 1. Create Invitation
- **Method**: `POST`
- **Path**: `/api/workspaces/:workspaceId/invitations`
- **Access**: OWNER or ADMIN
- **Body**: `{ "email": "teammate@company.com", "role": "MEMBER" }`
- **Response (201 Created)**: Generates high-entropy crypto token, hashes token into database, and returns invitation link.

#### 2. List Pending Invitations
- **Method**: `GET`
- **Path**: `/api/workspaces/:workspaceId/invitations`
- **Access**: OWNER or ADMIN
- **Response (200 OK)**: Returns pending active invitations with inviter details.

#### 3. Revoke Invitation
- **Method**: `DELETE`
- **Path**: `/api/workspaces/:workspaceId/invitations/:invitationId`
- **Access**: OWNER or ADMIN
- **Response (200 OK)**: Marks invitation status as `REVOKED`.

#### 4. Inspect Public Invitation Token
- **Method**: `GET`
- **Path**: `/api/invitations/:token`
- **Access**: Public / Unauthenticated
- **Response (200 OK)**: Returns invitation details (workspace name, slug, invited email, role, inviter) without exposing secrets.

#### 5. Accept Invitation
- **Method**: `POST`
- **Path**: `/api/invitations/:token/accept`
- **Access**: Authenticated user matching the invited email
- **Response (200 OK)**: Adds user to `WorkspaceMember`, sets status to `ACCEPTED`, and returns joined workspace.

#### 6. Decline Invitation
- **Method**: `POST`
- **Path**: `/api/invitations/:token/decline`
- **Access**: Authenticated user matching the invited email
- **Response (200 OK)**: Sets status to `REVOKED`.

### Issue Endpoints (`/api/projects/:projectId/issues` & `/api/issues`)

All issue endpoints require authentication (`requireAuth`), active database availability (`requireDatabase`), workspace membership, and active project membership (`ProjectMember`) on the target project.

| Method | Path | Role Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/projects/:projectId/issues` | `VIEWER`, `DEVELOPER`, `PROJECT_ADMIN` | Searches, filters, sorts, and paginates project issues with `pagination`, `appliedFilters`, `appliedSorting`, `members`, and `permissions`. |
| `POST` | `/api/projects/:projectId/issues` | `DEVELOPER`, `PROJECT_ADMIN` | Creates an issue with atomic `KEY-N` sequence and server-derived reporter/project/workspace. |
| `GET` | `/api/issues?workspaceId=...` | Any project member | Searches, filters, sorts, and paginates issues across projects the caller belongs to in the workspace. |
| `GET` | `/api/issues/:issueId` | `VIEWER`, `DEVELOPER`, `PROJECT_ADMIN` | Returns full populated issue details, project info, and caller permissions. |
| `PATCH` | `/api/issues/:issueId` | `DEVELOPER`, `PROJECT_ADMIN` | Updates allowed fields (`title`, `description`, `type`, `priority`, `status`, `assigneeId`, `dueDate`). |
| `PATCH` | `/api/issues/:issueId/assignee` | `DEVELOPER`, `PROJECT_ADMIN` | Assigns an active member of the same project or unassigns (`null`). |
| `PATCH` | `/api/issues/:issueId/status` | `DEVELOPER`, `PROJECT_ADMIN` | Transitions issue status (`TODO`, `IN_PROGRESS`, `DONE`). |
| `PATCH` | `/api/issues/:issueId/priority` | `DEVELOPER`, `PROJECT_ADMIN` | Updates issue priority (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`). |
| `DELETE` | `/api/issues/:issueId` | `PROJECT_ADMIN` only | Permanently deletes the issue (`403` for Developers and Viewers). |

#### Issue Query Parameters (`GET /api/issues` & `GET /api/projects/:projectId/issues`)
- **Search**: `search` (trimmed, regex-escaped, case-insensitive match across `issueKey`, `title`, `description`, `assignee.fullName`, `assignee.email`, `reporter.fullName`, `reporter.email`).
- **Multi-Value Filters** *(OR within field, AND across fields)*: `status` (`TODO`, `IN_PROGRESS`, `DONE`), `priority` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `type` (`BUG`, `FEATURE`, `TASK`), `assigneeId` (member IDs + `UNASSIGNED`), `reporterId`, `projectId` *(workspace endpoint only)*.
- **Date Filters**: `dueDatePreset` (`overdue`, `due_today`, `next_7_days`, `next_30_days`, `no_due_date`), `dueDateFrom` / `dueDateTo`, `createdFrom` / `createdTo`.
- **Sorting**: `sortBy` (`updatedAt`, `createdAt`, `dueDate`, `priority`, `status`, `issueKey`, `title`) + `sortOrder` (`asc` \| `desc`, default `updatedAt desc`). Priority uses semantic severity rank (`CRITICAL > HIGH > MEDIUM > LOW`), status uses workflow progression (`TODO`, `IN_PROGRESS`, `DONE`), and null `dueDate` items always sort last.
- **Pagination**: `page` (default `1`), `limit` (default `20`, max `100`). Returns `{ issues, pagination: { currentPage, pageSize, totalItems, totalPages, hasNextPage, hasPreviousPage }, appliedFilters, appliedSorting, members }`.

#### Issue Classification, Priorities & Workflow
- **Issue Types**: `BUG` (default), `FEATURE`, `TASK`
- **Priority Levels**: `LOW`, `MEDIUM` (default), `HIGH`, `CRITICAL`
- **Status Workflow**: `TODO` (default) → `IN_PROGRESS` → `DONE` (Kanban-compatible for Phase 5)
- **Project Membership & Authorization**: Every issue endpoint verifies user authentication, parent workspace membership, project-workspace match, and active `ProjectMember` membership. Workspace/Project `VIEWER` users are strictly read-only; `DEVELOPER` users may create, edit, assign active project members, and change status/priority; `PROJECT_ADMIN` users additionally have delete permission.

### Issue Comment & Collaboration Endpoints (`/api/issues/:issueId/comments` & `/api/comments`)

All comment endpoints enforce `requireDatabase`, `requireAuth`, workspace isolation, and active `ProjectMember` authorization.

| Method | Path | Role Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/issues/:issueId/comments` | `VIEWER`, `DEVELOPER`, `PROJECT_ADMIN` | Lists top-level comments with 1-level chronological replies (`sort=asc\|desc`, optional `limit` & `offset`). |
| `POST` | `/api/issues/:issueId/comments` | `DEVELOPER`, `PROJECT_ADMIN` | Creates a top-level comment (rejects empty/whitespace & `VIEWER`). |
| `POST` | `/api/comments/:commentId/replies` | `DEVELOPER`, `PROJECT_ADMIN` | Creates a 1-level reply under a top-level active comment (rejects 2nd-level nesting or cross-issue tampering). |
| `PATCH` | `/api/comments/:commentId` | Author (`DEVELOPER`) or `PROJECT_ADMIN` | Updates comment text and sets `editedAt` (`403` for other developers & viewers). |
| `DELETE` | `/api/comments/:commentId` | Author (`DEVELOPER`) or `PROJECT_ADMIN` | Soft-deletes comment (`deletedAt`), redacts content, and keeps replies intact. |

### Issue Attachment Endpoints (`/api/issues/:issueId/attachments` & `/api/attachments`)

All attachment endpoints enforce `requireDatabase`, `requireAuth`, workspace isolation, active `ProjectMember` verification, and role-based ownership permissions (`VIEWER` read/download only, `DEVELOPER` upload & delete own, `PROJECT_ADMIN` upload & delete any).

| Method | Path | Role Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/issues/:issueId/attachments` | `VIEWER`, `DEVELOPER`, `PROJECT_ADMIN` | Lists issue attachments (without `storageKey`), storage readiness status, limits, and caller `permissions`. |
| `POST` | `/api/issues/:issueId/attachments` | `DEVELOPER`, `PROJECT_ADMIN` | Multipart upload (`files`, max 5/request, 10 MB/file, 20/issue) with magic-byte validation, rate limiting, `Idempotency-Key` deduplication, and atomic rollback. |
| `GET` | `/api/attachments/:attachmentId` | `VIEWER`, `DEVELOPER`, `PROJECT_ADMIN` | Returns attachment metadata DTO. |
| `GET` | `/api/attachments/:attachmentId/download` | `VIEWER`, `DEVELOPER`, `PROJECT_ADMIN` | Streams file bytes with `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, and sanitized `Content-Disposition` (`?inline=1` for safe inline preview). |
| `DELETE` | `/api/attachments/:attachmentId` | Uploader (`DEVELOPER`) or `PROJECT_ADMIN` | Deletes metadata and cleans up storage object (queuing deferred cleanup if storage fails). |

### Health Check Endpoint (`/api`)

#### Get System Health
- **Method**: `GET`
- **Path**: `/api/health`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "status": "healthy",
      "service": "TrackFlow API",
      "timestamp": "2026-11-11T...",
      "database": {
        "connected": true,
        "type": "mongodb",
        "host": "cluster0.mongodb.net"
      },
      "environment": "development"
    }
  }
  ```

---

## 9. Installation Instructions

1. Clone or open the repository in your Node.js 20+ environment.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

---

## 10. Environment Variables & Database Modes

TrackFlow enforces three distinct database behaviors:
1. **Production Mode (`NODE_ENV=production`)**: Requires a valid, reachable `MONGODB_URI` and a non-default `JWT_SECRET`. Startup fails fast if missing, in-memory fallback is strictly disabled across all model adapters, `/api/health` returns HTTP `503 degraded` if disconnected, and protected data routes return HTTP `503 DATABASE_UNAVAILABLE`.
2. **Development with MongoDB (`MONGODB_URI` configured)**: Connects to MongoDB directly; if `MONGODB_URI` fails to connect, TrackFlow marks the database `disconnected` and refuses to silently fall back to ephemeral memory.
3. **Development / Preview In-Memory Mode (`NODE_ENV !== 'production'`, no `MONGODB_URI`, `ALLOW_MEMORY_DB=true`)**: Explicitly enabled by `npm run dev` (via `ALLOW_MEMORY_DB=${ALLOW_MEMORY_DB:-true}`) for sandboxed local/preview work without a database daemon. Displays a non-persistent warning banner in the UI.

Demo data seeding is disabled by default and strictly forbidden in production. To seed a development reviewer workspace locally, set both `ENABLE_DEMO_SEED=true` and `DEMO_USER_PASSWORD=<your-dev-password>` in `.env`.

Configure `.env` from `.env.example` (never commit real secrets or passwords).

---

## 11. Authentication & Security

- **Bcrypt Password Salting**: Passwords are never stored in plain text (salt round 10).
- **HTTP-Only Cookies**: JWT tokens are issued with `httpOnly: true`, `sameSite: 'lax'` by default (configurable via `COOKIE_SAMESITE` / `CROSS_SITE_COOKIES`), and `secure: true` in production or `SameSite=None`.
- **Trusted CORS Origins**: Production only accepts configured origins (`CLIENT_URL`, `APP_URL`, `ALLOWED_ORIGINS`), rejecting untrusted browser origins.
- **Bearer Token Support & Server Revocation**: Supports `Authorization: Bearer` headers and stores SHA256 hashes of logged-out JWTs in `RevokedToken` (with MongoDB TTL cleanup).
- **Security Headers & Input Validation**: Helmet headers + Zod v4 schemas on all inputs; production error responses strip stack traces.

---

## 12. Running Frontend & Backend

Development Mode:
```bash
npm run dev
```
Starts `server.ts` via `tsx` on port `3000`, mounting Vite dev middleware with live reload.

Production Build:
```bash
npm run build
npm start
```
Compiles client assets to `dist/` and starts Express to serve the production build.

---

## 13. Testing

Run the Vitest automated test suite:
```bash
npm test
```

Included tests (129 tests across 16 Vitest suites — backend suites execute against the isolated in-memory test adapter when `MONGODB_URI` is unset in the sandbox):
- **Backend Auth API (`auth.test.ts`)**: 11 tests covering registration, duplicate email rejection (409), password hashing integrity, login verification, bad credentials handling, `/api/auth/me` authorization, and logout.
- **Backend Workspace, RBAC & Ownership Transfer (`workspace_and_rbac.test.ts`)**: 19 tests covering multi-tenant isolation, role hierarchy, invitations, and atomic ownership transfer.
- **Backend Project Management (`project.test.ts`)**: 7 tests covering project creation, key uniqueness, project membership roles, last-admin protection, and archive/restore.
- **Backend Production Safety (`safety_and_db.test.ts`)**: 11 tests covering all three database modes, fail-closed model adapters (`503`), CORS allowlists, cookies, `JWT_SECRET`, and dev seeding guards.
- **Backend Issue Management (`issue.test.ts`)**: 16 tests covering issue CRUD, atomic `KEY-N` concurrency, mass-assignment protection, multi-tenant project isolation, assignee verification, and `PROJECT_ADMIN`/`DEVELOPER`/`VIEWER` permissions.
- **Backend Kanban Board Workflow (`board.test.ts`)**: 6 tests covering `PATCH /api/issues/:issueId/status` across `TODO` ↔ `IN_PROGRESS` ↔ `DONE`, `VIEWER` `403` rejection, cross-project/non-member `403` isolation, `401`/`400`/`404` validation, `503` fail-closed DB unavailable handling, and end-to-end backend lifecycle persistence.
- **Backend Issue Comments & Collaboration (`comment.test.ts`)**: 10 tests covering top-level comments, 1-level nested reply validation (rejecting 2nd-level nesting & cross-issue tampering), `VIEWER`/`DEVELOPER`/`PROJECT_ADMIN` RBAC ownership & moderation, soft-delete content redaction preserving replies, chronological sorting/pagination, cascade delete on issue removal, Mongoose indexes, and full workflow persistence.
- **Backend Issue Search, Filter, Sort & Pagination (`issue_search.test.ts`)**: 6 comprehensive test groups covering escaped regex keyword search, multi-value OR/AND filters (`status`, `priority`, `type`, `assigneeId` incl. `UNASSIGNED`, `reporterId`, `projectId`), due/created date presets & custom ranges, semantic priority/status sorting & null `dueDate` ordering, pagination metadata/max limit 100/Zod `400` validation, cross-tenant RBAC isolation, compound schema indexes, and `503` fail-closed DB guard.
- **Backend RBAC Hardening & Attachments (`rbac_and_attachments.test.ts`)**: 8 comprehensive integration tests covering unified `projectPermissions` & attachment `IssuePermissions`, valid magic-byte & OpenXML container uploads (PNG/JPEG/WEBP/PDF/TXT/CSV/DOCX/XLSX), spoofed JAR/HTML/executable/extension/size/batch/20-file cap rejection, `VIEWER`/ownership/cross-tenant/IDOR checks, `Idempotency-Key` deduplication, metadata failure rollback, `503` unconfigured production storage guard, temp-file cleanup, `objectExists` & repeated delete `404`, workspace & project cascade cleanup, rate limiting (`429` + `Retry-After`) on login/register/invitations/uploads, malformed JSON handling, and `Attachment` Mongoose indexes.
- **Frontend Validation, Navigation, Issue, Kanban Board, Comments, Discovery & Attachment UI (`validation.test.ts`, `navigation.test.ts`, `issue.test.tsx`, `issue_search.test.tsx`, `board.test.tsx`, `comment.test.tsx`, `attachments_and_rbac.test.tsx`)**: 37 tests covering Zod contracts, sidebar module status, Phase 4 issue DOM components, Phase 5 Kanban board interactions/filters, Phase 6 `CommentSection` workflows, Phase 7 debounced search/filters/chips/sort/pagination/URL sync, and Phase 8 `AttachmentSection` drag-upload/retry/safe `<pre>` preview/DOCX download card/delete RBAC & `ProjectMembersTab`/`ProjectSettingsTab` permission guards.

---

## 14. How to Use Issues & the Kanban Board, Workflow & Screenshots

1. **Sign In & Select Workspace**: Authenticate at `/login` or `/register` and choose or create a workspace.
2. **Create or Open a Project**: Navigate to `/projects`, create a project (e.g., key `MOB`), and add active project members under **Team Members**.
3. **Create & Manage Issues**: Open the project's **Issues** tab (or `/issues`) and click **Create Issue** to submit title, description, type, priority, optional assignee (restricted to active project members), and optional due date. TrackFlow allocates an atomic sequential key (e.g., `MOB-1`).
4. **Use the Interactive Kanban Board (`/board` & `/projects/:projectId/board`)**:
   - Open **Kanban Board** from the sidebar (`/board`) for a workspace-wide view across your accessible projects, or click **Kanban Board** inside any project (`/projects/:projectId/board`).
   - Drag any card by its dedicated grip handle across **To Do**, **In Progress**, and **Done** (or focus the grip handle and press `Space` → `ArrowLeft`/`ArrowRight` → `Space` for keyboard transitions). Status changes apply optimistically, persist via `PATCH /api/issues/:issueId/status`, and roll back automatically on API/database errors.
   - Click `+` in any column header to open `CreateIssueModal` with that column's status preselected, or click any card body to inspect/edit/assign/delete inside the slide-over `KanbanIssueDrawer`.
   - Use the board toolbar to filter by key/title search, accessible project (on `/board`), priority, or assignee.
   - `VIEWER` members see a read-only banner and lock icons (`drag handles disabled`); `DEVELOPER` and `PROJECT_ADMIN` members can transition cards across columns.
   - On mobile screens (`<768px`), switch columns cleanly using the segmented status tab bar (`To Do` / `In Progress` / `Done`); on tablet/desktop viewports (`768px`–`1440px+`), all 3 columns display side-by-side.
5. **Roadmap & 404 Handling**: Planned future modules (`/tasks`, `/notifications`, `/reports`) render "Features Coming Soon"; invalid routes render the 404 Page Not Found screen.

### Screenshots
- `[Placeholder — Not yet captured]` Global & Project Kanban Board (Desktop 3-Column View)
- `[Placeholder — Not yet captured]` Drag-and-Drop Card Transition & Slide-Over Issue Details Drawer
- `[Placeholder — Not yet captured]` Responsive Mobile Kanban Board Segmented Status Tabs (320px–390px)

---

## 15. Deployment Preparation

- **Vercel / Netlify**: Configure root directory with `npm run build` and publish directory `dist`.
- **Node.js Containers (Cloud Run / Docker)**: Run `npm run build` followed by `node server.ts` or `tsx server.ts`. Port is dynamically read from `process.env.PORT`.

---

## 16. Completed Features (Phases 1–8)

### Phase 1: Foundations & Auth
- [x] Full-Stack application structure (Express + Vite + React 19).
- [x] Universal SaaS design system following frontend design constitution.
- [x] Responsive layout (320px mobile to 1440px desktop) with mobile drawer.
- [x] Authoritative MongoDB database connection configuration with 503 degraded state handling.
- [x] Mongoose User schema with email index and pre-save bcrypt hashing.
- [x] Registration API and UI with client + server validation.
- [x] Login API and UI with credential verification and secure session cookies.
- [x] Session persistence and current-user retrieval (`/api/auth/me`).
- [x] Server-side token revocation (`RevokedToken` model with MongoDB TTL index).
- [x] Protected routes with loading skeletons.
- [x] Public routes redirecting authenticated users away from login.
- [x] Real-time Toast notification feedback system.
- [x] Branded Coming Soon pages for planned roadmap modules.
- [x] Distinct 404 Page Not Found.

### Phase 2: Workspaces, Team Members, Invitations & RBAC
- [x] Multi-tenant Workspace schema with unique slug index and owner association.
- [x] WorkspaceMember schema with compound index `{ workspaceId: 1, userId: 1 }`.
- [x] Cryptographic Invitation token generation with SHA256 hashed storage.
- [x] Centralized RBAC permission matrix for OWNER, ADMIN, MEMBER, VIEWER.
- [x] Last Owner Protection preventing accidental workspace decapitation.
- [x] Role hierarchy rules (Admins cannot remove/demote Owners or fellow Admins).
- [x] Workspace CRUD REST endpoints (`/api/workspaces`).
- [x] Member management REST endpoints (`/api/workspaces/:workspaceId/members`).
- [x] Invitation creation, pending list, revocation, acceptance, and decline endpoints.
- [x] WorkspaceContext with live switcher in Sidebar and Top Header.
- [x] Create Workspace modal with real-time slugification.
- [x] Team Members directory page (`/team`) with member list, search, role changes, leave & remove actions.
- [x] Secure ownership transfer workflow with atomic role updates & recipient acceptance.

### Phase 3: Project Management, Membership & Permissions
- [x] Project schema with workspace reference, unique uppercase project key per workspace, and metadata.
- [x] ProjectMember schema with roles (`PROJECT_ADMIN`, `DEVELOPER`, `VIEWER`) and unique compound index `{ projectId: 1, userId: 1 }`.
- [x] Centralized Project RBAC service enforcing workspace isolation and project role permissions.
- [x] Project CRUD REST endpoints (`/api/projects`) and lifecycle endpoints (`/archive`, `/restore`).
- [x] Project membership management endpoints (`/api/projects/:projectId/members`).
- [x] Last Project Administrator protection preventing orphan projects.
- [x] Projects Overview page (`/projects`) with live search, status filters (Active, Archived, All), and grid layout.
- [x] Create Project modal with automatic key derivation and custom color accents.
- [x] Project Details page (`/projects/:projectId`) with Overview, Team Members, and Settings tabs.
- [x] Project Settings management, archive/restore toggle, and owner/creator danger zone deletion.
- [x] 44 passing automated tests across 5 Vitest test suites.

### Phase 3.1: Production Safety Audit & Correction
- [x] Three strict database modes enforced (`mongodb` prod/dev, explicit opt-in dev `memory`, fail-closed `disconnected` / `503` in prod).
- [x] All model adapters (`User`, `Workspace`, `WorkspaceMember`, `Project`, `ProjectMember`, `Issue`, `Comment`, `Invitation`, `RevokedToken`) enforce `getActiveStorageMode()`.
- [x] Demo seeding strictly disabled in production and gated behind `ENABLE_DEMO_SEED=true` + `DEMO_USER_PASSWORD`; hardcoded frontend demo password removed.
- [x] Strict production CORS origin allowlist, fail-fast `JWT_SECRET` check, and safe default `SameSite=Lax` cookie policy.
- [x] Honest Dashboard database persistence telemetry and dev-only ephemeral storage warning banner.

### Phase 4: Issue / Ticket Management
- [x] `Issue` Mongoose schema with unique `issueKey`, compound indexes, and fail-closed `IssueModelAdapter`.
- [x] Atomic per-project `issueSequence` counter on `Project` preventing `KEY-N` collisions under concurrency.
- [x] Centralized `IssueRBACService` verifying workspace membership, active project membership, and `PROJECT_ADMIN` / `DEVELOPER` / `VIEWER` capabilities.
- [x] Complete REST endpoints (`/api/projects/:projectId/issues`, `/api/issues`, `/api/issues/:issueId`, `/assignee`, `/status`, `/priority`).
- [x] Project-scoped assignee verification and mass-assignment protection.
- [x] Project Details `Issues` tab, global `/issues` route with onboarding empty state, `CreateIssueModal`, `IssueList` (table + mobile cards), `IssueDetailsPanel`, `DeleteIssueDialog`, and permission-aware controls.

### Phase 5: Interactive Kanban Board
- [x] Global (`/board`) and project-scoped (`/projects/:projectId/board`) Kanban routes integrated across Sidebar, Dashboard, Projects, and Issues.
- [x] Three workflow columns (`TODO`, `IN_PROGRESS`, `DONE`) with live tabular counts, skeleton loading cards, and empty drop-target states.
- [x] Accessible `@dnd-kit/core` drag-and-drop (`PointerSensor`, `TouchSensor`, `KeyboardSensor` column stepping, `DragOverlay`, screen-reader announcements) paired with dedicated grip handles to avoid card click/drag conflict.
- [x] Optimistic card status movement backed by `PATCH /api/issues/:issueId/status` with per-issue concurrency lock and clean rollback + `503`/error alert on failure.
- [x] Per-project RBAC evaluation disabling drag handles with read-only indicator/banner for `VIEWER`s while authorizing `DEVELOPER` and `PROJECT_ADMIN`.
- [x] Column `+` quick-create integration preselecting status inside `CreateIssueModal` and slide-over `KanbanIssueDrawer` reusing `IssueDetailsPanel` & `DeleteIssueDialog`.
- [x] Responsive mobile segmented status tabs (`<768px`), tablet horizontal grid, desktop 3-column grid, and 91/91 passing tests across all 10 Vitest suites.

### Phase 6: Issue Comments & Collaboration
- [x] `Comment` Mongoose schema with compound indexes (`{ issueId: 1, createdAt: 1 }`, `{ projectId: 1, createdAt: 1 }`, `{ workspaceId: 1, createdAt: 1 }`, `{ parentCommentId: 1, createdAt: 1 }`) and fail-closed `CommentModelAdapter`.
- [x] REST endpoints (`GET/POST /api/issues/:issueId/comments`, `POST /api/comments/:commentId/replies`, `PATCH/DELETE /api/comments/:commentId`) with Zod validation and mass-assignment protection.
- [x] Single-level threaded replies (`parentCommentId`) rejecting 2nd-level nesting and cross-issue reply tampering.
- [x] Ownership & moderation RBAC (`VIEWER` read-only, `DEVELOPER` own edit/delete, `PROJECT_ADMIN` moderation) and soft deletion (`deletedAt`) redacting deleted content while preserving child replies.
- [x] Cascade cleanup on issue, project, and workspace deletion.
- [x] `CommentSection`, `CommentComposer`, `CommentItem`, `CommentReply`, `CommentActions`, `CommentSkeleton`, and `DeleteCommentDialog` integrated into `IssueDetailsPanel` (serving `/issues/:issueId`, `/projects/:projectId/issues/:issueId`, and `KanbanIssueDrawer`).

### Phase 7: Advanced Search, Filtering, Sorting & Pagination
- [x] `issueQuerySchema` Zod v4 validation (`search`, multi-value `status`/`priority`/`type`/`assigneeId`/`reporterId`/`projectId`, `dueDatePreset` + custom date ranges, `createdFrom`/`createdTo`, semantic `sortBy`/`sortOrder`, `page` & `limit` capped at 100).
- [x] Compound MongoDB indexes on `IssueSchema` (`{ projectId: 1, status: 1, updatedAt: -1 }`, `{ projectId: 1, priority: 1, updatedAt: -1 }`, `{ workspaceId: 1, status: 1, updatedAt: -1 }`, `{ projectId: 1, assigneeId: 1, updatedAt: -1 }`, `{ projectId: 1, dueDate: 1 }`) and aggregation-backed `IssueModelAdapter.queryIssues` with memory parity and fail-closed `503` handling.
- [x] Regex-escaped case-insensitive search across `issueKey`, `title`, `description`, `assignee`, and `reporter`, strictly scoped to authorized workspace & active project memberships.
- [x] Modular frontend discovery UI (`IssueSearchBar`, `IssueFilterPanel`, `ActiveFilterChips`, `IssueSortDropdown`, `IssueResultsSummary`, `IssuePagination`, `IssueSearchEmptyState`, `IssueDiscoveryToolbar`) integrated into global `/issues`, `/projects/:projectId/issues`, and `ProjectDetailsPage` Issues tab.
- [x] URL query parameter synchronization (`useSearchParams`), 300ms debounced search, `AbortController` + sequence protection against stale responses, and `KanbanBoardPage` `limit: 100` preservation.

### Phase 8: Role-Based Access Control (RBAC), Issue Attachments & Secure File Management
- [x] Unified `PermissionService` matrix (`computeIssuePermissions`, `computeProjectPermissions`) integrated across `ProjectRBACService`, `IssueRBACService`, `CommentRBACService`, and `AttachmentRBACService`.
- [x] `Attachment` Mongoose schema & fail-closed `AttachmentModelAdapter` with hidden `storageKey`, SHA256 `checksum`, sparse `idempotencyKey`, and compound indexes.
- [x] Environment-aware `AttachmentStorageAdapter` supporting `S3StorageAdapter` (SigV4), `SupabaseStorageAdapter`, development `LocalDevStorageAdapter`, `TestMemoryStorageAdapter`, and fail-closed `UnconfiguredStorageAdapter` (`503 STORAGE_NOT_CONFIGURED`) in production when credentials are absent.
- [x] Multipart upload pipeline (`multer` memory storage, rate limiting, extension/MIME/magic-byte validation, path-traversal checks, 10 MB/file, 5 files/request, 20 attachments/issue, `Idempotency-Key` deduplication, DB/storage rollback, and cascade deletes).
- [x] Frontend `AttachmentSection`, `AttachmentPreviewModal`, `DeleteAttachmentDialog`, and RBAC-hardened `ProjectMembersTab`, `ProjectSettingsTab`, `IssueList` (`canDeleteIssue`), and `IssueDetailsPanel`.

---

## 17. Planned Features (Phases 9–13)

- **Phase 9**: Real-time notifications, `@mention` notification delivery, and activity history audit.
- **Phase 10**: Reports, cycle time metrics, and bug velocity analytics.
- **Phase 11**: Full accessibility and UI/UX refinement audit.
- **Phase 12**: Security hardening and comprehensive end-to-end testing.
- **Phase 13**: Final production submission, assets, and documentation.

---

## 18. Known Limitations

- **Email Service**: Real production email delivery requires external SMTP/SES credentials. TrackFlow displays an accessible fallback copy-link modal to facilitate testing and local workflows without email dependencies.
- **OAuth Providers**: Third-party Google login will be activated once OAuth client credentials are provided; fake buttons are omitted per policy.
- **Cloud Object Storage (S3 / Supabase)**: Production S3 and Supabase adapters are implemented and documented in `.env.example`, but live external cloud bucket uploads are not executed in the local sandbox without external credentials.
- **Malware Scanning & Distributed Rate Limiting**: Antivirus/malware scanning (e.g., ClamAV) is not active in this deployment, and the built-in sliding-window rate limiters (`/api/auth/login`, `/api/auth/register`, invitation endpoints, and attachment uploads) use per-instance memory; multi-instance production deployments require a shared external store (such as Redis) or edge WAF rate limiting.
- **Live MongoDB Instance & Headless Browser**: In ephemeral preview sandboxes without `MONGODB_URI` or a headless Chromium binary, TrackFlow runs in explicitly flagged in-memory development mode and UI layout tests run in jsdom; live `mongod` aggregation/index benchmarks and live Chromium viewport visual inspection require external MongoDB and browser environments.

---

## 19. Conclusion

TrackFlow Phases 1–8 deliver a complete full-stack multi-tenant SaaS architecture spanning authentication, workspaces, project management, production safety controls, end-to-end issue tracking, an interactive `@dnd-kit/core` Kanban board, threaded issue comments & collaboration, advanced search/filtering/sorting/pagination, and hardened RBAC with secure issue file attachments.
