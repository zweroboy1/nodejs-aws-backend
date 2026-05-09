import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const productId = event.pathParameters?.productId;

  if (!productId) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "Product ID is required" }),
    };
  }

  const productsTable = process.env.PRODUCTS_TABLE!;
  const stocksTable = process.env.STOCKS_TABLE!;

  const [productResult, stockResult] = await Promise.all([
    docClient.send(new GetCommand({ TableName: productsTable, Key: { id: productId } })),
    docClient.send(new QueryCommand({
      TableName: stocksTable,
      KeyConditionExpression: "product_id = :pid",
      ExpressionAttributeValues: { ":pid": productId },
    })),
  ]);

  if (!productResult.Item) {
    return {
      statusCode: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "Product not found" }),
    };
  }

  const stock = stockResult.Items?.[0];
  const product = { ...productResult.Item, count: stock?.count ?? 0 };

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(product),
  };
};
