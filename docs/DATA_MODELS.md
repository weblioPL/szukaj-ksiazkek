# Data Models

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │       │   books     │       │  authors    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │       │ id          │       │ id          │
│ email       │       │ isbn        │───────│ name        │
│ password    │       │ ean         │       │ bio         │
│ name        │       │ title       │       │ imageUrl    │
│ avatarUrl   │       │ description │       └─────────────┘
│ createdAt   │       │ coverUrl    │
│ updatedAt   │       │ publishedAt │       ┌─────────────┐
└──────┬──────┘       │ pageCount   │       │ categories  │
       │              │ language    │       ├─────────────┤
       │              │ authorId    │       │ id          │
       │              └──────┬──────┘       │ name        │
       │                     │              │ slug        │
       │                     │              │ parentId    │
       │              ┌──────┴──────┐       └─────────────┘
       │              │             │
       ▼              ▼             ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────────┐
│ user_books  │  │book_authors │  │ book_categories │
├─────────────┤  ├─────────────┤  ├─────────────────┤
│ userId      │  │ bookId      │  │ bookId          │
│ bookId      │  │ authorId    │  │ categoryId      │
│ status      │  │ role        │  └─────────────────┘
│ rating      │  └─────────────┘
│ review      │
│ startedAt   │  ┌─────────────┐  ┌─────────────┐
│ finishedAt  │  │conversations│  │  messages   │
└─────────────┘  ├─────────────┤  ├─────────────┤
                 │ id          │──│ id          │
       ┌─────────│ userId      │  │ conversationId│
       │         │ title       │  │ role        │
       │         │ createdAt   │  │ content     │
       │         └─────────────┘  │ metadata    │
       │                          │ createdAt   │
       │                          └─────────────┘
       │
       │         ┌─────────────┐  ┌─────────────┐
       │         │   offers    │  │ purchases   │
       │         ├─────────────┤  ├─────────────┤
       └─────────│ id          │  │ id          │
                 │ bookId      │  │ userId      │
                 │ store       │  │ bookId      │
                 │ format      │  │ offerId     │
                 │ price       │  │ price       │
                 │ currency    │  │ purchasedAt │
                 │ url         │  │ buyboxId    │
                 │ available   │  └─────────────┘
                 │ fetchedAt   │
                 └─────────────┘
```

## Detailed Schema

### Users Table

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255),
    avatar_url      TEXT,
    is_active       BOOLEAN DEFAULT true,
    is_verified     BOOLEAN DEFAULT false,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
```

### Refresh Tokens Table

```sql
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
```

### Authors Table

```sql
CREATE TABLE authors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    bio             TEXT,
    image_url       TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_authors_name ON authors(name);
```

### Categories Table

```sql
CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) UNIQUE NOT NULL,
    description     TEXT,
    parent_id       UUID REFERENCES categories(id),
    display_order   INTEGER DEFAULT 0,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
```

### Books Table

```sql
CREATE TABLE books (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    isbn            VARCHAR(13) UNIQUE,
    ean             VARCHAR(13),
    title           VARCHAR(500) NOT NULL,
    original_title  VARCHAR(500),
    description     TEXT,
    cover_url       TEXT,
    published_at    DATE,
    publisher       VARCHAR(255),
    page_count      INTEGER,
    language        VARCHAR(10) DEFAULT 'pl',

    -- Formats availability
    has_paper       BOOLEAN DEFAULT false,
    has_ebook       BOOLEAN DEFAULT false,
    has_audiobook   BOOLEAN DEFAULT false,

    -- Aggregated ratings
    avg_rating      DECIMAL(3, 2) DEFAULT 0,
    ratings_count   INTEGER DEFAULT 0,

    -- Full-text search
    search_vector   TSVECTOR,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_books_ean ON books(ean);
CREATE INDEX idx_books_title ON books(title);
CREATE INDEX idx_books_search ON books USING GIN(search_vector);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION books_search_update() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('polish', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('polish', COALESCE(NEW.description, '')), 'B');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER books_search_trigger
    BEFORE INSERT OR UPDATE ON books
    FOR EACH ROW EXECUTE FUNCTION books_search_update();
```

### Book Authors (Many-to-Many)

```sql
CREATE TABLE book_authors (
    book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    author_id       UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
    role            VARCHAR(50) DEFAULT 'author', -- author, translator, narrator, etc.
    display_order   INTEGER DEFAULT 0,
    PRIMARY KEY (book_id, author_id)
);

CREATE INDEX idx_book_authors_author ON book_authors(author_id);
```

### Book Categories (Many-to-Many)

```sql
CREATE TABLE book_categories (
    book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (book_id, category_id)
);

CREATE INDEX idx_book_categories_category ON book_categories(category_id);
```

### User Books (Reading Status & Ratings)

```sql
CREATE TYPE reading_status AS ENUM ('want_to_read', 'reading', 'read');

CREATE TABLE user_books (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    status          reading_status NOT NULL,
    rating          SMALLINT CHECK (rating >= 1 AND rating <= 5),
    review          TEXT,
    started_at      DATE,
    finished_at     DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, book_id)
);

CREATE INDEX idx_user_books_user ON user_books(user_id);
CREATE INDEX idx_user_books_book ON user_books(book_id);
CREATE INDEX idx_user_books_status ON user_books(status);
```

