import { SQSEvent, SQSRecord } from "aws-lambda";

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

const mockDynamoSend = jest.fn().mockResolvedValue({});

jest.mock("@aws-sdk/lib-dynamodb", () => ({
    DynamoDBDocumentClient: { from: jest.fn().mockReturnValue({ send: mockDynamoSend }) },
    TransactWriteCommand: jest.fn().mockImplementation((params: unknown) => ({ type: "transact", params })),
}));

const mockSnsSend = jest.fn().mockResolvedValue({});

jest.mock("@aws-sdk/client-sns", () => ({
    SNSClient: jest.fn().mockImplementation(() => ({ send: mockSnsSend })),
    PublishCommand: jest.fn().mockImplementation((params: unknown) => ({ type: "publish", params })),
}));

process.env.PRODUCTS_TABLE = "products";
process.env.STOCKS_TABLE = "stocks";
process.env.SNS_TOPIC_ARN = "arn:aws:sns:eu-central-1:123456789:createProductTopic";

import { handler } from "../lambda/catalogBatchProcess";

const buildRecord = (body: unknown, messageId = "msg-1"): SQSRecord =>
({
    messageId,
    body: JSON.stringify(body),
} as unknown as SQSRecord);

const buildEvent = (records: SQSRecord[]): SQSEvent => ({ Records: records });

