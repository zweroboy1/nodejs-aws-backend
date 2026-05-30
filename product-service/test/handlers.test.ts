import { APIGatewayProxyEvent } from "aws-lambda";
import { products } from "../mock/products";

beforeAll(() => {
    jest.spyOn(console, "log").mockImplementation(() => { });
    jest.spyOn(console, "error").mockImplementation(() => { });
});

afterAll(() => {
    jest.restoreAllMocks();
});

jest.mock("@aws-sdk/client-dynamodb", () => ({
    DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

const mockSend = jest.fn().mockImplementation((command: { type: string; params: Record<string, unknown> }) => {
    if (command.type === "scan") {
        if (command.params.TableName === "products") {
            return Promise.resolve({ Items: products.map(({ count: _count, ...p }) => p) });
        }
        if (command.params.TableName === "stocks") {
            return Promise.resolve({ Items: products.map((p) => ({ product_id: p.id, count: p.count })) });
        }
    }
    if (command.type === "get") {
        const key = (command.params.Key as Record<string, string>);
        const product = products.find((p) => p.id === key.id);
        return Promise.resolve({ Item: product ? { id: product.id, title: product.title, description: product.description, price: product.price } : undefined });
    }
    if (command.type === "query") {
        const attrs = command.params.ExpressionAttributeValues as Record<string, string>;
        const product = products.find((p) => p.id === attrs[":pid"]);
        return Promise.resolve({ Items: product ? [{ product_id: product.id, count: product.count }] : [] });
    }
    return Promise.resolve({});
});

jest.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: { from: jest.fn().mockReturnValue({ send: mockSend }) },
    ScanCommand: jest.fn().mockImplementation((params: unknown) => ({ type: "scan", params })),
    GetCommand: jest.fn().mockImplementation((params: unknown) => ({ type: "get", params })),
    QueryCommand: jest.fn().mockImplementation((params: unknown) => ({ type: "query", params })),
    TransactWriteCommand: jest.fn().mockImplementation((params: unknown) => ({ type: "transact", params })),
}));

process.env.PRODUCTS_TABLE = "products";
process.env.STOCKS_TABLE = "stocks";

import { handler as getProductsList } from "../lambda/getProductsList";
import { handler as getProductsById } from "../lambda/getProductsById";

const buildEvent = (pathParameters: Record<string, string> | null = null): APIGatewayProxyEvent =>
    ({ pathParameters } as unknown as APIGatewayProxyEvent);

describe("getProductsList", () => {
    test("returns 200 status code", async () => {
        const result = await getProductsList();
        expect(result.statusCode).toBe(200);
    });

    test("returns all products", async () => {
        const result = await getProductsList();
        const body = JSON.parse(result.body);
        expect(body).toHaveLength(products.length);
    });

    test("returns correct CORS header", async () => {
        const result = await getProductsList();
        expect(result.headers?.["Access-Control-Allow-Origin"]).toBe("*");
    });

    test("products have required fields", async () => {
        const result = await getProductsList();
        const body = JSON.parse(result.body);
        body.forEach((product: unknown) => {
            const p = product as Record<string, unknown>;
            expect(p).toHaveProperty("id");
            expect(p).toHaveProperty("title");
            expect(p).toHaveProperty("description");
            expect(p).toHaveProperty("price");
            expect(p).toHaveProperty("count");
        });
    });
});

describe("getProductsById", () => {
    test("returns 200 and product when valid ID provided", async () => {
        const validId = products[0].id;
        const result = await getProductsById(buildEvent({ productId: validId }));
        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.id).toBe(validId);
        expect(body.title).toBe(products[0].title);
    });

    test("returns 404 when product not found", async () => {
        const result = await getProductsById(buildEvent({ productId: "non-existent-id" }));
        expect(result.statusCode).toBe(404);
        const body = JSON.parse(result.body);
        expect(body.message).toBe("Product not found");
    });

    test("returns 400 when productId is missing", async () => {
        const result = await getProductsById(buildEvent(null));
        expect(result.statusCode).toBe(400);
    });

    test("returns correct CORS header", async () => {
        const validId = products[0].id;
        const result = await getProductsById(buildEvent({ productId: validId }));
        expect(result.headers?.["Access-Control-Allow-Origin"]).toBe("*");
    });
});
