# BUYBOX Transactions API Integration

This document describes the integration with the BUYBOX Transactions API for fetching user purchase history.

## API Overview

The BUYBOX Transactions API allows fetching transaction/purchase data for a publisher account (Space).

**Base URL:** `https://api.buybox.click`

**Endpoint:** `GET /api/v1/spaces/{spaceId}/transactions`

## Authentication

Authentication is done via API token passed as a query parameter:

```
?api-token={ApiKey}
```

## Query Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `api-token` | Yes | API key from BUYBOX publisher panel |
| `transaction` | No | Filter by specific transaction ID |
| `campaign` | No | Filter by campaign ID (store). Omit to get all. |
| `from` | No | Start date in YYYY-MM-DD format |
| `to` | No | End date in YYYY-MM-DD format |
| `page` | No | Pagination page number |
| `per-page` | No | Items per page (default: 50) |

## Full URL Example

```
https://api.buybox.click/api/v1/spaces/{spaceId}/transactions?transaction={transactionId}&campaign={campaignId}&from={dateFrom}&to={dateTo}&page={page}&per-page={rowsPerPage}&api-token={ApiKey}
```

## Response Format

### Successful Response

```json
{
  "transactions": [
    {
      "transId": "TRX123456",
      "amount": 49.99,
      "date": "2024-01-15",
      "spaceId": "space123",
      "campId": "empik",
      "status": "accept",
      "publisherCommissionAmount": 2.50,
      "abpar1": "9788328705326",
      "abpar2": "ebook",
      "abpar3": ""
    }
  ],
  "count": 5
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `transId` | string | Unique transaction identifier |
| `amount` | number | Transaction amount (purchase price) |
| `date` | string | Transaction date (YYYY-MM-DD or ISO format) |
| `spaceId` | string | Publisher space ID |
| `campId` | string | Campaign/store identifier |
| `status` | string | Transaction status: `"new"`, `"accept"`, `"reject"` |
| `publisherCommissionAmount` | number | Publisher commission for this transaction |
| `abpar1` | string | Affiliate parameter 1 (often ISBN/EAN) |
| `abpar2` | string | Affiliate parameter 2 (often format) |
| `abpar3` | string | Affiliate parameter 3 (additional data) |
| `count` | number | Total number of pages (for pagination) |

### Transaction Status Values

- `new` - Transaction is pending validation
- `accept` - Transaction has been approved/confirmed
- `reject` - Transaction was rejected (e.g., returned item)

## Environment Variables

Configure the following environment variables in your `.env` file:

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `BUYBOX_API_TOKEN` | API token from BUYBOX publisher panel | `"abc123..."` |
| `BUYBOX_SPACE_ID` | Your publisher space ID | `"space123"` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `BUYBOX_API_BASE_URL` | `https://api.buybox.click` | API base URL |
| `BUYBOX_TIMEOUT` | `10000` | Request timeout (ms) |
| `BUYBOX_CACHE_TTL` | `3600` | Cache TTL (seconds) |
| `BUYBOX_MAX_RETRIES` | `3` | Max retry attempts |
| `BUYBOX_TRANSACTIONS_PER_PAGE` | `50` | Items per page |
| `BUYBOX_TRANSACTIONS_LOOKBACK_DAYS` | `90` | Initial sync lookback period |
| `BUYBOX_TRANSACTIONS_MAX_PAGES` | `20` | Safety limit for pagination |
| `BUYBOX_CAMPAIGN_MAPPINGS` | `""` | JSON array of campaign-to-store mappings |
| `USE_MOCK_PURCHASES` | auto | Force mock provider (`true`/`false`) |

### Campaign Mappings Example

```bash
BUYBOX_CAMPAIGN_MAPPINGS='[
  {"campId": "empik", "storeName": "Empik", "storeLogoUrl": "https://..."},
  {"campId": "gandalf", "storeName": "Gandalf"}
]'
```

## Book Matching

The integration attempts to match transactions to catalog books using:

1. **ISBN-13** from `abpar1` (13 digits starting with 978 or 979)
2. **ISBN-10** from `abpar1` (10 characters, last can be X)
3. **EAN-13** from `abpar1` (13 digits)
4. **Fallback to `abpar3`** if `abpar1` doesn't contain valid identifier

If no ISBN/EAN is found, the transaction ID is used as an internal identifier.

## Format Detection

Book format is inferred from `abpar2`:

- `"ebook"`, `"e-book"`, `"epub"`, `"mobi"`, `"pdf"` → `ebook`
- `"audio"`, `"mp3"`, `"audiobook"` → `audiobook`
- Otherwise → `paper` (default)

## Error Handling

The provider implements:

1. **Timeout handling** - Requests timeout after configured ms
2. **Retry logic** - Exponential backoff (1s, 2s, 4s) up to max retries
3. **Graceful degradation** - Returns cached data if API is unavailable

## Testing Locally

### 1. Use Mock Provider (Recommended for Development)

Set in `.env`:
```bash
USE_MOCK_PURCHASES="true"
```

This generates realistic test data without requiring BUYBOX credentials.

### 2. Test with Real API

Set in `.env`:
```bash
USE_MOCK_PURCHASES="false"
BUYBOX_API_TOKEN="your-real-token"
BUYBOX_SPACE_ID="your-space-id"
```

### 3. Test Endpoints

```bash
# Get purchase history
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/purchases

# Force refresh from BUYBOX
curl -X POST -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/purchases/refresh

# Get purchase statistics
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/purchases/stats
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PurchasesController                      │
│  GET /purchases  │  POST /purchases/refresh  │  GET /stats  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     PurchasesService                        │
│  • Sync logic    • Caching    • Book matching               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   IPurchaseProvider                         │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ MockPurchaseProvider│  │BuyboxPurchaseProvider│          │
│  │   (development)     │  │   (production)       │          │
│  └─────────────────────┘  └─────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              BUYBOX Transactions API                        │
│  https://api.buybox.click/api/v1/spaces/{id}/transactions   │
└─────────────────────────────────────────────────────────────┘
```

## Limitations & Notes

1. **User Identification**: The current implementation fetches all transactions for the publisher space. User-specific filtering would require storing user identifiers in `abpar` fields during the click/purchase flow.

2. **Book Matching**: Matching depends on ISBN/EAN being passed in tracking parameters. If not available, purchases are stored without book association.

3. **Rate Limits**: Check BUYBOX documentation for any API rate limits.

4. **Commission Tracking**: The `publisherCommissionAmount` is stored for analytics but not currently displayed in the UI.
