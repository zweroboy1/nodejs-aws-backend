import { APIGatewayProxyEvent } from "aws-lambda";

jest.mock("@aws-sdk/client-s3", () => ({
    S3Client: jest.fn().mockImplementation(() => ({})),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
    getSignedUrl: jest.fn().mockResolvedValue("https://s3.example.com/signed-url"),
}));

process.env.IMPORT_BUCKET_NAME = "test-bucket";

import { handler } from "../lambda/importProductsFile";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

const makeEvent = (params?: Record<string, string>): APIGatewayProxyEvent =>
({
    queryStringParameters: params ?? null,
} as unknown as APIGatewayProxyEvent);

describe("importProductsFile", () => {
    beforeAll(() => {
        jest.spyOn(console, "log").mockImplementation(() => { });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSignedUrl.mockResolvedValue("https://s3.example.com/signed-url");
    });

    it("returns 400 when 'name' parameter is missing", async () => {
        const result = await handler(makeEvent());
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toMatch(/name/i);
    });

    it("returns 400 when file is not a CSV", async () => {
        const result = await handler(makeEvent({ name: "file.txt" }));
        expect(result.statusCode).toBe(400);
        expect(JSON.parse(result.body).message).toMatch(/csv/i);
    });

    it("returns 200 with signed URL for valid CSV filename", async () => {
        const result = await handler(makeEvent({ name: "products.csv" }));
        expect(result.statusCode).toBe(200);
        expect(result.body).toBe("https://s3.example.com/signed-url");
    });

    it("calls getSignedUrl with correct bucket and key", async () => {
        await handler(makeEvent({ name: "products.csv" }));
        expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
        const [, command] = mockGetSignedUrl.mock.calls[0];
        expect((command as any).input).toMatchObject({
            Bucket: "test-bucket",
            Key: "uploaded/products.csv",
            ContentType: "text/csv",
        });
    });

    it("returns 500 when getSignedUrl throws", async () => {
        jest.spyOn(console, "error").mockImplementationOnce(() => { });
        mockGetSignedUrl.mockRejectedValueOnce(new Error("AWS error"));
        const result = await handler(makeEvent({ name: "products.csv" }));
        expect(result.statusCode).toBe(500);
    });
});
