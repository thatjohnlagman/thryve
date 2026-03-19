# Software Requirements Specification (SRS)
## BPI Innovate - AI-Powered Product Prototyping Platform

**Version:** 1.0  
**Date:** 2026-03-19  
**Status:** Active Development  

---

## 1. Executive Summary

BPI Innovate is an autonomous AI-powered platform that helps product teams discover market trends, generate product prototypes, and collaborate with teams. The platform combines trend analysis, AI chat capabilities, prototype generation, and team collaboration features to streamline product innovation workflows.

---

## 2. Functional Requirements

### 2.1 Authentication & Authorization

**FR-AUTH-001: User Registration**
- Users shall be able to create a new account with email and password
- System shall validate email format and password strength requirements
- System shall prevent duplicate email registrations
- Password shall be securely hashed before storage in database
- Confirmation email functionality may be implemented for verification

**FR-AUTH-002: User Login**
- Users shall be able to log in with email and password credentials
- System shall validate credentials against stored database records
- System shall create and maintain secure session tokens upon successful login
- Users shall be able to stay logged in across browser sessions
- Session shall persist using Supabase authentication

**FR-AUTH-003: Password Reset**
- Users shall be able to request password reset via email
- System shall send password reset link to registered email address
- Users shall be able to set new password using reset link
- Reset links shall expire after specified time period (typically 24 hours)

**FR-AUTH-004: User Logout**
- Users shall be able to log out from their account
- Session shall be terminated upon logout
- User data shall not be accessible after logout
- Users shall be redirected to login screen after logout

**FR-AUTH-005: Session Management**
- System shall maintain active sessions for authenticated users
- System shall detect and handle session expiration
- System shall prevent unauthorized access to protected features

---

### 2.2 User Profile Management

**FR-PROFILE-001: View User Profile**
- Users shall be able to view their profile information
- Profile shall display email, username, and account metadata
- Users shall see profile picture/avatar if available

**FR-PROFILE-002: Edit Profile Information**
- Users shall be able to update their profile details
- Users shall be able to change display name/username
- Changes shall be persisted to database

**FR-PROFILE-003: User Settings**
- Users shall have access to account preferences
- Settings shall include notification preferences
- Settings shall include theme preferences

---

### 2.3 Trend Discovery & Management

**FR-TREND-001: Automatic Trend Generation**
- System shall automatically generate 3 market trends per week for each user
- Trends shall be marked as "automatic" generation type
- System shall only generate trends for the current week
- Generated trends shall be stored in database with timestamp

**FR-TREND-002: Trend Attributes**
- Each trend shall include:
  - Title (trend name)
  - Summary (brief description)
  - Interpretation (analysis of the trend)
  - Category (classification/industry)
  - Impact (potential business impact)
  - Detailed Research (comprehensive analysis)
  - Prototype Prompt (AI-generated prompt for prototyping)
  - Sources (references/citations)
  - Creation timestamp
  - Heart/favorite flag

**FR-TREND-003: Manual Trend Creation**
- Users shall be able to manually create custom trends
- Users shall input trend details and analysis
- Manual trends shall be marked as "manual" generation type
- Custom trends shall not count toward automatic trend quota

**FR-TREND-004: View All Trends**
- Users shall be able to view list of all their trends
- Trends shall be sorted by creation date (newest first)
- System shall display trend summary information in list view

**FR-TREND-005: View Trend Details**
- Users shall be able to click on a trend to view full details
- Detail view shall display all trend attributes
- Users shall be able to navigate to prototype generation from trend details

**FR-TREND-006: Favorite Trends**
- Users shall be able to mark trends as favorites (heart)
- Favorite flag shall persist in database
- Users shall be able to filter/view only favorited trends

**FR-TREND-007: Trend Duplication Prevention**
- System shall prevent generating duplicate trend titles
- System shall check against all existing user trends before generation
- Similar trends shall be detected and avoided during bootstrap

---

### 2.4 Prototype Generation

**FR-PROTO-001: Generate Prototype from Trend**
- Users shall be able to generate a product prototype from a trend
- System shall use trend's prototype prompt to generate prototype
- Prototype generation shall leverage AI for code and design generation

**FR-PROTO-002: Prototype Attributes**
- Each prototype shall include:
  - Project name/title
  - Description
  - Generated code/components
  - Live preview URL (if generated)
  - Associated trend reference
  - Creation timestamp
  - Status (draft, completed, deployed)

