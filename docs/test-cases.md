# Test Cases — Auth & Teams API

| Field | Value |
|---|---|
| Project | thryve (`my-v0-project`) |
| Scope | `auth-register`, `auth-login`, `auth-logout`, `teams/join`, `teams/[id]/members` |
| Type | Automated API tests (Vitest) |
| Last run | 2026-10-02 |
| Result | 42 / 42 Pass (full suite: 121 / 121 across 11 files) |
| How to run | `npm test` — single case: `npx vitest run tests/api/auth-login.test.ts -t "invalid credentials"` |
| CI | `.github/workflows/test.yml` (runs on every PR and on push to `main`) |

**Type column:** `Existing` = endpoint already exists in the app; only the test case is new.
**Actual Result** = observed output of the automated run.

| Test Case ID | Feature | Type (Existing/New) | Preconditions | Test Steps | Test Data (Input) | Expected Result | Actual Result | Status (Pass/Fail) |
|---|---|---|---|---|---|---|---|---|
| REG-001 | POST /api/auth/register | Existing | No user registered yet; Supabase stubbed | 1. Send registration request with `email` omitted | `{password, firstName, lastName, department}` (no email) | 400; `{"error":"All fields are required"}`; Supabase `signUp` not called | 400 with `All fields are required`; `signUp` not called | Pass |
| REG-002 | POST /api/auth/register | Existing | As REG-001 | 1. Send registration with `password` omitted | valid email + names + department, no password | 400; `All fields are required`; no `signUp` call | 400 with `All fields are required`; no `signUp` call | Pass |
| REG-003 | POST /api/auth/register | Existing | As REG-001 | 1. Send registration with `firstName` omitted | valid body minus firstName | 400; `All fields are required`; no `signUp` call | 400 with `All fields are required`; no `signUp` call | Pass |
| REG-004 | POST /api/auth/register | Existing | As REG-001 | 1. Send registration with `lastName` omitted | valid body minus lastName | 400; `All fields are required`; no `signUp` call | 400 with `All fields are required`; no `signUp` call | Pass |
| REG-005 | POST /api/auth/register | Existing | As REG-001 | 1. Send registration with `department` omitted | valid body minus department | 400; `All fields are required`; no `signUp` call | 400 with `All fields are required`; no `signUp` call | Pass |
| REG-006 | POST /api/auth/register | Existing | Valid body otherwise | 1. Send malformed email | `email: "not-an-email"` | 400; `{"error":"Invalid email format"}`; no `signUp` call | 400 with `Invalid email format`; no `signUp` call | Pass |
| REG-007 | POST /api/auth/register | Existing | Valid body otherwise | 1. Send password < 6 chars | `password: "abc"` | 400; `{"error":"Password must be at least 6 characters long"}` | 400 with exact message | Pass |
| REG-008 | POST /api/auth/register | Existing | Valid body otherwise | 1. Send disallowed department | `department: "accounting"` (allowed: product/engineering/design/marketing/sales) | 400; `{"error":"Invalid department"}`; no `signUp` call | 400 with `Invalid department`; no `signUp` call | Pass |
| REG-009 | POST /api/auth/register | Existing | Supabase `signUp` returns user + session (auto-confirm on) | 1. Send valid registration | `{email:"ada@example.com", password:"supersecret", firstName:"Ada", lastName:"Lovelace", department:"engineering"}` | 200; `message:"Registration successful!"`; `user.emailConfirmed:true`; session returned; `signUp` called with metadata `first_name/last_name/department` | 200; message, `emailConfirmed:true` and session returned; `signUp` called once with correct metadata | Pass |
| REG-010 | POST /api/auth/register | Existing | Supabase `signUp` returns user but no session (email confirmation on) | 1. Send valid registration | same as REG-009 | 200; message asks to check email; `user.emailConfirmed:false`; no `session` field | 200; "…check your email to confirm your account."; `emailConfirmed:false`; `session` undefined | Pass |
| REG-011 | POST /api/auth/register | Existing | Supabase `signUp` returns error (e.g. duplicate user) | 1. Send valid registration | error: `User already registered` | 400; `{"error":"User already registered"}` passed through | 400 with Supabase message passed through | Pass |
| REG-012 | POST /api/auth/register | Existing | Supabase returns success but `user: null` | 1. Send valid registration | `data:{user:null, session:null}` | 400; `{"error":"Registration failed - no user created"}` | 400 with `Registration failed - no user created` | Pass |
| REG-013 | POST /api/auth/register | Existing | None | 1. Send invalid JSON body | `"{not json"` | 500; `{"error":"Internal server error"}` | 500 with `Internal server error`; `signUp` not called | Pass |
| REG-014 | POST /api/auth/register | Existing | Supabase `signUp` rejects (network failure) | 1. Send valid registration | `signUp` rejects: `network down` | 500; `{"error":"Internal server error"}` | 500 with `Internal server error` | Pass |
| LOG-001 | POST /api/auth/login | Existing | No session | 1. Send body with only `password`; 2. Send body with only `email` | `{password:"x"}` then `{email:"a@b.co"}` | Both 400; `{"error":"Email and password are required"}`; `signInWithPassword` not called | Both 400 with exact message; no `signInWithPassword` call | Pass |
| LOG-002 | POST /api/auth/login | Existing | Valid password supplied | 1. Send malformed email | `email:"nope"` | 400; `{"error":"Invalid email format"}`; no Supabase call | 400 with `Invalid email format`; no Supabase call | Pass |
| LOG-003 | POST /api/auth/login | Existing | Wrong credentials | 1. Send valid-format credentials; 2. Supabase returns `Invalid login credentials` | `{email:"ada@example.com", password:"supersecret"}` | 401; `{"error":"Invalid email or password"}` (generic, no Supabase internals) | 401 with `Invalid email or password` | Pass |
| LOG-004 | POST /api/auth/login | Existing | Email not yet confirmed | 1. Send credentials; 2. Supabase returns `Email not confirmed` | same as LOG-003 | 401; `{"error":"Please confirm your email address before signing in"}` | 401 with exact message | Pass |
| LOG-005 | POST /api/auth/login | Existing | Other Supabase failure (e.g. rate limit) | 1. Send credentials; 2. Supabase returns `Too many requests` | same as LOG-003 | 400; `{"error":"Too many requests"}` passed through | 400 with `Too many requests` | Pass |
| LOG-006 | POST /api/auth/login | Existing | Supabase succeeds but returns no user/session | 1. Send credentials; 2. `data:{user:null,session:null}` | `{email, password}` | 400; `{"error":"Login failed - invalid response"}` | 400 with `Login failed - invalid response` | Pass |
| LOG-007 | POST /api/auth/login | Existing | Valid user, session and profile row exist | 1. Send valid credentials; 2. Inspect response | `{email:"ada@example.com", password:"supersecret"}` | 200; `message:"Login successful!"`; user id/email/`emailConfirmed:true`; `profile` returned; session returned; profile queried with `eq(id)` | 200 with full user + profile + session; profile query filtered by `id = user-1` | Pass |
| LOG-008 | POST /api/auth/login | Existing | Login succeeds but profile row missing (`PGRST116`) | 1. Send valid credentials; 2. Inspect response | `{email, password}` | 200 (login still succeeds); `profile:null`; `emailConfirmed:false` when unconfirmed | 200; `profile:null`; `emailConfirmed:false` | Pass |
| LOG-009 | POST /api/auth/login | Existing | None | 1. Send invalid JSON | `"{not json"` | 500; `{"error":"Internal server error"}` | 500 with `Internal server error` | Pass |
| LOG-010 | POST /api/auth/login | Existing | Supabase throws unexpectedly | 1. Send valid credentials; 2. `signInWithPassword` rejects `network down` | `{email, password}` | 500; `{"error":"Internal server error"}` | 500 with `Internal server error` | Pass |
| OUT-001 | POST /api/auth/logout | Existing | No `Authorization` header | 1. POST with empty headers | no header | 401; `{"error":"No valid session found"}`; `signOut` not called | 401 with `No valid session found`; `signOut` not called | Pass |
| OUT-002 | POST /api/auth/logout | Existing | Header present but not Bearer | 1. POST with `Authorization: Basic abc` | `Basic abc` | 401; `{"error":"No valid session found"}`; `signOut` not called | 401 with exact message; `signOut` not called | Pass |
| OUT-003 | POST /api/auth/logout | Existing | Valid Bearer token; Supabase `signOut` fails | 1. POST with `Authorization: Bearer tok`; 2. `signOut` returns error `session not found` | `Bearer tok` | 400; `{"error":"session not found"}` | 400 with `session not found` | Pass |
| OUT-004 | POST /api/auth/logout | Existing | Valid Bearer token; `signOut` succeeds | 1. POST with `Authorization: Bearer tok` | `Bearer tok` | 200; `{"message":"Logout successful!"}`; `signOut` called once | 200 with `Logout successful!`; `signOut` called once | Pass |
| OUT-005 | POST /api/auth/logout | Existing | `signOut` throws | 1. POST with Bearer token; 2. `signOut` rejects `boom` | `Bearer tok` | 500; `{"error":"Internal server error"}` | 500 with `Internal server error` | Pass |
| JOIN-001 | POST /api/teams/join | Existing | User not authenticated (`getUser` returns no user) | 1. Send join request | `{teamCode:"ABC123"}` | 401; `{"error":"Unauthorized"}`; no DB queries executed | 401 with `Unauthorized`; 0 queries | Pass |
| JOIN-002 | POST /api/teams/join | Existing | Authenticated user | 1. Send body without `teamCode`; 2. Send `teamCode:"  "` | `{}` then `{teamCode:"  "}` | Both 400; `{"error":"Team code is required"}` | Both 400 with `Team code is required` | Pass |
| JOIN-003 | POST /api/teams/join | Existing | Authenticated; no team matches the code | 1. Send lowercase code; 2. Team lookup returns no row | `{teamCode:"abc123"}` | 404; `{"error":"Invalid team code"}`; lookup normalized to uppercase (`eq invite_code = "ABC123"`) | 404 with `Invalid team code`; query used `ABC123` | Pass |
| JOIN-004 | POST /api/teams/join | Existing | Authenticated; already an active member | 1. Send valid code; 2. Existing membership has `is_active = true` | `{teamCode:"ABC123"}` | 400; `{"error":"You are already a member of this team"}`; no insert performed | 400 with exact message; no insert | Pass |
| JOIN-005 | POST /api/teams/join | Existing | Authenticated; has an inactive membership | 1. Send valid code; 2. Membership found with `is_active = false` | `{teamCode:"ABC123"}` | 200; `message:"Successfully joined team"`; team payload id/name/description/tag/color; membership updated `is_active=true` + new `joined_at` by membership id | 200 with message + team payload; update set `is_active:true`, `joined_at` ISO, `eq id = membership-1` | Pass |
| JOIN-006 | POST /api/teams/join | Existing | Authenticated; never joined the team | 1. Send valid code; 2. Team found, no membership row | `{teamCode:"ABC123"}` (user `ada@example.com`) | 200; `message:"Successfully joined team"`; membership inserted with role `Team Member`, avatar `A` | 200; insert payload = `{team_id:"team-1", user_id:"user-1", role:"Team Member", avatar:"A"}` | Pass |
| JOIN-007 | POST /api/teams/join | Existing | Authenticated; new membership insert fails | 1. Send valid code; 2. Insert returns DB error | `{teamCode:"ABC123"}` | 500; `{"error":"Failed to join team"}` | 500 with `Failed to join team` | Pass |
| JOIN-008 | POST /api/teams/join | Existing | Authenticated; inactive membership; update fails | 1. Send valid code; 2. Reactivation update returns DB error | `{teamCode:"ABC123"}` | 500; `{"error":"Failed to rejoin team"}` | 500 with `Failed to rejoin team` | Pass |
| MEM-001 | GET /api/teams/[id]/members | Existing | User not authenticated | 1. Request member list for `team-1` | `params.id = "team-1"` | 401; `{"error":"Unauthorized"}` | 401 with `Unauthorized` | Pass |
| MEM-002 | GET /api/teams/[id]/members | Existing | Authenticated but not an active member of the team | 1. Request member list; 2. Membership lookup returns no row | `team-1`, user `user-1` | 403; `{"error":"Not a team member"}`; membership checked on `team_id + user_id + is_active=true`; member list never queried | 403 with `Not a team member`; filters exact; no member-list query | Pass |
| MEM-003 | GET /api/teams/[id]/members | Existing | Authenticated active member; 4 members with varied profiles | 1. Request member list; 2. Inspect formatted rows | rows: full name+no avatar; partial name+avatar `X`; no profile; null names | 200; names `Ada Lovelace`, `Grace`, `Unknown User`, `Unknown User`; avatars `A`, `X`, `U`, `U`; roles preserved | 200; all 4 rows formatted exactly as expected | Pass |
| MEM-004 | GET /api/teams/[id]/members | Existing | Authenticated active member | 1. Request member list; 2. Inspect executed query | `team-1` | 200; query filtered `eq team_id = team-1` and `eq is_active = true` only | 200; query chain exactly `[eq team_id, eq is_active]` | Pass |
| MEM-005 | GET /api/teams/[id]/members | Existing | Authenticated member; member list query fails | 1. Request member list; 2. DB returns error | DB error `boom` | 500; `{"error":"Failed to fetch members"}` | 500 with `Failed to fetch members` | Pass |

## Source files

| Test file | Endpoint under test |
|---|---|
| `tests/api/auth-register.test.ts` | `app/api/auth/register/route.ts` |
| `tests/api/auth-login.test.ts` | `app/api/auth/login/route.ts` |
| `tests/api/auth-logout.test.ts` | `app/api/auth/logout/route.ts` |
| `tests/api/teams-join.test.ts` | `app/api/teams/join/route.ts` |
| `tests/api/teams-members.test.ts` | `app/api/teams/[id]/members/route.ts` |
