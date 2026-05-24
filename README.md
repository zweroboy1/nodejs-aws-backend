# nodejs-aws-backend

Backend for RSS AWS course. Built with AWS CDK, AWS Lambda, DynamoDB, API Gateway, SQS and SNS.

## Structure

```
nodejs-aws-backend/
├── product-service/   # Product Service (Tasks 4, 6)
└── import-service/    # Import Service (Tasks 5, 6)
```

## Product Service

REST API with three endpoints:

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/products` | Returns list of all products (joined with stocks) |
| GET | `/products/{productId}` | Returns single product by ID |
| POST | `/products` | Creates a new product |

**Base URL:** `https://4yp23fppjg.execute-api.eu-central-1.amazonaws.com/prod`

- All products: `https://4yp23fppjg.execute-api.eu-central-1.amazonaws.com/prod/products`
- Product by ID: `https://4yp23fppjg.execute-api.eu-central-1.amazonaws.com/prod/products/{productId}`

**Frontend repo:** https://github.com/zweroboy1/nodejs-aws-shop-react  
**Frontend deploy:** https://d3g4t1iwowafwv.cloudfront.net/

### Product model

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "price": 999,
  "count": 3
}
```

### POST /products — request body

```json
{
  "title": "string (required)",
  "description": "string (optional)",
  "price": 999,
  "count": 3
}
```

Returns `400` on invalid data, `201` on success, `500` on server error.

### SQS — catalogItemsQueue

An SQS queue that receives product data and triggers the `catalogBatchProcess` lambda.

- **Queue name:** `catalogItemsQueue`
- **Encryption:** SSE with AWS-managed key
- **Batch size:** 5 messages per Lambda invocation
- **Max batching window:** 5 seconds

Each message body must be a JSON object with the same fields as `POST /products`.

To send a test batch via CLI:

```bash
aws sqs send-message-batch \
  --queue-url "https://sqs.eu-central-1.amazonaws.com/638515253070/catalogItemsQueue" \
  --region eu-central-1 \
  --entries '[
    {"Id":"1","MessageBody":"{\"title\":\"Product 1\",\"price\":10,\"count\":3}"},
    {"Id":"2","MessageBody":"{\"title\":\"Product 2\",\"price\":60,\"count\":1}"}
  ]'
```

### Lambda — catalogBatchProcess

Triggered by `catalogItemsQueue`. For each SQS message:

1. Parses and validates the product data (coerces string `price`/`count` from CSV format)
2. Writes product and stock records atomically to DynamoDB via `TransactWriteCommand`
3. Publishes an SNS notification with a `priceRange` message attribute:
   - `expensive` — price ≥ 50
   - `affordable` — price < 50

### SNS — createProductTopic

| Subscription | Filter (`priceRange`) |
|---|---|
| `kuhni.info@gmail.com` | `expensive` (price ≥ 50) |
| `oleksii_roman@epam.com` | `affordable` (price < 50) |

### Deploy

```bash
cd product-service
npm install
cdk bootstrap   # first time only
npm run deploy
```

### Seed DynamoDB

```bash
cd product-service
npm run seed
```

### Run tests

```bash
cd product-service
npm test
```

### API Documentation

OpenAPI spec: `product-service/openapi.json` — can be rendered at [editor.swagger.io](https://editor.swagger.io)

---

## Import Service

Handles CSV product imports via S3 pre-signed URLs. Parsed CSV rows are sent to `catalogItemsQueue` for processing by the Product Service.

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/import?name=products.csv` | Returns a pre-signed S3 URL for uploading a CSV file |

**Base URL:** `https://39r1iqoj3f.execute-api.eu-central-1.amazonaws.com/prod`

- Get signed URL: `https://39r1iqoj3f.execute-api.eu-central-1.amazonaws.com/prod/import?name=products.csv`

### CSV format

```csv
title,description,price,count
Gaming Mouse,High precision optical gaming mouse,34.99,20
USB-C Hub,7-in-1 USB-C hub with HDMI 4K,49.99,12
```

### How it works

1. Call `GET /import?name=<filename>.csv` — receive a pre-signed S3 URL
2. Upload the CSV file via `PUT` to that URL (header `Content-Type: text/csv`)
3. S3 triggers the `importFileParser` lambda
4. Lambda parses the CSV and sends each row as a JSON message to `catalogItemsQueue` (SQS)
5. File is moved from `uploaded/` to `parsed/`
6. `catalogBatchProcess` lambda (Product Service) picks up the messages and creates products in DynamoDB

### Query parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | yes | Name of the CSV file (must end with `.csv`) |

Returns `400` on missing/non-CSV name, `200` with plain-text signed URL on success, `500` on server error.

### Upload test CSV via CLI

```bash
aws s3 cp import-service/test-products.csv \
  s3://import-service-zweroboy1/uploaded/test-products.csv \
  --region eu-central-1
```

Or via the frontend admin panel: https://d2xbbmgdpkl47j.cloudfront.net/admin/products

### Deploy

```bash
cd import-service
npm install
cdk bootstrap   # first time only
npm run deploy
```

### Run tests

```bash
cd import-service
npm test
```

### API Documentation

OpenAPI spec: `import-service/openapi.json` — can be rendered at [editor.swagger.io](https://editor.swagger.io)

