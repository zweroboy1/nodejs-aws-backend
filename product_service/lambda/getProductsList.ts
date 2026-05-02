import { APIGatewayProxyResult } from "aws-lambda";
import { products } from "../mock/products.js";

export const handler = async (): Promise<APIGatewayProxyResult> => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(products),
  };
};
