# API Endpoints

Base URL: `/api/v1`

## Authentication

### POST `/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "Jan Kowalski"
}
```

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jan Kowalski"
  },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

### POST `/auth/login`
Authenticate and receive tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Jan Kowalski"
  },
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

### POST `/auth/refresh`
Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "jwt..."
}
```

**Response:** `200 OK`
```json
{
  "accessToken": "jwt...",
  "refreshToken": "jwt..."
}
```

### POST `/auth/logout`
Revoke refresh token.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "refreshToken": "jwt..."
}
```

**Response:** `204 No Content`

---

## Users

### GET `/users/me`
Get current user profile.

**Headers:** `Authorization: Bearer <accessToken>`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Jan Kowalski",
  "avatarUrl": "https://...",
  "createdAt": "2024-01-15T10:00:00Z"
}
```

### PATCH `/users/me`
Update current user profile.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "name": "Jan Nowak",
  "avatarUrl": "https://..."
}
```

**Response:** `200 OK`

### DELETE `/users/me`
Delete user account (GDPR).

**Headers:** `Authorization: Bearer <accessToken>`

**Response:** `204 No Content`

---

## Books

### GET `/books`
List books with filtering and pagination.

**Query Parameters:**
- `search` (string): Full-text search query
- `category` (string): Category slug
- `format` (string): `paper`, `ebook`, `audiobook`
- `author` (uuid): Author ID
- `page` (int): Page number (default: 1)
- `limit` (int): Items per page (default: 20, max: 100)
- `sort` (string): `relevance`, `title`, `rating`, `newest`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "isbn": "9788324012345",
      "title": "Atomic Habits",
      "authors": [{"id": "uuid", "name": "James Clear"}],
      "coverUrl": "https://...",
      "avgRating": 4.5,
      "ratingsCount": 1234,
      "formats": ["paper", "ebook", "audiobook"],
      "lowestPrice": {
        "paper": 39.99,
        "ebook": 29.99,
        "audiobook": 34.99
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### GET `/books/:id`
Get book details.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "isbn": "9788324012345",
  "ean": "9788324012345",
  "title": "Atomic Habits",
  "originalTitle": "Atomic Habits",
  "description": "A practical guide to building good habits...",
  "coverUrl": "https://...",
  "publishedAt": "2018-10-16",
  "publisher": "Penguin Random House",
  "pageCount": 320,
  "language": "pl",
  "authors": [
    {"id": "uuid", "name": "James Clear", "role": "author"}
  ],
  "categories": [
    {"id": "uuid", "name": "Rozwój osobisty", "slug": "rozwoj-osobisty"}
  ],
  "formats": {
    "paper": true,
    "ebook": true,
    "audiobook": true
  },
  "avgRating": 4.5,
  "ratingsCount": 1234,
  "userBook": {
    "status": "read",
    "rating": 5,
    "startedAt": "2024-01-01",
    "finishedAt": "2024-01-15"
  }
}
```

### GET `/books/:id/offers`
Get purchase offers for a book.

**Query Parameters:**
- `format` (string): Filter by format

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "storeName": "Empik",
      "storeLogoUrl": "https://...",
      "format": "paper",
      "price": 39.99,
      "originalPrice": 49.99,
      "currency": "PLN",
      "url": "https://...",
      "isAvailable": true
    }
  ]
}
```

### GET `/books/recommendations`
Get personalized book recommendations.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**
- `limit` (int): Number of recommendations (default: 10)
- `excludeRead` (bool): Exclude already read books (default: true)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "book": { /* book object */ },
      "reason": "Based on your interest in self-improvement books",
      "score": 0.92
    }
  ]
}
```

---

## Categories

### GET `/categories`
List all categories.

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Biznes i ekonomia",
      "slug": "biznes-i-ekonomia",
      "description": "Książki o biznesie...",
      "children": [
        {"id": "uuid", "name": "Marketing", "slug": "marketing"},
        {"id": "uuid", "name": "Finanse", "slug": "finanse"}
      ]
    }
  ]
}
```

---

## User Books (Bookshelf)

### GET `/user-books`
Get user's bookshelf.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**
- `status` (string): `want_to_read`, `reading`, `read`
- `page` (int)
- `limit` (int)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "book": { /* book summary */ },
      "status": "read",
      "rating": 5,
      "review": "Great book!",
      "startedAt": "2024-01-01",
      "finishedAt": "2024-01-15",
      "createdAt": "2024-01-01T10:00:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

### POST `/user-books`
Add book to bookshelf.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "bookId": "uuid",
  "status": "want_to_read"
}
```

