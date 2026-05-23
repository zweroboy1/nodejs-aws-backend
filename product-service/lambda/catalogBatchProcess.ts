import { SQSEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { randomUUID } from "node:crypto";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const snsClient = new SNSClient({});

interface ProductInput {
    title: string;
    description?: string;
    price: number;
    count: number;
}

function isValidProduct(data: unknown): data is ProductInput {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
        return false;
    }
    const d = data as Record<string, unknown>;
    if (typeof d.title !== "string" || d.title.trim() === "") return false;
    if (typeof d.price !== "number" || !Number.isFinite(d.price) || d.price < 0) return false;
    if (typeof d.count !== "number" || !Number.isInteger(d.count) || d.count < 0) return false;
    if (d.description !== undefined && (typeof d.description !== "string" || d.description.trim() === "")) return false;
    return true;
}

export const handler = async (event: SQSEvent): Promise<void> => {
    console.log("catalogBatchProcess invoked, records count:", event.Records.length);

    const productsTable = process.env.PRODUCTS_TABLE!;
    const stocksTable = process.env.STOCKS_TABLE!;

    const createdProducts: { id: string; title: string; description: string; price: number; count: number }[] = [];

    for (const record of event.Records) {
        console.log("Processing SQS message:", record.messageId);

        let body: unknown;
        try {
            const parsed = JSON.parse(record.body);
            if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
                const d = parsed as Record<string, unknown>;
                if (typeof d.price === "string") d.price = Number(d.price);
                if (typeof d.count === "string") d.count = Number(d.count);
            }
            body = parsed;
        } catch {
            console.error("Failed to parse SQS message body:", record.body);
            continue;
        }

        if (!isValidProduct(body)) {
            console.error("Invalid product data in SQS message:", record.messageId, body);
            continue;
        }

        const id = randomUUID();
        const title = body.title.trim();
        const description = body.description === undefined ? "" : body.description.trim();
        const { price, count } = body;

        try {
            await docClient.send(
                new TransactWriteCommand({
                    TransactItems: [
                        {
                            Put: {
                                TableName: productsTable,
                                Item: { id, title, description, price },
                            },
                        },
                        {
                            Put: {
                                TableName: stocksTable,
                                Item: { product_id: id, count },
                            },
                        },
                    ],
                }),
            );
            console.log("Product created successfully:", id, title);
            createdProducts.push({ id, title, description, price, count });
        } catch (error) {
            console.error("Failed to create product for message:", record.messageId, error);
            throw error;
        }
    }

    if (createdProducts.length > 0) {
        await snsClient.send(new PublishCommand({
            TopicArn: process.env.SNS_TOPIC_ARN!,
            Subject: `${createdProducts.length} product(s) created`,
            Message: JSON.stringify(createdProducts, null, 2),
        }));
        console.log("SNS notification sent for", createdProducts.length, "products");
    }
};
