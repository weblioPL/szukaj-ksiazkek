#!/bin/sh
set -e

echo "🚀 Starting szukaj-ksiazek API..."

# Run database migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
    echo "📦 Running database migrations..."

    # Wait for database to be ready (with timeout)
    MAX_RETRIES=30
    RETRY_COUNT=0

    until npx prisma migrate deploy 2>/dev/null; do
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
            echo "❌ Database migration failed after $MAX_RETRIES attempts"
            exit 1
        fi
        echo "⏳ Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
        sleep 2
    done

    echo "✅ Database migrations completed successfully"
else
    echo "⚠️  DATABASE_URL not set, skipping migrations"
fi

# Execute the main command
echo "🎯 Starting application..."
exec "$@"
