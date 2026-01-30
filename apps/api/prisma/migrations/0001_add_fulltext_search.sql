-- Full-text search for books table
-- This migration adds a search_vector column and trigger for automatic updates

-- Add search_vector column
ALTER TABLE books ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

-- Create index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_books_search ON books USING GIN(search_vector);

-- Function to update search_vector automatically
CREATE OR REPLACE FUNCTION books_search_update() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.original_title, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'C') ||
        setweight(to_tsvector('simple', COALESCE(NEW.publisher, '')), 'D');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Trigger to call the function on insert/update
DROP TRIGGER IF EXISTS books_search_trigger ON books;
CREATE TRIGGER books_search_trigger
    BEFORE INSERT OR UPDATE OF title, original_title, description, publisher
    ON books
    FOR EACH ROW
    EXECUTE FUNCTION books_search_update();

-- Update existing rows
UPDATE books SET search_vector =
    setweight(to_tsvector('simple', COALESCE(title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(original_title, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(description, '')), 'C') ||
    setweight(to_tsvector('simple', COALESCE(publisher, '')), 'D');

-- Create function for searching books with author names
-- This will be called from the application
CREATE OR REPLACE FUNCTION search_books(
    search_query TEXT,
    category_slug TEXT DEFAULT NULL,
    book_format TEXT DEFAULT NULL,
    page_num INT DEFAULT 1,
    page_size INT DEFAULT 20
)
RETURNS TABLE (
    book_id UUID,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        b.id AS book_id,
        ts_rank(b.search_vector, plainto_tsquery('simple', search_query)) +
        CASE WHEN a.name ILIKE '%' || search_query || '%' THEN 0.5 ELSE 0 END AS rank
    FROM books b
    LEFT JOIN book_authors ba ON b.id = ba.book_id
    LEFT JOIN authors a ON ba.author_id = a.id
    LEFT JOIN book_categories bc ON b.id = bc.book_id
    LEFT JOIN categories c ON bc.category_id = c.id
    WHERE
        (
            b.search_vector @@ plainto_tsquery('simple', search_query)
            OR a.name ILIKE '%' || search_query || '%'
            OR b.isbn = search_query
            OR b.ean = search_query
        )
        AND (category_slug IS NULL OR c.slug = category_slug)
        AND (
            book_format IS NULL
            OR (book_format = 'paper' AND b.has_paper = true)
            OR (book_format = 'ebook' AND b.has_ebook = true)
            OR (book_format = 'audiobook' AND b.has_audiobook = true)
        )
    ORDER BY rank DESC
    LIMIT page_size
    OFFSET (page_num - 1) * page_size;
END;
$$ LANGUAGE plpgsql;
