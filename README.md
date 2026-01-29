# Szukaj Książek

A book discovery and recommendation platform for the Polish market, featuring AI-powered chat assistance and integration with BUYBOX for book offers.

## Features

- **Book Discovery**: Browse and search a comprehensive catalog of Polish books
- **AI Chat Assistant**: Get personalized book recommendations through Claude AI
- **Price Comparison**: View and compare offers from multiple bookstores via BUYBOX API
- **Personal Bookshelf**: Track your reading progress, rate books, and maintain wish lists
- **Cross-Platform**: Available on iOS, Android, and Web from a single codebase

## Tech Stack

### Frontend (Mobile & Web)
- **Expo** (React Native + Expo Router)
- **NativeWind** (Tailwind CSS for React Native)
- **TanStack Query** for data fetching
- **Zustand** for state management

### Backend
- **NestJS** with TypeScript
- **PostgreSQL** with **Prisma** ORM
- **JWT** authentication
- **Swagger/OpenAPI** documentation

### External Services
- **Anthropic Claude API** for AI chat
- **BUYBOX API** for book offers

## Project Structure

```
/szukaj-ksiazek
├── /apps
│   ├── /api              # NestJS backend
│   │   ├── /prisma       # Database schema & migrations
│   │   └── /src
│   │       ├── /common   # Shared utilities
│   │       ├── /config   # Configuration
│   │       └── /modules  # Feature modules
│   │           ├── /auth
│   │           ├── /books
│   │           ├── /chat
│   │           ├── /offers
│   │           └── /users
│   └── /mobile           # Expo app (iOS, Android, Web)
│       ├── /app          # Expo Router pages
│       └── /src
│           ├── /components
│           ├── /hooks
│           ├── /lib
│           └── /stores
├── /packages
│   └── /shared           # Shared types & utilities
├── /docs                 # Documentation
└── /infrastructure       # Docker & deployment configs
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Docker (for PostgreSQL)
- Expo CLI (`npm install -g expo-cli`)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/szukaj-ksiazek.git
   cd szukaj-ksiazek
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the database**
   ```bash
   cd infrastructure
   docker-compose up -d postgres
   ```

4. **Set up environment variables**
   ```bash
   # Backend
   cp apps/api/.env.example apps/api/.env
   # Edit apps/api/.env with your values

   # Mobile
   cp apps/mobile/.env.example apps/mobile/.env
   ```

5. **Run database migrations and seed**
   ```bash
   cd apps/api
   npx prisma migrate dev
   npx prisma db seed
   ```

6. **Start the backend**
   ```bash
   npm run dev:api
   ```

7. **Start the mobile app**
   ```bash
   npm run dev:mobile
   ```

### Running with Docker

```bash
cd infrastructure
docker-compose up -d
```

## Development

### Backend Commands

```bash
# Start development server
npm run dev:api

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Open Prisma Studio
cd apps/api && npx prisma studio
```

### Mobile Commands

```bash
# Start Expo dev server
npm run dev:mobile

# Start on specific platform
cd apps/mobile
expo start --ios
expo start --android
expo start --web
```

## API Documentation

When running the backend, Swagger documentation is available at:
```
http://localhost:3000/api/docs
```

## Testing

```bash
# Run all tests
npm test

# Run API tests
npm run test --workspace=@szukaj-ksiazek/api

# Run with coverage
npm run test:cov --workspace=@szukaj-ksiazek/api
```

## Deployment

### Backend (Railway/Render)

1. Connect your GitHub repository
2. Set environment variables
3. Deploy with automatic builds

### Mobile (Expo EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Environment Variables

### Backend (`apps/api/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Secret for access tokens |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens |
| `ANTHROPIC_API_KEY` | Claude API key |
| `BUYBOX_API_KEY` | BUYBOX API key |

### Mobile (`apps/mobile/.env`)

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend API URL |

## Development Stages

1. **Stage 1**: MVP Foundations ✅
   - Repository setup
   - Authentication system
   - Basic user management

2. **Stage 2**: Book Catalog & Offers (Next)
   - Full book catalog
   - BUYBOX integration
   - Search functionality

3. **Stage 3**: AI Chat & Recommendations
   - Claude API integration
   - Streaming responses
   - Context-aware recommendations

4. **Stage 4**: Personalization
   - User preferences
   - Reading history
   - Enhanced recommendations

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests
4. Submit a pull request

## License

MIT License - see LICENSE file for details
