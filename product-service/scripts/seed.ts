import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";

import { products } from "../mock/products";

const client = new DynamoDBClient({
  region: "eu-central-1",
});

const docClient = DynamoDBDocumentClient.from(client);

async function seed() {
  await docClient.send(
    new BatchWriteCommand({
      RequestItems: {
        products: products.map((product) => ({
          PutRequest: {
            Item: {
              id: product.id,
              title: product.title,
              description: product.description,
              price: product.price,
            },
          },
        })),

        stocks: products.map((product) => ({
          PutRequest: {
            Item: {
              product_id: product.id,
              count: product.count,
            },
          },
        })),
      },
    }),
  );

  console.log("Database seeded successfully");
}

seed().catch(console.error);