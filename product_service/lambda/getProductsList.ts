import { APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (): Promise<APIGatewayProxyResult> => {
  const productsTable = process.env.PRODUCTS_TABLE!;
  const stocksTable = process.env.STOCKS_TABLE!;

  const [productsResult, stocksResult] = await Promise.all([
    docClient.send(new ScanCommand({ TableName: productsTable })),
    docClient.send(new ScanCommand({ TableName: stocksTable })),
  ]);

  const stocks = stocksResult.Items ?? [];
  const products = (productsResult.Items ?? []).map((product) => {
    const stock = stocks.find((s) => s.product_id === product.id);
    return { ...product, count: stock?.count ?? 0 };
  });

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(products),
  };
};
