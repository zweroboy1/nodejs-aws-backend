import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "node:crypto";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    };

    let body: unknown;
    try {
        body = JSON.parse(event.body ?? "");
    } catch {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ message: "Invalid JSON body" }),
        };
    }

    const ALLOWED_KEYS = new Set(["title", "description", "price", "count"]);
    const REQUIRED_KEYS = ["title", "price", "count"];

    const data = body as Record<string, unknown>;

    const unknownKeys = Object.keys(data).filter((k) => !ALLOWED_KEYS.has(k));
    if (unknownKeys.length > 0) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ message: `Unknown fields: ${unknownKeys.join(", ")}` }),
        };
    }

    const missingKeys = REQUIRED_KEYS.filter((k) => !(k in data));
    if (missingKeys.length > 0) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ message: `Missing required fields: ${missingKeys.join(", ")}` }),
        };
    }

    const { title, description, price, count } = data;

    if (typeof title !== "string" || title.trim() === "") {
        return { statusCode: 400, headers, body: JSON.stringify({ message: "title must be a non-empty string" }) };
    }
    if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ message: "price must be a non-negative number" }) };
    }
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ message: "count must be a non-negative integer" }) };
    }
    if (description !== undefined && (typeof description !== "string" || description.trim() === "")) {
        return { statusCode: 400, headers, body: JSON.stringify({ message: "description must be a non-empty string if provided" }) };
    }

    const productsTable = process.env.PRODUCTS_TABLE!;
    const stocksTable = process.env.STOCKS_TABLE!;
    const id = randomUUID();

    await docClient.send(
        new TransactWriteCommand({
            TransactItems: [
                {
                    Put: {
                        TableName: productsTable,
                        Item: {
                            id,
                            title: title.trim(),
                            description: description === undefined ? "" : description.trim(),
                            price,
                        },
                    },
                },
                {
                    Put: {
                        TableName: stocksTable,
                        Item: {
                            product_id: id,
                            count,
                        },
                    },
                },
            ],
        }),
    );

    return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ id, title: title.trim(), description: description === undefined ? "" : description.trim(), price, count }),
    };
};
