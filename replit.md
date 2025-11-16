# Natural Products E-Commerce Platform

## Overview

This is a full-featured e-commerce platform for natural and organic products, built as a React SPA with a Node.js/Express backend. The application serves customers shopping for natural products while providing comprehensive admin tools for product management, order processing, and customer support.

The platform implements a role-based access control system supporting administrators, marketers, consultants, and customers. It integrates with third-party services for payments (YooKassa), delivery (CDEK, Boxberry), and email verification.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Routing:**
- React 18 with TypeScript for type safety
- Wouter for lightweight client-side routing
- Single Page Application (SPA) architecture

**UI & Styling:**
- Shadcn UI component library for consistent design system
- Tailwind CSS for utility-first styling
- Custom color palette: green (primary), beige, and gold accents
- Mobile-first responsive design approach
- Typography: Open Sans (body), Playfair Display/Lora (serif headings)

**State Management:**
- Zustand for global application state
- TanStack Query (React Query v5) for server state management and caching
- React Hook Form with Zod validation for form handling

**Design System:**
- Shadcn UI provides pre-built accessible components
- Custom theme configuration in Tailwind with CSS variables
- Light/dark mode support via ThemeProvider
- Consistent spacing using Tailwind units (4, 6, 8, 12, 16, 20, 24)

### Backend Architecture

**Server Framework:**
- Node.js with Express.js
- TypeScript for type safety across the stack
- RESTful API endpoints under `/api` prefix

**Authentication & Authorization:**
- JWT tokens for stateless authentication
- bcrypt for password hashing
- Role-based access control (RBAC) with middleware
- Token verification middleware (`authenticateToken`)
- Role requirement middleware (`requireRole`)

**File Upload:**
- Multer middleware for handling multipart/form-data
- Separate storage for product images and chat attachments
- File type validation (JPEG, PNG, WEBP only)
- Files stored in local `/uploads` directory

**Real-time Communication:**
- WebSocket server (ws library) for live support chat
- Token-based WebSocket authentication
- Mounted on `/ws` endpoint

### Data Storage Solutions

**Database:**
- PostgreSQL as the primary database
- Neon serverless PostgreSQL for cloud deployment
- Drizzle ORM for type-safe database queries and migrations

**Schema Design:**
- Users table with verification tokens and bonus balance
- User roles table for flexible role assignment (users can have multiple roles)
- Products and categories with hierarchical structure
- Orders with support for promocodes and bonus points
- Cart, wishlist, and comparison tables for user preferences
- Support messages with file attachments
- Payment cards and addresses for user convenience

**Key Features:**
- UUID primary keys for all tables
- Timestamps for created/updated tracking
- Soft delete patterns where applicable
- Indexing on foreign keys and frequently queried fields

### Authentication & Authorization

**Authentication Flow:**
- Email/password registration with email verification
- Verification tokens with expiration
- JWT tokens (7-day expiration) stored client-side
- Nodemailer for sending verification emails

**Authorization Roles:**
1. **Customer** - Default role for registered users
2. **Consultant** - Access to support chat only
3. **Marketer** - Product, category, promotion management
4. **Admin** - Full system access including user management

**Role Flexibility:**
- Users can have multiple concurrent roles
- Roles stored in separate `user_roles` table with unique constraint
- Middleware checks for required roles on protected routes

### External Dependencies

**Payment Integration:**
- YooKassa SDK for payment processing
- Handles online payments and payment status webhooks

**Delivery Services:**
- CDEK API for delivery calculations and tracking
- Boxberry API as alternative delivery option
- Multiple delivery methods supported per order

**Email Service:**
- Nodemailer for transactional emails
- SMTP configuration via environment variables
- Templates for verification, order confirmation, etc.

**Database Service:**
- Neon serverless PostgreSQL
- Connection pooling via `@neondatabase/serverless`
- WebSocket-based database connections

**Development Tools:**
- Vite for fast development and optimized builds
- Drizzle Kit for database migrations
- ESBuild for server bundling in production

### Business Logic

**Bonus System:**
- New users receive 100 bonus points on registration
- Cashback rates: 3% (<1000₽), 5% (<2500₽), 7% (<10000₽), 10% (≥10000₽)
- Bonuses cannot be earned when using promocodes or existing bonuses
- Maximum 20% of order can be paid with bonuses

**Promocode System:**
- Percentage-based discounts
- Minimum/maximum order amount restrictions
- Expiration dates
- Usage limits per user
- Active/inactive status toggle
- Uppercase code normalization

**Order Processing:**
- Multi-step checkout: address → delivery → payment → confirmation
- Integration with delivery services for cost calculation
- Support for multiple payment methods
- Order status tracking (pending, confirmed, shipped, delivered, cancelled)

## Recent Changes

### Fresh Replit Import Setup (November 16, 2025) - CURRENT SESSION

