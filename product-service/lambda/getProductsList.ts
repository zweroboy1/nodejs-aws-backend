import { APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (): Promise<APIGatewayProxyResult> => {
  console.log("getProductsList invoked");

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
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
      headers,
      body: JSON.stringify(products),
    };
  } catch (error) {
    console.error("getProductsList error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
