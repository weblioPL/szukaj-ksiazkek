# Development Stages

## Overview

The development is divided into 4 main stages, each building upon the previous one. Each stage delivers working functionality that can be tested and validated.

---

## Stage 1: MVP Foundations
**Goal**: Working authentication system with basic user management

### 1.1 Repository Setup
- [x] Initialize monorepo structure
- [x] Configure TypeScript
- [x] Set up shared packages
- [x] Configure linting and formatting

### 1.2 Backend Foundation
- [ ] Initialize NestJS project
- [ ] Configure Prisma with PostgreSQL
- [ ] Set up environment configuration
- [ ] Implement health check endpoint

### 1.3 Authentication Module
- [ ] User registration endpoint
- [ ] User login endpoint
- [ ] JWT token generation (access + refresh)
- [ ] Token refresh endpoint
- [ ] Password hashing (bcrypt)
- [ ] Auth guards and decorators

### 1.4 User Module
- [ ] Get user profile
- [ ] Update user profile
- [ ] Delete user account

### 1.5 Frontend Foundation
- [ ] Initialize Expo project
- [ ] Configure navigation (Expo Router)
- [ ] Set up NativeWind styling
- [ ] Configure TanStack Query
- [ ] Create API client

### 1.6 Frontend Auth Screens
- [ ] Login screen
- [ ] Registration screen
- [ ] Profile screen
- [ ] Secure token storage
- [ ] Auth state management

### Deliverables
- User can register, log in, view/edit profile
- Tokens are securely stored
- API is documented with Swagger

---

## Stage 2: Book Catalog & Offers
**Goal**: Searchable book catalog with BUYBOX offers integration

### 2.1 Book Module
- [ ] Books database schema
- [ ] Authors database schema
- [ ] Categories database schema
- [ ] Book CRUD operations
- [ ] Full-text search implementation
- [ ] Category filtering
- [ ] Format filtering

### 2.2 Offers Module (BUYBOX Integration)
- [ ] BUYBOX API client
- [ ] Fetch offers by ISBN
- [ ] Cache offers in database
- [ ] Offer refresh logic

### 2.3 Book Data Import
- [ ] Product feed parser
- [ ] Import pipeline
- [ ] Data normalization

### 2.4 Frontend Book Screens
- [ ] Book list/grid view
- [ ] Book detail screen
- [ ] Search interface
- [ ] Category browser
- [ ] Offers comparison view

### Deliverables
- Users can browse and search books
- Users can view offers from multiple stores
- Price comparison is available

---

## Stage 3: AI Chat & Recommendations
**Goal**: Working AI chat for book recommendations

### 3.1 Chat Module
- [ ] Conversations database schema
- [ ] Messages database schema
- [ ] Conversation CRUD
- [ ] Message history

### 3.2 Claude API Integration
- [ ] Anthropic SDK setup
- [ ] System prompt design
- [ ] Context building (user data)
- [ ] Streaming responses (SSE)
- [ ] Book mention extraction

### 3.3 Frontend Chat
- [ ] Chat screen
- [ ] Message bubbles
- [ ] Streaming text display
- [ ] Book card mentions
- [ ] Conversation list

### Deliverables
- Users can chat with AI about books
- AI provides personalized recommendations
- Chat history is preserved

---

## Stage 4: Personalization & User History
**Goal**: Full personalization system based on user behavior

### 4.1 User Books Module
- [ ] Reading status tracking
- [ ] Rating system
- [ ] Reviews (optional)
- [ ] Reading progress

### 4.2 Purchase History
- [ ] BUYBOX purchase sync
- [ ] Purchase display

### 4.3 Preferences Module
- [ ] Explicit preferences
- [ ] Implicit preference learning
- [ ] View tracking
- [ ] Preference weights calculation

### 4.4 Recommendations Engine
- [ ] Collaborative filtering (basic)
- [ ] Content-based filtering
- [ ] AI-enhanced recommendations
- [ ] Recommendation API

### 4.5 Frontend Personalization
- [ ] User bookshelf
- [ ] Reading status management
- [ ] Rating interface
- [ ] Purchase history view
- [ ] Preferences settings

### Deliverables
- Users can track their reading
- Recommendations improve over time
- Full preference management

---

## Timeline Estimate

| Stage | Description | Relative Effort |
|-------|-------------|-----------------|
| Stage 1 | MVP Foundations | 25% |
| Stage 2 | Book Catalog & Offers | 30% |
| Stage 3 | AI Chat & Recommendations | 25% |
| Stage 4 | Personalization | 20% |

---

## Testing Strategy

### Unit Tests
- All services and utilities
- Validation logic
- Business rules

### Integration Tests
- API endpoints
- Database operations
- External API mocks

### E2E Tests
- Critical user flows
- Authentication flow
- Book search and purchase flow
- Chat flow

---

## Deployment Strategy

### Development
- Local PostgreSQL (Docker)
- Local backend
- Expo development build

### Staging
- Railway (backend + database)
- Expo preview builds

### Production
- Railway or AWS (backend)
- Managed PostgreSQL
- EAS production builds
- App Store / Play Store