**FR-PROTO-003: View All Prototypes**
- Users shall see list of all generated prototypes
- Prototypes shall display in card/grid format
- Each card shall show project name, description, and status

**FR-PROTO-004: View Prototype Details**
- Users shall be able to view full prototype details
- System shall display generated code
- System shall provide live preview/demo link if available

**FR-PROTO-005: Update Prototype**
- Users shall be able to modify prototype details
- Users shall be able to update code/implementation
- Changes shall be persisted to database

**FR-PROTO-006: Generate Live URL**
- System shall generate shareable URLs for prototypes
- Users shall be able to view live prototype demos
- Live URLs shall be accessible via web browser

---

### 2.5 AI Chat & Research

**FR-CHAT-001: AI Chat Interface**
- Users shall access a dedicated AI chat screen
- Users shall send messages to AI assistant
- System shall maintain conversation history
- AI shall provide relevant responses and assistance

**FR-CHAT-002: AI Capabilities**
- AI shall help with:
  - Trend interpretation and analysis
  - Prototype implementation suggestions
  - Market research queries
  - Product strategy questions
  - Code/design assistance

**FR-CHAT-003: Conversation Context**
- Chat shall have access to user's trends context
- AI shall reference user's existing trends in responses
- Conversation history shall be accessible within current session

**FR-CHAT-004: Research Integration**
- System shall perform web research for trend validation
- Research endpoint shall aggregate data from multiple sources
- Research results shall inform AI responses and trend generation

**FR-CHAT-005: Markdown Support**
- Chat messages shall support markdown formatting
- Users shall see formatted responses with code blocks
- Code snippets shall be displayable with syntax highlighting

---

### 2.6 Team Collaboration

**FR-TEAM-001: Create Team**
- Users shall be able to create new teams
- Teams shall have unique names and identifiers
- Users shall be team owner/administrator upon creation

**FR-TEAM-002: Join Team**
- Users shall be able to join existing teams
- System shall require team code or invitation link
- Users joining shall have standard member permissions

**FR-TEAM-003: View Team List**
- Users shall see all teams they are member of
- Team cards shall show team name, description, member count
- Users shall quickly switch between teams

**FR-TEAM-004: Team Details Page**
- Users shall view full team information
- Team details shall show:
  - Team name and description
  - Member list with roles
  - Projects list (team-specific)
  - Team announcements
  - Settings/management options (for admins)

**FR-TEAM-005: Team Members Management**
- Team admins shall add/remove team members
- System shall display member roles (admin, member)
- Users shall see member join dates and status

**FR-TEAM-006: Team Announcements**
- Team admins shall be able to post announcements
- Announcements shall be visible to all team members
- Users shall receive notification of new announcements

**FR-TEAM-007: Team Messages**
- Team members shall be able to send messages in team channel
- Message history shall persist in database
- Messages shall support text and basic formatting

**FR-TEAM-008: Team Projects**
- Teams shall have team-specific projects
- Team projects shall be created from prototypes or independently
- Team members shall collaborate on shared projects
- Projects shall have access control by team admin

---

### 2.7 Utilities & Tools

**FR-UTIL-001: Utility Tools Access**
- Users shall access utilities screen for additional tools
- Utilities may include:
  - AI-powered generators
  - Market analysis tools
  - Code snippets library
  - Research templates

**FR-UTIL-002: Tool Categories**
- Utilities shall be organized by category
- Categories may include: Design, Development, Market Research, Strategy
- Users shall search/filter utilities by name and category

---

### 2.8 Navigation & UI

**FR-NAV-001: Bottom Navigation (Mobile)**
- Mobile users shall see bottom navigation bar
- Navigation bar shall provide access to 6+ main screens
- Tabs shall include: Prototypes, Trends, Utilities, AI Chat, Teams, Profile
- Active tab shall be visually highlighted
- Bottom nav shall be fixed and always accessible

**FR-NAV-002: Sidebar Navigation (Desktop)**
- Desktop users shall see left sidebar navigation
- Sidebar shall provide same navigation options as mobile bottom nav
- Sidebar width shall be approximately 256px (lg breakpoint: 64 units)
- Content shall shift right on desktop to accommodate sidebar
- Sidebar shall be persistent/sticky

