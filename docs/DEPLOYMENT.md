# Deployment Guide - Szukaj Książek

This guide covers deploying the Szukaj Książek application to production.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Local Development with Docker](#local-development-with-docker)
5. [Production Deployment Options](#production-deployment-options)
6. [Database Setup](#database-setup)
7. [Running Migrations](#running-migrations)
8. [Health Checks](#health-checks)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│    API Server   │────▶│   PostgreSQL    │
│  (Expo/React    │     │    (NestJS)     │     │                 │
│    Native)      │     │                 │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  External APIs  │
                        │  - Anthropic    │
                        │  - BUYBOX       │
                        └─────────────────┘
```

## Prerequisites

- Docker and Docker Compose (for containerized deployment)
- Node.js 20+ (for local development)
- PostgreSQL 15+ (if not using Docker)
- Anthropic API key (for AI features)
- (Optional) BUYBOX credentials (for price comparison)

---

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_ACCESS_SECRET` | Secret for JWT access tokens | Generate with `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Secret for JWT refresh tokens | Generate with `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | `sk-ant-...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3000` |
| `NODE_ENV` | Environment mode | `development` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:8081` |
| `BUYBOX_WIDGET_ID` | BUYBOX widget ID | - |
| `BUYBOX_API_TOKEN` | BUYBOX API token | - |
| `USE_MOCK_PURCHASES` | Use mock purchase data | `true` |

### Generating Secrets

```bash
# Generate secure JWT secrets
openssl rand -base64 32  # For JWT_ACCESS_SECRET
openssl rand -base64 32  # For JWT_REFRESH_SECRET
```

---

## Local Development with Docker

### Quick Start

1. **Clone and configure**:
   ```bash
   git clone <repository-url>
   cd szukaj-ksiazek

   # Copy environment template
   cp .env.example .env

   # Edit .env with your values
   nano .env
   ```

2. **Start services**:
   ```bash
   cd infrastructure
   docker-compose up -d
   ```

3. **Check status**:
   ```bash
   docker-compose ps
   docker-compose logs -f api
   ```

4. **Access the API**:
   - API: http://localhost:3000/api/v1
   - Swagger Docs: http://localhost:3000/api/docs
   - Health Check: http://localhost:3000/api/v1/health

### Stopping Services

```bash
cd infrastructure
docker-compose down

# To also remove volumes (database data):
docker-compose down -v
```

---

## Production Deployment Options

### Option 1: Railway (Recommended for simplicity)

Railway provides easy deployment with built-in PostgreSQL.

1. **Create account**: https://railway.app

2. **Deploy from GitHub**:
   - Connect your GitHub repository
   - Railway auto-detects the Dockerfile

3. **Add PostgreSQL**:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway automatically sets `DATABASE_URL`

4. **Set environment variables**:
   ```
   JWT_ACCESS_SECRET=<your-secret>
   JWT_REFRESH_SECRET=<your-secret>
   ANTHROPIC_API_KEY=<your-key>
   NODE_ENV=production
   CORS_ORIGINS=https://your-app-domain.com
   ```

5. **Configure health check**:
   - Path: `/api/v1/health`
   - Timeout: 30s

### Option 2: Fly.io

1. **Install CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth login
   ```

2. **Create app**:
   ```bash
   cd apps/api
   fly launch --no-deploy
   ```

3. **Create PostgreSQL**:
   ```bash
   fly postgres create --name szukaj-ksiazek-db
   fly postgres attach szukaj-ksiazek-db
   ```

4. **Set secrets**:
   ```bash
   fly secrets set JWT_ACCESS_SECRET="<secret>"
   fly secrets set JWT_REFRESH_SECRET="<secret>"
   fly secrets set ANTHROPIC_API_KEY="<key>"
   ```

5. **Deploy**:
   ```bash
   fly deploy
   ```

### Option 3: Render

1. **Create account**: https://render.com

2. **New Web Service**:
   - Connect GitHub repository
   - Set root directory: `apps/api`
   - Build command: (auto-detected from Dockerfile)

3. **Add PostgreSQL**:
   - Create new PostgreSQL database
   - Copy internal connection string to `DATABASE_URL`

4. **Environment variables**: Set as shown above

### Option 4: DigitalOcean App Platform

1. **Create App**:
   - Connect GitHub
   - Select repository and branch

2. **Configure**:
   - Source: `apps/api`
   - Dockerfile path: `apps/api/Dockerfile`

3. **Add Database**:
   - Create managed PostgreSQL
   - Link to app

4. **Deploy**

### Option 5: VPS (Manual)

For a VPS (Ubuntu 22.04):

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 3. Clone repository
git clone <repository-url> /opt/szukaj-ksiazek
cd /opt/szukaj-ksiazek

# 4. Configure environment
cp .env.example .env
nano .env  # Add production values

# 5. Start services
cd infrastructure
docker-compose up -d

# 6. Set up reverse proxy (nginx)
sudo apt install nginx certbot python3-certbot-nginx
# Configure nginx to proxy to localhost:3000
```

---

## Database Setup

### Initial Setup

Migrations run automatically on container startup via `docker-entrypoint.sh`.

### Manual Migration

If needed, run migrations manually:

```bash
# Local development
cd apps/api
npx prisma migrate deploy

# In Docker
docker exec -it szukaj-ksiazek-api npx prisma migrate deploy
```

### Creating New Migrations

During development:

```bash
cd apps/api
npx prisma migrate dev --name <migration-name>
```

### Database Backup

```bash
# Backup
docker exec szukaj-ksiazek-db pg_dump -U postgres szukaj_ksiazek > backup.sql

# Restore
docker exec -i szukaj-ksiazek-db psql -U postgres szukaj_ksiazek < backup.sql
```

---

## Running Migrations

### In Production

Migrations run automatically when the container starts. The `docker-entrypoint.sh` script:

1. Waits for database to be ready
2. Runs `npx prisma migrate deploy`
3. Starts the application

### Manual Migration (if needed)

```bash
# SSH into your server or use your platform's console

# For Docker deployment
docker exec -it szukaj-ksiazek-api npx prisma migrate deploy

# For Railway/Render/Fly.io
# Use their respective CLI or console to run:
npx prisma migrate deploy
```

---

## Health Checks

### Endpoint

```
GET /api/v1/health
```

### Response

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "services": {
    "database": "healthy"
  }
}
```

### Docker Health Check

The Dockerfile includes a built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/v1/health || exit 1
```

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs api

# Common issues:
# - DATABASE_URL incorrect
# - Database not ready (wait and retry)
# - Missing environment variables
```

### Database connection errors

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check connection from API container
docker exec szukaj-ksiazek-api nc -zv postgres 5432
```

### Migration failures

```bash
# Check migration status
docker exec -it szukaj-ksiazek-api npx prisma migrate status

# Reset database (CAUTION: destroys data)
docker exec -it szukaj-ksiazek-api npx prisma migrate reset
```

### High memory usage

- Check for memory leaks in logs
- Increase container memory limits
- Enable swap on VPS

### API returns 500 errors

```bash
# Check application logs
docker-compose logs -f api

# Common causes:
# - Missing ANTHROPIC_API_KEY
# - Database query errors
# - Invalid JWT secrets
```

---

## CI/CD Pipeline

The repository includes GitHub Actions for:

1. **Lint & Test**: Runs on every push/PR
2. **Docker Build**: Builds image on push to main/develop
3. **Docker Push**: Pushes to GitHub Container Registry on main

### Triggering Deployment

Most platforms support automatic deployment on push:

- **Railway**: Auto-deploys on push to main
- **Render**: Auto-deploys on push to main
- **Fly.io**: Use `fly deploy` or set up GitHub Action

---

## Security Checklist

- [ ] Generate unique JWT secrets for production
- [ ] Use HTTPS (via reverse proxy or platform)
- [ ] Set restrictive CORS_ORIGINS
- [ ] Never commit `.env` files
- [ ] Enable database connection SSL in production
- [ ] Set up monitoring and alerting
- [ ] Configure rate limiting (TODO)
- [ ] Set up log aggregation (TODO)

---

## Support

For issues:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review container logs
3. Open an issue on GitHub