**Response:** `201 Created`

### PATCH `/user-books/:bookId`
Update book status/rating.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "status": "read",
  "rating": 5,
  "review": "Excellent book!",
  "startedAt": "2024-01-01",
  "finishedAt": "2024-01-15"
}
```

**Response:** `200 OK`

### DELETE `/user-books/:bookId`
Remove book from bookshelf.

**Headers:** `Authorization: Bearer <accessToken>`

**Response:** `204 No Content`

---

## Chat

### GET `/conversations`
List user's conversations.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**
- `page` (int)
- `limit` (int)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Book recommendations for summer",
      "lastMessage": "I'd recommend...",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    }
  ]
}
```

### POST `/conversations`
Start a new conversation.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "message": "Szukam dobrej książki o inwestowaniu"
}
```

**Response:** `201 Created`
```json
{
  "conversationId": "uuid",
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Świetnie! Jakie masz doświadczenie z inwestowaniem?",
    "metadata": {
      "mentionedBooks": []
    }
  }
}
```

### GET `/conversations/:id`
Get conversation with messages.

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**
- `limit` (int): Number of messages (default: 50)
- `before` (uuid): Load messages before this ID (pagination)

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "title": "Book recommendations",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Szukam książki o inwestowaniu",
      "createdAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "uuid",
      "role": "assistant",
      "content": "Polecam 'Inteligentny Inwestor'...",
      "metadata": {
        "mentionedBooks": [
          {"id": "uuid", "title": "Inteligentny Inwestor", "isbn": "..."}
        ]
      },
      "createdAt": "2024-01-15T10:00:05Z"
    }
  ]
}
```

### POST `/conversations/:id/messages`
Send a message (streaming response via SSE).

**Headers:**
- `Authorization: Bearer <accessToken>`
- `Accept: text/event-stream`

**Request Body:**
```json
{
  "content": "Czy ta książka jest dobra dla początkujących?"
}
```

**Response:** `200 OK` (Server-Sent Events)
```
event: start
data: {"messageId": "uuid"}

event: token
data: {"content": "Tak, "}

event: token
data: {"content": "'Inteligentny Inwestor' "}

event: token
data: {"content": "jest świetna dla początkujących..."}

event: metadata
data: {"mentionedBooks": [...]}

event: done
data: {"tokensUsed": 150}
```

### DELETE `/conversations/:id`
Delete conversation.

**Headers:** `Authorization: Bearer <accessToken>`

**Response:** `204 No Content`

---

## User Preferences

### GET `/preferences`
Get user preferences.

**Headers:** `Authorization: Bearer <accessToken>`

**Response:** `200 OK`
```json
{
  "favoriteGenres": ["uuid1", "uuid2"],
  "favoriteAuthors": ["uuid1"],
  "preferredFormats": ["paper", "ebook"],
  "inferredPreferences": {
    "genres": [
      {"id": "uuid", "name": "Biznes", "weight": 0.8}
    ],
    "authors": [
      {"id": "uuid", "name": "James Clear", "weight": 0.6}
    ]
  }
}
```

### PATCH `/preferences`
Update explicit preferences.

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "favoriteGenres": ["uuid1", "uuid2"],
  "preferredFormats": ["ebook", "audiobook"]
}
```

**Response:** `200 OK`

---

## Purchases

### GET `/purchases`
Get user's purchase history (synced from BUYBOX).

**Headers:** `Authorization: Bearer <accessToken>`

**Query Parameters:**
- `page` (int)
- `limit` (int)

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "uuid",
      "book": { /* book summary */ },
      "storeName": "Empik",
      "format": "ebook",
      "price": 29.99,
      "currency": "PLN",
      "purchasedAt": "2024-01-10T15:30:00Z"
    }
  ],
  "pagination": { /* ... */ }
}
```

### POST `/purchases/sync`
Trigger sync with BUYBOX API.

**Headers:** `Authorization: Bearer <accessToken>`

**Response:** `202 Accepted`
```json
{
  "status": "syncing",
  "message": "Purchase history sync started"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "details": [
    {"field": "email", "message": "Invalid email format"}
  ]
}
```

### Common Status Codes

- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `422 Unprocessable Entity` - Business logic error
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Rate Limits

| Endpoint Category | Rate Limit |
|-------------------|------------|
| Authentication | 10 req/min |
| Chat messages | 20 req/min |
| General API | 100 req/min |
| Search | 30 req/min |

Headers included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