### User Book Views (Implicit Preferences)

```sql
CREATE TABLE user_book_views (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    view_duration   INTEGER, -- seconds spent on book page
    source          VARCHAR(50), -- search, recommendation, chat, browse
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_user_book_views_user ON user_book_views(user_id);
CREATE INDEX idx_user_book_views_book ON user_book_views(book_id);
CREATE INDEX idx_user_book_views_created ON user_book_views(created_at);
```

### User Preferences

```sql
CREATE TABLE user_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Explicit preferences
    favorite_genres JSONB DEFAULT '[]',
    favorite_authors JSONB DEFAULT '[]',
    preferred_formats JSONB DEFAULT '["paper", "ebook", "audiobook"]',

    -- Computed preferences (updated by background jobs)
    inferred_genres JSONB DEFAULT '{}', -- genre_id: weight
    inferred_authors JSONB DEFAULT '{}', -- author_id: weight

    -- Settings
    language        VARCHAR(10) DEFAULT 'pl',

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id)
);
```

### Conversations

```sql
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(255),
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_active ON conversations(is_active) WHERE is_active = true;
```

### Messages

```sql
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            message_role NOT NULL,
    content         TEXT NOT NULL,

    -- Metadata for assistant messages
    metadata        JSONB DEFAULT '{}', -- mentioned books, recommendations, etc.
    tokens_used     INTEGER,

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);
```

### Offers (Cached from BUYBOX)

```sql
CREATE TYPE book_format AS ENUM ('paper', 'ebook', 'audiobook');

CREATE TABLE offers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    buybox_id       VARCHAR(255), -- BUYBOX internal ID
    store_name      VARCHAR(255) NOT NULL,
    store_logo_url  TEXT,
    format          book_format NOT NULL,
    price           DECIMAL(10, 2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'PLN',
    original_price  DECIMAL(10, 2), -- before discount
    url             TEXT NOT NULL, -- affiliate link
    is_available    BOOLEAN DEFAULT true,
    fetched_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_offers_book ON offers(book_id);
CREATE INDEX idx_offers_format ON offers(format);
CREATE INDEX idx_offers_available ON offers(is_available) WHERE is_available = true;
```

### Purchases (From BUYBOX API)

```sql
CREATE TABLE purchases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id         UUID REFERENCES books(id),
    offer_id        UUID REFERENCES offers(id),
    buybox_order_id VARCHAR(255), -- BUYBOX order reference
    store_name      VARCHAR(255),
    format          book_format,
    price           DECIMAL(10, 2),
    currency        VARCHAR(3) DEFAULT 'PLN',
    purchased_at    TIMESTAMP WITH TIME ZONE,
    synced_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_purchases_user ON purchases(user_id);
CREATE INDEX idx_purchases_book ON purchases(book_id);
CREATE INDEX idx_purchases_date ON purchases(purchased_at);
```

## Prisma Schema (Implementation)

The above SQL translates to a Prisma schema that will be placed in `/apps/api/prisma/schema.prisma`.

## Data Access Patterns

### Common Queries

1. **Get user's bookshelf** (books with status)
```sql
SELECT b.*, ub.status, ub.rating
FROM books b
JOIN user_books ub ON b.id = ub.book_id
WHERE ub.user_id = $1
ORDER BY ub.updated_at DESC;
```

2. **Search books** (full-text)
```sql
SELECT *, ts_rank(search_vector, query) AS rank
FROM books, plainto_tsquery('polish', $1) query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 20;
```

3. **Get book offers** (sorted by price)
```sql
SELECT o.*, b.title
FROM offers o
JOIN books b ON o.book_id = b.id
WHERE o.book_id = $1 AND o.is_available = true
ORDER BY o.price ASC;
```

4. **Get AI chat context** (recent messages)
```sql
SELECT m.role, m.content, m.metadata
FROM messages m
WHERE m.conversation_id = $1
ORDER BY m.created_at DESC
LIMIT 20;
```

5. **Build user preference profile**
```sql
SELECT
    c.id as category_id,
    c.name,
    COUNT(*) as interaction_count,
    AVG(ub.rating) as avg_rating
FROM user_books ub
JOIN book_categories bc ON ub.book_id = bc.book_id
JOIN categories c ON bc.category_id = c.id
WHERE ub.user_id = $1
GROUP BY c.id, c.name
ORDER BY interaction_count DESC;
```

## Indexing Strategy

- **Primary lookups**: UUID primary keys with B-tree indexes
- **Foreign keys**: All foreign keys indexed
- **Text search**: GIN index on `search_vector`
- **Time-based queries**: Indexes on `created_at` columns
- **Partial indexes**: For boolean filters (e.g., `is_available`)

## Data Retention

- **Chat messages**: Keep indefinitely (user can delete conversation)
- **View history**: Archive after 90 days, aggregate
- **Offers**: Refresh daily, keep 30-day history for price trends
- **Purchases**: Keep indefinitely (legal requirement)