**FR-NAV-003: Splash Screen**
- New users shall see splash screen on first load
- Splash screen shall complete after 2-3 seconds or user interaction
- After splash, users shall see onboarding screen

**FR-NAV-004: Onboarding Screen**
- New users shall see onboarding tutorial/walkthrough
- Onboarding shall explain platform features and navigation
- Users shall be able to complete or skip onboarding
- Onboarding state shall be tracked per user

**FR-NAV-005: Profile Modal (Mobile)**
- Mobile users shall have dedicated profile button in top-right
- Clicking profile button shall open modal sheet
- Modal shall display profile screen content
- Users shall be able to close modal by clicking outside or close button

---

### 2.9 Data Persistence & Synchronization

**FR-DATA-001: Supabase Integration**
- System shall use Supabase as primary database
- All user data shall be stored in Supabase tables
- Database operations shall use parameterized queries (SQL injection prevention)

**FR-DATA-002: Real-time Updates**
- Trends shall update in real-time when modified
- Team messages shall appear in real-time to team members
- User shall see immediate feedback after data modifications

**FR-DATA-003: Data Consistency**
- System shall ensure data consistency across requests
- Concurrent modifications shall be handled appropriately
- Database constraints shall prevent invalid data states

**FR-DATA-004: User Data Isolation**
- Users shall only be able to access their own data
- Row Level Security (RLS) shall enforce data isolation
- Team data shall be accessible only to team members

---

### 2.10 Security & Privacy

**FR-SEC-001: Password Security**
- Passwords shall be hashed using bcrypt or equivalent
- Minimum password requirements shall be enforced (8+ characters recommended)
- Password reset links shall be one-time use

**FR-SEC-002: Session Security**
- Sessions shall use HTTP-only cookies (secure by default with Supabase)
- Session tokens shall expire after inactivity period
- Users shall be able to explicitly log out to terminate session

**FR-SEC-003: HTTPS**
- All data transmission shall use HTTPS/TLS encryption
- Mixed content (HTTP) shall not be allowed in production

**FR-SEC-004: PII Protection**
- System shall identify and protect Personally Identifiable Information (PII)
- Sensitive data (email, names) shall be masked in logs
- PII redaction shall be applied to debug information

**FR-SEC-005: Rate Limiting**
- API endpoints shall implement rate limiting
- Excessive requests shall be throttled/blocked
- Rate limit errors shall return appropriate HTTP status codes

---

## 3. Non-Functional Requirements

### 3.1 Performance

**NFR-PERF-001: Page Load Time**
- Initial page load shall complete within 3 seconds
- Navigation between screens shall be instantaneous (<500ms)
- Trend list rendering shall handle 50+ items smoothly

**NFR-PERF-002: API Response Time**
- API endpoints shall respond within 2 seconds
- Trend generation shall complete within 30 seconds
- Chat responses shall stream in real-time

**NFR-PERF-003: Database Optimization**
- Database queries shall use appropriate indexes
- Query response time shall be <500ms for standard operations
- Pagination shall be implemented for large datasets

### 3.2 Scalability

**NFR-SCAL-001: User Growth**
- System shall support 10,000+ concurrent users
- Database shall scale to handle millions of trends/data records
- API endpoints shall auto-scale based on demand

**NFR-SCAL-002: Data Growth**
- System shall efficiently handle growing data volumes
- Archive strategy for old trends may be implemented
- Search/filtering shall remain performant with large datasets

### 3.3 Availability & Reliability

**NFR-AVAIL-001: Uptime**
- System shall maintain 99.9% uptime
- Planned maintenance shall be communicated in advance
- Backup systems shall be in place for failover

**NFR-AVAIL-002: Error Recovery**
- Failed API requests shall be retried automatically
- Users shall receive clear error messages on failure
- Data loss shall not occur due to temporary failures

### 3.4 Usability

**NFR-USAB-001: Mobile Responsiveness**
- UI shall be fully responsive on mobile devices (320px+)
- Touch targets shall be minimum 44x44px (accessibility)
- Landscape orientation shall be supported

**NFR-USAB-002: Cross-browser Compatibility**
- Application shall work on Chrome, Firefox, Safari, Edge
- Mobile browsers shall be supported (iOS Safari, Chrome Mobile)

