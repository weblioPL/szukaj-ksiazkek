-- Migration: Add timestamp fields for bookshelf tracking
-- Description: Add statusChangedAt and ratedAt fields to user_books table
-- for better preference tracking and recommendation freshness

-- Add status_changed_at column
ALTER TABLE "user_books" ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP(3);

-- Add rated_at column
ALTER TABLE "user_books" ADD COLUMN IF NOT EXISTS "rated_at" TIMESTAMP(3);

-- Create index on rated_at for efficient queries on recently rated books
CREATE INDEX IF NOT EXISTS "user_books_rated_at_idx" ON "user_books"("rated_at");

-- Backfill existing records:
-- Set status_changed_at to updated_at for records that have a status
UPDATE "user_books"
SET "status_changed_at" = "updated_at"
WHERE "status_changed_at" IS NULL;

-- Set rated_at to updated_at for records that have a rating
UPDATE "user_books"
SET "rated_at" = "updated_at"
WHERE "rating" IS NOT NULL AND "rated_at" IS NULL;