**GitHub Import Completed:**
- ✅ Successfully imported from GitHub repository  
- ✅ Installed all npm dependencies (607 packages including nanoid)
- ✅ Connected to existing PostgreSQL database (heliumdb on Helium instance)
- ✅ Pushed database schema successfully using Drizzle ORM (14 tables)
- ✅ Configured development workflow on port 5000 with webview output
- ✅ Verified frontend and backend are working correctly
- ✅ Configured deployment for autoscale (npm run build → npm run start)
- ✅ Server already correctly configured for Replit environment:
  - Binding to 0.0.0.0:5000 (server/index.ts line 76)
  - AllowedHosts: true configured in Vite (server/vite.ts line 26)
  - No code changes required
- ✅ All LSP diagnostics resolved

**Technical Configuration:**
- Development server: Combined Express + Vite on port 5000
- Production build: Vite build + ESBuild server bundling
- Database: PostgreSQL on Helium (DATABASE_URL: postgresql://postgres:password@helium/heliumdb?sslmode=disable)
- WebSocket: Support chat on `/ws` endpoint
- File uploads: Multer middleware for images and attachments
- Host configuration: 0.0.0.0:5000 (accessible via Replit webview)
- Vite HMR: Configured with allowedHosts: true for Replit proxy

**Application Status:**
- ✅ Frontend loads successfully with Russian locale (ЭкоМаркет - Natural Products E-Commerce)
- ✅ Backend API running on port 5000
- ✅ Database schema synchronized (14 tables)
- ✅ Development workflow running and tested with screenshot
- ✅ Deployment configuration set (autoscale with build step)
- ✅ Ready for development and testing

**Next Steps:**
- Application is fully functional and ready to use
- Can be published to production using Replit's deployment
- Add seed data if needed via `npm run seed` (or create seed script)

### Previous Import Setup (November 16, 2025)

### Multi-Role Access Control System Implementation (November 16, 2025)

**Completed:**
- ✅ Fixed backend role-based authorization system for marketers and consultants
- ✅ Updated requireRole middleware to support multiple roles (OR logic)
- ✅ Granted marketers full CRUD access to: categories, products, product images, promocodes, statistics
- ✅ Created new consultant-only endpoints: /api/support/conversations, /api/support/customer-info/:userId
- ✅ Implemented ProtectedRoute component for frontend role-based access control
- ✅ Updated App.tsx routing with role-based guards for all protected routes
- ✅ Enhanced AdminSidebar with dynamic menu filtering based on user roles
- ✅ Architecture review confirmed: all endpoints properly secured, no security issues

**Role Permissions Matrix:**
- **Admin**: Full system access (users, products, categories, orders, promocodes, support, statistics)
- **Marketer**: Product management (products, categories, product images, promocodes, statistics)
- **Consultant**: Support only (support conversations, customer information)
- **Customer**: Shopping features (cart, wishlist, comparison, orders)

**Technical Implementation:**
- Backend: requireRole("admin", "marketer") middleware on all marketer-accessible endpoints
- Backend: requireRole("admin", "consultant") on consultant support endpoints
- Frontend: ProtectedRoute component wraps routes with role checks
- Frontend: AdminSidebar filters menu items by authenticated user roles
- Storage: getAllSupportConversations() method for consultant conversation list view

### Fresh Replit Environment Setup (November 16, 2025)

**GitHub Import Completed:**
- ✅ Successfully imported from GitHub repository
- ✅ Installed all npm dependencies (606 packages)
- ✅ Connected to PostgreSQL database (Helium instance)
- ✅ Pushed database schema successfully using Drizzle ORM
- ✅ Configured development workflow on port 5000 with webview output
- ✅ Verified frontend and backend are working correctly
- ✅ Configured deployment for autoscale (npm run build → npm run start)
- ✅ Server binding to 0.0.0.0:5000 for Replit environment
- ✅ AllowedHosts configured in Vite for Replit proxy support (server/vite.ts line 26)
- ✅ Production build verified successfully

**Technical Configuration:**
- Development server: Combined Express + Vite on port 5000
- Production build: Vite build + ESBuild server bundling
- Database: PostgreSQL on Helium (DATABASE_URL configured)
- WebSocket: Support chat on `/ws` endpoint
- File uploads: Multer middleware for images and attachments
- Host configuration: Frontend on 0.0.0.0:5000 (accessible via Replit webview)

**Database Status:**
- Database: heliumdb on PostgreSQL Helium instance
- Schema: 14 tables pushed successfully via Drizzle
- Ready for seeding and application use

### Previous Replit Environment Setup (November 16, 2025)

**GitHub Import Completed:**
- ✅ Successfully imported from GitHub repository
- ✅ Installed all npm dependencies (606 packages)
- ✅ Connected to existing PostgreSQL database (DATABASE_URL configured)
- ✅ Pushed database schema successfully using Drizzle ORM
- ✅ Configured development workflow on port 5000 with webview output
- ✅ Verified frontend and backend are working correctly
- ✅ Configured deployment for autoscale (npm run build → npm run start)
- ✅ Server binding to 0.0.0.0:5000 for Replit environment
- ✅ AllowedHosts configured in Vite for Replit proxy support

**Technical Configuration:**
- Development server: Combined Express + Vite on port 5000
- Production build: Vite build + ESBuild server bundling
- Database: PostgreSQL via Neon serverless (WebSocket connections)
- WebSocket: Support chat on `/ws` endpoint
- File uploads: Multer middleware for images and attachments

### Previous Replit Environment Setup (November 15, 2025)

**Completed:**
- ✅ Imported GitHub repository and configured for Replit environment
- ✅ Installed Node.js 20 and all npm dependencies (587 packages)
- ✅ Created and configured PostgreSQL database (Helium)
- ✅ Pushed database schema using Drizzle ORM (14 tables)
- ✅ Ran seed script to populate initial data
- ✅ Configured development workflow on port 5000 with webview output
- ✅ Verified frontend loads correctly (React + Vite + TypeScript)
- ✅ Verified backend API is running (Express server on port 5000)
- ✅ Set up deployment configuration for autoscale with build step
- ✅ Created .gitignore for Node.js project

**Database Setup:**
- Database: PostgreSQL on Helium
- Connection: DATABASE_URL configured automatically
- Seed data: Admin user (admin@ecomarket.ru / admin123), 5 categories, 6 products
- All 14 tables created successfully

**Development Environment:**
- Server running on port 5000 (combined frontend + backend)
- Vite dev server with HMR in middleware mode
- Host: 0.0.0.0 (accessible in Replit webview)
- AllowedHosts: configured for Replit proxy

**Test Credentials:**
- Admin: admin@ecomarket.ru / admin123
- Roles: admin, marketer, consultant, customer

### Backend API Implementation (November 15, 2025)

**Completed:**
- ✅ Full REST API implementation in `server/routes.ts` with ~50 endpoints
- ✅ Authentication routes: register, login, verify-email, me, profile, password
- ✅ User data routes: addresses, payment cards (with Zod validation)
- ✅ Product routes: CRUD, filtering, search, image upload
- ✅ Shopping routes: cart, wishlist, comparison
- ✅ Order routes: create, get, update status, admin stats
- ✅ Promocode routes: CRUD for admin, validation for customers
- ✅ Support chat routes: messages, attachments
- ✅ WebSocket setup for real-time support chat (on `/ws` endpoint)
- ✅ Utility modules: auth.ts, email.ts, upload.ts, bonuses.ts, promocodes.ts
- ✅ Database storage layer with full CRUD operations for all 14 tables

**Key Features:**
- JWT authentication with role-based access control
- Zod validation on all mutation endpoints
- File upload with Multer (product images, chat attachments)
- WebSocket support for real-time chat broadcasting
- Bonus points calculation and promocode validation
- Email verification with Nodemailer

### Phase 1: Basic Frontend-Backend Integration (November 15, 2025) ✅

**Completed:**
- ✅ Created comprehensive API client layer (`client/src/lib/api.ts`) with typed request functions for all endpoints
- ✅ Implemented Zustand stores for global state:
  - `authStore.ts` - User authentication state, token management, login/logout
  - `cartStore.ts` - Shopping cart state with safe total calculations
- ✅ Created React Query hooks for server state management:
  - `useAuth.ts` - Authentication queries and mutations
  - `useCategories.ts` - Category data fetching
  - `useProducts.ts` - Product listing with filters and search
  - `useCart.ts` - Cart operations with authentication guards
- ✅ Integrated authentication pages with real API:
  - Login page with email/password validation
  - Registration page with form validation
  - Email verification page with token handling
- ✅ Integrated main user-facing pages with data fetching:
  - Home page with featured products and categories
  - Catalog page with filtering and search
  - Product detail page with add-to-cart
  - Cart page with quantity updates and totals
- ✅ Created `CartItemWithProduct` DTO type for proper cart data structure
- ✅ Backend enhancement: `getCartItems()` returns product data via JOIN with decimal normalization
- ✅ Frontend safety: Cart calculations handle null products, invalid prices, NaN values
- ✅ TypeScript type safety: Full end-to-end type checking between server and client
- ✅ Development workflow running successfully on port 5000

**Technical Achievements:**
- Type-safe API layer with proper error handling (ApiError class)
- Server/client data contract with CartItemWithProduct DTO
- Decimal field normalization (PostgreSQL decimal → string → number parsing)
- Authentication guards preventing queries when logged out
- Safe cart totals with null/NaN/negative price handling
- Auto-clearing cart on authentication errors

**Design Decisions:**
- Zustand for global UI state (lightweight, simple API)
- React Query for server state (caching, auto-refetch, optimistic updates)
- Shadcn UI components for consistent design system
- Form validation with React Hook Form + Zod
- JWT tokens stored in localStorage with auto-logout on 401

**Next Steps:**
- Phase 2: Advanced Features & User Experience
  - Protected routes component for authenticated pages
  - Header integration with real user data and cart count
  - Checkout flow (delivery selection, payment integration)
  - Admin panel pages (product management, order processing)
  - Support chat UI with WebSocket integration
- Phase 3: Polish & Production Readiness
  - Error boundaries and loading states
  - Responsive design improvements
  - Performance optimization
  - Integration tests
  - Deployment configuration