**NFR-USAB-003: Accessibility**
- WCAG 2.1 Level AA accessibility standards shall be followed
- Screen reader support shall be implemented
- Keyboard navigation shall be fully functional

**NFR-USAB-004: Internationalization (Future)**
- Application architecture shall support multiple languages
- UI strings shall be externalized for translation
- Date/time formatting shall be locale-aware

### 3.5 Maintainability

**NFR-MAINT-001: Code Organization**
- Code shall be organized into logical components
- Naming conventions shall be consistent and clear
- Comments/documentation shall explain complex logic

**NFR-MAINT-002: Testing**
- Unit tests shall cover core business logic
- Integration tests shall verify API endpoints
- E2E tests may be implemented for critical workflows

**NFR-MAINT-003: Logging & Monitoring**
- Application events shall be logged for debugging
- Errors shall be captured and monitored
- Performance metrics shall be tracked

---

## 4. System Architecture

### 4.1 Technology Stack

- **Frontend:** Next.js 14 with React 18, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui components
- **Backend:** Next.js API Routes, Node.js
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **AI Integration:** Google Generative AI, Azure AI Inference, various AI providers
- **Real-time:** Supabase real-time subscriptions
- **Deployment:** Vercel

### 4.2 Component Architecture

**Screens (Pages):**
- PrototypesScreen - View/manage prototypes
- TrendsScreen - View/manage trends
- UtilitiesScreen - Access utility tools
- AIChatScreen - AI chat interface
- TeamsScreen - Team management
- ProfileScreen - User profile management
- SettingsScreen - User settings

**Authentication Components:**
- LoginScreen - Email/password login
- RegisterScreen - New account creation
- ForgotPasswordScreen - Password reset

**Shared Components:**
- BottomNavigation - Mobile navigation
- Sidebar - Desktop navigation
- SplashScreen - Initial load animation
- OnboardingScreen - User onboarding

### 4.3 Data Models

**Users Table**
- id (UUID)
- email (string)
- password_hash (string)
- created_at (timestamp)
- updated_at (timestamp)

**Trends Table**
- id (UUID)
- user_id (UUID, foreign key)
- title (string)
- summary (text)
- interpretation (text)
- category (string)
- impact (text)
- detailed_research (text)
- prototype_prompt (text)
- sources (jsonb)
- is_heart (boolean)
- generation_type (enum: 'automatic', 'manual')
- created_at (timestamp)

**Prototypes Table**
- id (UUID)
- user_id (UUID, foreign key)
- trend_id (UUID, nullable foreign key)
- title (string)
- description (text)
- code (text)
- live_url (string, nullable)
- status (enum: 'draft', 'completed', 'deployed')
- created_at (timestamp)
- updated_at (timestamp)

**Teams Table**
- id (UUID)
- name (string)
- description (text)
- owner_id (UUID, foreign key)
- created_at (timestamp)

**Team Members Table**
- id (UUID)
- team_id (UUID, foreign key)
- user_id (UUID, foreign key)
- role (enum: 'admin', 'member')
- joined_at (timestamp)

**Messages Table**
- id (UUID)
- team_id (UUID, foreign key)
- user_id (UUID, foreign key)
- content (text)
- created_at (timestamp)

**Announcements Table**
- id (UUID)
- team_id (UUID, foreign key)
- user_id (UUID, foreign key)
- content (text)
- created_at (timestamp)

---

## 5. API Endpoints

### 5.1 Authentication Endpoints

- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - Sign out user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Set new password

### 5.2 Trend Endpoints

- `POST /api/research` - Generate new trends (bootstrap)
- `GET /api/trends` - List user's trends
- `GET /api/trends/{id}` - Get trend details
- `PUT /api/trends/{id}` - Update trend
- `DELETE /api/trends/{id}` - Delete trend

### 5.3 Prototype Endpoints

- `POST /api/prototypes/generate` - Generate prototype from trend
- `GET /api/prototypes` - List user's prototypes
- `GET /api/prototypes/{id}` - Get prototype details
- `PUT /api/prototypes/update-project` - Update prototype
- `PUT /api/prototypes/update-url` - Update live URL

### 5.4 AI Chat Endpoints

