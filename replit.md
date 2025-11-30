# E-Commerce Platform - Natural/Organic Products

## Overview

This is a full-stack e-commerce platform specialized in selling natural and organic products. The application features a React-based frontend with a Node.js/Express backend, using PostgreSQL with Drizzle ORM for data persistence. The platform includes comprehensive user management, product catalog, shopping cart, order processing, payment integration, and real-time customer support via WebSocket.

**Security Status:** All critical vulnerabilities from SECURITY_ANALYSIS_REPORT.md have been addressed as of November 30, 2025.

## Session & CSRF Security Fixes (November 30, 2025 - Final)

### Fixed Race Conditions ("Invisible Logout" Issue)

**Problem:** Users experienced authentication state inconsistency - frontend showed authenticated but backend rejected requests with 401/403 errors due to race conditions during session initialization.

**Root Cause:** CSRF token was generated before session was persisted to PostgreSQL, causing token validation failures on subsequent requests.

**Solution - Atomic Session Initialization:**
1. **Regenerate session** - Creates new session with unique ID
2. **Set user data** - Adds userId and roles to session object
3. **Save to database** - Persists session to PostgreSQL
4. **Verify in database** - Retry logic with exponential backoff ensures session is fully written before CSRF token generation
5. **Generate CSRF token** - Token is now guaranteed to match persisted session

**Implementation Details:**
- `verifySessionInDatabase()` now uses 10 retry attempts (not 5) with 100ms initial delay
- Exponential backoff: 100ms, 200ms, 400ms, 800ms... up to ~51 seconds total
- `getSessionIdentifier()` throws error instead of generating temporary IDs - prevents invalid CSRF tokens
- API types updated: login/register responses now include `csrfToken` in TypeScript
- `useRegister()` hook properly syncs state after registration

**Files Modified:**
- `server/middleware/csrf.ts` - Error thrown instead of temp ID
- `server/utils/sessionUtils.ts` - Retry parameters increased (10, 100)
- `server/routes/auth.routes.ts` - Already sends csrfToken in response
- `client/src/lib/api.ts` - Response types include csrfToken
- `client/src/hooks/useAuth.ts` - useRegister properly handles auth state
- `client/src/providers/auth-provider.tsx` - Checks sessionId cookie before GET /me
- `client/src/lib/api.ts` - Removed retry logic for 403 errors

**Result:** Session creation is now atomic and verified before CSRF token generation, eliminating race conditions. Users remain authenticated across page reloads.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build Tool:**
- React 18+ with TypeScript for type safety
- Vite as the build tool and development server
- Wouter for lightweight client-side routing

**State Management:**
- Zustand for global state management (auth, cart, chat)
- TanStack Query (React Query) for server state and caching
- Custom hooks pattern for reusable data-fetching logic

**UI Component System:**
- Shadcn/ui component library built on Radix UI primitives
- Tailwind CSS for utility-first styling with custom design tokens
- Theme system supporting light/dark modes
- Responsive design with mobile-first approach

**Key Design Decisions:**
- **Problem:** Need for consistent, accessible UI components
- **Solution:** Shadcn/ui provides pre-built, customizable components with accessibility built-in
- **Rationale:** Reduces development time while maintaining design consistency and WCAG compliance

### Backend Architecture

**Core Framework:**
- Express.js with TypeScript for type-safe API development
- RESTful API design with resource-based routing
- WebSocket server for real-time features (support chat, order notifications)

**Database Layer:**
- Drizzle ORM for type-safe database queries
- PostgreSQL as the primary database (via Neon serverless)
- Schema-first design with Zod validation

**Authentication & Security:**
- Session-based authentication using express-session with PostgreSQL store
- bcrypt for password hashing with timing-attack protection
- CSRF protection via double-submit cookie pattern
- Helmet.js for security headers
- Rate limiting on authentication and sensitive endpoints

**Key Design Decisions:**
- **Problem:** Need for real-time communication between customers and support staff
- **Solution:** WebSocket server with connection pooling and rate limiting
- **Rationale:** Enables instant messaging without polling overhead; connection limits prevent DoS attacks

- **Problem:** Secure session management across distributed environments
- **Solution:** PostgreSQL-backed session store with secure cookie configuration
- **Rationale:** Sessions persist across server restarts; database-backed storage enables horizontal scaling

### Business Logic Components

**Order Processing Pipeline:**
- Transaction-based order creation with stock validation
- Promocode validation with single-use and temporary types
- Bonus points system (3-10% cashback based on order value)
- Idempotency key mechanism to prevent duplicate order submissions

**Image Processing:**
- Sharp library for server-side image optimization
- Automatic format conversion to WebP for reduced bandwidth
- Size constraints (max 1200x1200px) with quality optimization
- Secure path validation to prevent directory traversal attacks

**Payment Integration:**
- YooKassa webhook handler for payment status updates
- HMAC signature verification for webhook authenticity
- Order status synchronization (pending → paid → processing → shipped → delivered)

**Key Design Decisions:**
- **Problem:** Users accidentally submitting duplicate orders
- **Solution:** Idempotency-Key header requirement with 24-hour expiry
- **Rationale:** Prevents double-charging while allowing legitimate retries

