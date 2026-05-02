# nodejs-aws-backend

Backend for RSS AWS course. Built with AWS CDK, AWS Lambda, and API Gateway.

## Structure

```
nodejs-aws-backend/
└── product_service/   # Product Service (Task 3)
```

## Product Service

REST API with two endpoints:

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/products` | Returns list of all products |
| GET | `/products/{productId}` | Returns single product by ID |

**Base URL:** `https://4yp23fppjg.execute-api.eu-central-1.amazonaws.com/prod`

- All products: `https://4yp23fppjg.execute-api.eu-central-1.amazonaws.com/prod/products`
- Product by ID: `https://4yp23fppjg.execute-api.eu-central-1.amazonaws.com/prod/products/{productId}`

**Frontend repo:** https://github.com/zweroboy1/nodejs-aws-shop-react  
**Frontend deploy:** https://d3g4t1iwowafwv.cloudfront.net/

### Deploy

```bash
cd product_service
npm install
cdk bootstrap   # first time only
cdk deploy
```

### Run tests

```bash
cd product_service
npm test
```

### API Documentation

OpenAPI spec: `product_service/openapi.json` — can be rendered at [editor.swagger.io](https://editor.swagger.io)
