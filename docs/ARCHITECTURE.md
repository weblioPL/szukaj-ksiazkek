# Szukaj Książek - System Architecture

## Overview

Szukaj Książek is a book discovery and recommendation platform that helps Polish users find, rate, and purchase books through an AI-powered chat interface.

## Technology Stack

### Frontend (Shared Codebase)
- **Framework**: Expo (React Native + Expo Router)
- **State Management**: Zustand
- **API Client**: TanStack Query (React Query)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Forms**: React Hook Form + Zod
- **Language**: TypeScript

### Backend
- **Framework**: NestJS
- **ORM**: Prisma
- **Runtime**: Node.js 20+
- **API Style**: REST with OpenAPI/Swagger documentation
- **Language**: TypeScript

### Database
- **Primary**: PostgreSQL 15+
- **Cache**: Redis (future)

### External Services
- **AI**: Anthropic Claude API
- **Offers/Purchases**: BUYBOX API
- **Book Data**: Product feeds from bookstores

## System Components

### 1. Authentication Module (`/api/auth`)
Handles user registration, login, and session management.

- JWT-based authentication with refresh tokens
- Access tokens: 15 minutes validity
- Refresh tokens: 7 days validity
- Password hashing with bcrypt (12 rounds)
- Future: Social login (Google, Facebook, Apple)

### 2. Users Module (`/api/users`)
Manages user profiles and account settings.

- Profile information (name, email, avatar)
- Reading preferences (genres, formats)
- Privacy settings
- Account deletion (GDPR compliance)

### 3. Books Module (`/api/books`)
Central book catalog management.

- Book metadata (title, author, ISBN, description)
- Categories and genres
- Formats (paper, ebook, audiobook)
- Search and filtering (full-text search via PostgreSQL)
- Multi-language support ready (currently Polish only)

### 4. Offers Module (`/api/offers`)
Integrates with BUYBOX API for pricing and availability.

- Fetch offers by ISBN
- Compare prices across stores
- Track price history
- Handle affiliate links

### 5. Ratings Module (`/api/ratings`)
User book interactions and ratings.

- Reading status (want-to-read, reading, read)
- Star ratings (1-5)
- Optional text reviews
- Reading progress tracking

### 6. Chat Module (`/api/chat`)
AI-powered book recommendations via Claude.

- Conversation management
- Context injection (user preferences, history)
- Streaming responses (SSE)
- Message history persistence

### 7. Preferences Module (`/api/preferences`)
Learns and stores user preferences.

- Implicit signals (views, searches, time spent)
- Explicit preferences (favorite genres, authors)
- Purchase history analysis
- Recommendation weights

## Data Flow

### Book Discovery Flow
```
User Search → Books Module → PostgreSQL (full-text search)
                          → BUYBOX API (offers)
                          → AI Enhancement (optional)
           ← Aggregated Results
```

### AI Chat Flow
```
User Message → Chat Module → Build Context (preferences, history)
                           → Claude API (with context)
                           → Parse Response
                           → Extract Book Mentions
                           → Enrich with Offers
            ← Streamed Response with Book Cards
```

### Preference Learning Flow
```
User Action → Event Capture → Preferences Module
                            → Update Weights
                            → Recalculate Recommendations
```

## Database Schema (High-Level)

### Core Entities
- `users` - User accounts
- `books` - Book catalog
- `authors` - Book authors
- `categories` - Book categories/genres
- `book_categories` - Many-to-many relation

### User Interactions
- `user_books` - Reading status and ratings
- `user_book_views` - View history
- `user_preferences` - Explicit preferences

### Chat
- `conversations` - Chat sessions
- `messages` - Individual messages

### External Data
- `offers` - Cached BUYBOX offers
- `purchases` - User purchase history (from BUYBOX)

## API Design Principles

1. **RESTful endpoints** with consistent naming
2. **Versioned API** (`/api/v1/...`)
3. **Pagination** for list endpoints
4. **Consistent error responses**
5. **OpenAPI documentation**

## Security Considerations

1. **Authentication**: JWT with secure storage
2. **Authorization**: Role-based (user, admin)
3. **Input Validation**: Zod schemas on both ends
4. **Rate Limiting**: Per-user and per-IP
5. **CORS**: Whitelist allowed origins
6. **Secrets**: Environment variables, never committed

## GDPR Compliance

1. **Data Minimization**: Only collect necessary data
2. **User Control**: Export and delete user data
3. **Consent**: Clear opt-in for data collection
4. **Transparency**: Document data usage

## Scalability Path

### Phase 1 (MVP)
- Single PostgreSQL instance
- Single backend instance
- Basic caching in memory

### Phase 2
- Redis for caching and sessions
- Background job processing (Bull)
- CDN for static assets

### Phase 3
- Database read replicas
- Horizontal backend scaling
- Message queue for async operations

## Directory Structure

```
/szukaj-ksiazek
├── /apps
│   ├── /mobile          # Expo app (iOS, Android, Web)
│   └── /api             # NestJS backend
├── /packages
│   ├── /shared          # Shared types, utilities
│   └── /ui              # Shared UI components
├── /docs                # Documentation
├── /scripts             # Build and deploy scripts
└── /infrastructure      # Docker, CI/CD configs
```

## Development Stages

### Stage 1: MVP Foundations
- Repository structure
- Backend setup with auth
- Frontend setup with navigation
- Basic user registration/login

### Stage 2: Book Catalog & Offers
- Database schema for books
- Book CRUD operations
- BUYBOX API integration
- Search functionality

### Stage 3: AI Chat & Recommendations
- Claude API integration
- Chat interface
- Context building
- Streaming responses

### Stage 4: Personalization
- Preference tracking
- Recommendation engine
- Reading history
- Enhanced AI context