### Data Retention & Compliance

**Automated Cleanup Scheduler:**
- Deletes support messages older than 37 months (GDPR compliance)
- Anonymizes order data older than 37 months (preserves analytics while removing PII)
- Removes log files older than 120 days

**Key Design Decisions:**
- **Problem:** GDPR requires data minimization and retention limits
- **Solution:** Scheduled jobs that automatically purge old personal data
- **Rationale:** Automated compliance reduces manual intervention and legal risk

## Security Hardening (Applied: Nov 30, 2025)

### Critical Fixes

**1. Race Conditions (Orders & Bonuses):**
- Atomic database operations using single UPDATE with WHERE conditions
- Stock decrements verify sufficient quantity in same query
- Bonus deductions check balance atomically
- Generic error messages prevent information disclosure
- Detailed logging for monitoring (security, not sent to client)

**2. CORS Origin Validation:**
- Strict URL parsing with try-catch for malformed origins
- Whitelisted origins: FRONTEND_URL, REPLIT_DEV_DOMAIN
- Allows server-to-server (webhook) requests when Origin absent
- Returns 403 for invalid origins with detailed logging

**3. HTTPS & HSTS Enforcement:**
- HTTP→HTTPS redirect (307 status preserves POST/PUT methods)
- HSTS headers: max-age=31536000, includeSubDomains, preload
- Production-only enforcement via NODE_ENV check
- Trust proxy setting for X-Forwarded-Proto header

**4. WebSocket Security:**
- Session expiration validation on connect (blocks expired sessions)
- Concurrent connection limits: 5 per IP address
- Origin validation (CSRF protection via Upgrade request header)
- Message size limits: 64KB max per message
- Rate limiting: 20 messages per 60 seconds per user
- Proper cleanup on close/error events (prevents IP blocking)

**5. SQL Injection Prevention:**
- Migrated LIKE to Drizzle ORM's parameterized `ilike()` function
- Wildcard search preserved with safe parameter binding
- Case-insensitive search maintained

**6. Path Traversal Protection:**
- Image pipeline validates resolved paths against base directories
- Checks both final and temp paths before write operations
- Logs and rejects suspicious path attempts

**7. Information Disclosure:**
- Generic error messages for promocodes ("Invalid or expired")
- Detailed errors logged server-side only
- No enumeration vectors for valid promocode codes

### Database Schema Security

- Default values enforced via `$defaultFn()` for bonus_balance and stock_quantity
- Application-level validation prevents negative values
- Note: CHECK constraints attempted but not supported by Drizzle ORM builder API

## External Dependencies

### Third-Party Services

**Database:**
- **Neon Serverless PostgreSQL** - Primary data store
- Connection pooling (max 20 connections, 30s idle timeout)
- WebSocket-based connection for serverless environments

**Email Service:**
- **Nodemailer** with SMTP transport
- Verification emails for account activation
- Order confirmation and shipping notifications
- Configuration via environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS)

**Payment Gateway:**
- **YooKassa** - Russian payment processor
- Webhook integration for payment status updates
- HMAC-SHA256 signature verification
- Configuration: YUKASSA_SHOP_ID, YUKASSA_SECRET_KEY

**Shipping/Delivery APIs (Configured but not fully implemented):**
- CDEK API (CLIENT_ID, CLIENT_SECRET)
- Boxberry API (API_TOKEN)

### npm Packages - Critical Dependencies

**Backend:**
- `express` - Web framework
- `drizzle-orm` + `drizzle-kit` - Type-safe ORM
- `@neondatabase/serverless` - Neon PostgreSQL driver with WebSocket support
- `bcryptjs` - Password hashing
- `express-session` + `connect-pg-simple` - Session management
- `helmet` - Security headers
- `cors` - CORS middleware
- `csrf-csrf` - CSRF protection
- `express-rate-limit` - Rate limiting
- `multer` - File upload handling
- `sharp` - Image processing
- `ws` - WebSocket server
- `winston` - Structured logging
- `zod` - Runtime schema validation

**Frontend:**
- `react` + `react-dom` - UI framework
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management
- `wouter` - Routing
- `react-hook-form` + `@hookform/resolvers` - Form handling
- All `@radix-ui/*` packages - Accessible UI primitives
- `tailwindcss` - Utility-first CSS framework
- `date-fns` - Date formatting

### Environment Configuration

**Required Variables:**
- `DATABASE_URL` - PostgreSQL connection string (validated as URL)
- `SESSION_SECRET` - Minimum 32 characters for session encryption

**Optional Variables:**
- `NODE_ENV` - development/production/test
- `FRONTEND_URL` - For CORS in production
- `REPLIT_DEV_DOMAIN` - Replit-specific domain for dev
- Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `SITE_URL`
- Payment: `YUKASSA_SHOP_ID`, `YUKASSA_SECRET_KEY`
- Shipping: `CDEK_CLIENT_ID`, `CDEK_CLIENT_SECRET`, `BOXBERRY_API_TOKEN`

**Security Notes:**
- Auto-generates SESSION_SECRET in development (warns user)
- Exits with error in production if SESSION_SECRET missing or too short
- Forces HTTPS redirect in production
- CORS restricted to whitelisted origins in production