- `POST /api/ai-chat` - Send chat message
- `POST /api/ai-chat-simple` - Simple chat without context
- `POST /api/ai-chat/trends` - Chat with trends context
- `POST /api/ai-chat/utilities` - Chat for utilities

### 5.5 Team Endpoints

- `POST /api/teams` - Create new team
- `GET /api/teams` - List user's teams
- `GET /api/teams/{id}` - Get team details
- `POST /api/teams/join` - Join existing team
- `GET /api/teams/{id}/members` - List team members
- `POST /api/teams/{id}/members` - Add team member
- `GET /api/teams/{id}/messages` - Get team messages
- `POST /api/teams/{id}/messages` - Send team message
- `GET /api/teams/{id}/announcements` - Get announcements
- `POST /api/teams/{id}/announcements` - Create announcement
- `GET /api/teams/{id}/projects` - List team projects
- `POST /api/teams/{id}/projects` - Create team project

### 5.6 Dashboard Endpoints

- `POST /api/generate-dashboard` - Generate dashboard data
- `GET /api/news` - Fetch news/market data

---

## 6. User Stories

### US-001: User Registration & Onboarding
As a new user, I want to register an account and complete onboarding so I can start exploring trends and prototypes.

**Acceptance Criteria:**
- User can enter email and password to create account
- System validates email format and password strength
- User sees splash screen then onboarding tutorial
- User can skip onboarding and access main app

### US-002: Discover Market Trends
As a product manager, I want to see AI-generated market trends so I can identify new business opportunities.

**Acceptance Criteria:**
- System auto-generates 3 trends per week
- User can view all trends in a list
- Each trend shows title, summary, and category
- User can click to view full trend details with research

### US-003: Generate Product Prototypes
As a designer, I want to generate code prototypes from trends so I can quickly validate ideas.

**Acceptance Criteria:**
- User can click "Generate Prototype" from a trend
- System generates working code/UI
- User can view live preview of prototype
- User can update/modify prototype code

### US-004: Collaborate with Team
As a team lead, I want to create teams and invite members so we can collaborate on projects.

**Acceptance Criteria:**
- User can create team with name
- User can add members via email or code
- Team members can view shared projects
- Team members can message in team channel

### US-005: AI-Powered Research & Chat
As an analyst, I want to chat with AI about trends so I can get deeper market insights.

**Acceptance Criteria:**
- User can access AI chat screen
- AI can answer questions about trends
- Chat maintains conversation context
- AI provides research-backed responses

---

## 7. Constraints & Assumptions

### 7.1 Constraints

- Trend generation is limited to 3 automatic trends per week
- Only one instance of each trend title allowed per user
- Supabase is mandatory for authentication and data storage
- Mobile-first design approach required
- Must support modern browsers only (IE not supported)

### 7.2 Assumptions

- Users have valid email addresses
- Users have basic computer literacy
- Internet connection is stable and reliable
- Supabase service is available and stable
- AI models are accessible and functional

---

## 8. Success Criteria

1. **User Adoption:** 1,000+ active users within 6 months
2. **Trend Generation:** 95%+ accuracy in trend identification
3. **Prototype Quality:** Users rate prototypes 4+ out of 5 stars
4. **Performance:** Page load time <3 seconds, API response <2 seconds
5. **Uptime:** 99.9% system availability
6. **User Retention:** 40%+ monthly active user retention
7. **Team Collaboration:** 30%+ of users create or join teams

---

## 9. Future Enhancements

1. Integration with additional AI providers
2. Advanced analytics and reporting dashboard
3. Prototype deployment automation
4. Email notifications and alerts
5. Advanced search and filtering capabilities
6. Internationalization (multiple languages)
7. Mobile native apps (iOS/Android)
8. Third-party API integrations (Slack, GitHub, etc.)
9. Trend marketplace/sharing between users
10. Advanced team permission management

---

## 10. Glossary

- **Trend:** Market insight identifying emerging business opportunity
- **Prototype:** Working implementation/mockup of product idea
- **Automatic Generation:** System-generated trends (3 per week)
- **Manual Creation:** User-created trends (unlimited)
- **Bootstrap:** Initial trend generation when user has no existing trends
- **RLS:** Row Level Security - database feature restricting data access
- **PII:** Personally Identifiable Information (email, names, etc.)
- **Supabase:** Open-source Firebase alternative providing backend services

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-19 | v0 | Initial SRS creation |