describe("catalogBatchProcess", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDynamoSend.mockResolvedValue({});
        mockSnsSend.mockResolvedValue({});
    });

    describe("valid products", () => {
        test("creates a product in DynamoDB for a valid message", async () => {
            const event = buildEvent([buildRecord({ title: "Test Product", price: 10, count: 5 })]);
            await handler(event);
            expect(mockDynamoSend).toHaveBeenCalledTimes(1);
        });

        test("creates multiple products for multiple messages", async () => {
            const event = buildEvent([
                buildRecord({ title: "Product A", price: 10, count: 1 }, "msg-1"),
                buildRecord({ title: "Product B", price: 20, count: 2 }, "msg-2"),
                buildRecord({ title: "Product C", price: 30, count: 3 }, "msg-3"),
            ]);
            await handler(event);
            expect(mockDynamoSend).toHaveBeenCalledTimes(3);
        });

        test("sends SNS notification for each created product", async () => {
            const event = buildEvent([
                buildRecord({ title: "Product A", price: 10, count: 1 }, "msg-1"),
                buildRecord({ title: "Product B", price: 60, count: 2 }, "msg-2"),
            ]);
            await handler(event);
            expect(mockSnsSend).toHaveBeenCalledTimes(2);
        });

        test("sets priceRange=affordable for products with price < 50", async () => {
            const { PublishCommand } = jest.requireMock("@aws-sdk/client-sns");
            const event = buildEvent([buildRecord({ title: "Cheap Product", price: 9.99, count: 10 })]);
            await handler(event);
            const call = PublishCommand.mock.calls[0][0];
            expect(call.MessageAttributes.priceRange.StringValue).toBe("affordable");
        });

        test("sets priceRange=expensive for products with price >= 50", async () => {
            const { PublishCommand } = jest.requireMock("@aws-sdk/client-sns");
            const event = buildEvent([buildRecord({ title: "Expensive Product", price: 99.99, count: 1 })]);
            await handler(event);
            const call = PublishCommand.mock.calls[0][0];
            expect(call.MessageAttributes.priceRange.StringValue).toBe("expensive");
        });

        test("sets priceRange=expensive for product with price exactly 50", async () => {
            const { PublishCommand } = jest.requireMock("@aws-sdk/client-sns");
            const event = buildEvent([buildRecord({ title: "Boundary Product", price: 50, count: 1 })]);
            await handler(event);
            const call = PublishCommand.mock.calls[0][0];
            expect(call.MessageAttributes.priceRange.StringValue).toBe("expensive");
        });

        test("trims whitespace from title and description", async () => {
            const { TransactWriteCommand } = jest.requireMock("@aws-sdk/lib-dynamodb");
            const event = buildEvent([buildRecord({ title: "  Trimmed  ", description: "  Desc  ", price: 10, count: 1 })]);
            await handler(event);
            const call = TransactWriteCommand.mock.calls[0][0];
            const item = call.TransactItems[0].Put.Item;
            expect(item.title).toBe("Trimmed");
            expect(item.description).toBe("Desc");
        });

        test("sets empty description when not provided", async () => {
            const { TransactWriteCommand } = jest.requireMock("@aws-sdk/lib-dynamodb");
            const event = buildEvent([buildRecord({ title: "No Desc", price: 10, count: 1 })]);
            await handler(event);
            const call = TransactWriteCommand.mock.calls[0][0];
            const item = call.TransactItems[0].Put.Item;
            expect(item.description).toBe("");
        });

        test("coerces string price and count from CSV format", async () => {
            const event = buildEvent([buildRecord({ title: "CSV Product", price: "29.99", count: "10" })]);
            await handler(event);
            expect(mockDynamoSend).toHaveBeenCalledTimes(1);
            expect(mockSnsSend).toHaveBeenCalledTimes(1);
        });
    });

    describe("invalid messages", () => {
        test("skips message with invalid JSON body", async () => {
            const record = { messageId: "bad-json", body: "not-valid-json" } as unknown as SQSRecord;
            await handler(buildEvent([record]));
            expect(mockDynamoSend).not.toHaveBeenCalled();
            expect(mockSnsSend).not.toHaveBeenCalled();
        });

        test("skips message with missing title", async () => {
            const event = buildEvent([buildRecord({ price: 10, count: 5 })]);
            await handler(event);
            expect(mockDynamoSend).not.toHaveBeenCalled();
        });

        test("skips message with missing price", async () => {
            const event = buildEvent([buildRecord({ title: "No Price", count: 5 })]);
            await handler(event);
            expect(mockDynamoSend).not.toHaveBeenCalled();
        });

        test("skips message with missing count", async () => {
            const event = buildEvent([buildRecord({ title: "No Count", price: 10 })]);
            await handler(event);
            expect(mockDynamoSend).not.toHaveBeenCalled();
        });

        test("skips message with negative price", async () => {
            const event = buildEvent([buildRecord({ title: "Bad Price", price: -5, count: 1 })]);
            await handler(event);
            expect(mockDynamoSend).not.toHaveBeenCalled();
        });

        test("skips message with float count", async () => {
            const event = buildEvent([buildRecord({ title: "Float Count", price: 10, count: 1.5 })]);
            await handler(event);
            expect(mockDynamoSend).not.toHaveBeenCalled();
        });

        test("skips message with empty title", async () => {
            const event = buildEvent([buildRecord({ title: "   ", price: 10, count: 1 })]);
            await handler(event);
            expect(mockDynamoSend).not.toHaveBeenCalled();
        });

        test("processes valid messages and skips invalid ones in the same batch", async () => {
            const event = buildEvent([
                buildRecord({ title: "Valid", price: 10, count: 1 }, "msg-1"),
                buildRecord({ price: 10, count: 1 }, "msg-2"),   // missing title
                buildRecord({ title: "Also Valid", price: 20, count: 2 }, "msg-3"),
            ]);
            await handler(event);
            expect(mockDynamoSend).toHaveBeenCalledTimes(2);
            expect(mockSnsSend).toHaveBeenCalledTimes(2);
        });
    });

    describe("error handling", () => {
        test("throws when DynamoDB write fails", async () => {
            mockDynamoSend.mockRejectedValueOnce(new Error("DynamoDB error"));
            const event = buildEvent([buildRecord({ title: "Product", price: 10, count: 1 })]);
            await expect(handler(event)).rejects.toThrow("DynamoDB error");
        });

        test("does not send SNS if DynamoDB write fails", async () => {
            mockDynamoSend.mockRejectedValueOnce(new Error("DynamoDB error"));
            const event = buildEvent([buildRecord({ title: "Product", price: 10, count: 1 })]);
            await expect(handler(event)).rejects.toThrow();
            expect(mockSnsSend).not.toHaveBeenCalled();
        });
    });
});
