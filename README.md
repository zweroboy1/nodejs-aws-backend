# nodejs-aws-backend

Backend for RSS AWS course. Built with AWS CDK, AWS Lambda, DynamoDB and API Gateway.

## Structure

```
nodejs-aws-backend/
├── product-service/   # Product Service (Task 4)
└── import-service/    # Import Service (Task 5)
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

### Deploy

```bash
cd product_service
npm install
cdk bootstrap   # first time only
npm run deploy
```

### Seed DynamoDB

```bash
cd product_service
npm run seed
```

### Run tests

```bash
cd product_service
npm test
```

### API Documentation

OpenAPI spec: `product-service/openapi.json` — can be rendered at [editor.swagger.io](https://editor.swagger.io)

---

## Import Service

Handles CSV product imports via S3 pre-signed URLs.

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/import?name=products.csv` | Returns a pre-signed S3 URL for uploading a CSV file |

**Base URL:** `https://39r1iqoj3f.execute-api.eu-central-1.amazonaws.com/prod`

- Get signed URL: `https://39r1iqoj3f.execute-api.eu-central-1.amazonaws.com/prod/import?name=products.csv`

### How it works

1. Call `GET /import?name=<filename>.csv` — receive a pre-signed S3 URL
2. Upload the CSV file via `PUT` to that URL (header `Content-Type: text/csv`)
3. S3 automatically triggers the `importFileParser` lambda
4. Lambda parses the CSV and logs each row to CloudWatch
5. File is moved from `uploaded/` to `parsed/`

### Query parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `name` | yes | Name of the CSV file (must end with `.csv`) |

Returns `400` on missing/non-CSV name, `200` with plain-text signed URL on success, `500` on server error.

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
