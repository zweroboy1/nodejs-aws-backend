import { S3Event } from "aws-lambda";
import { Readable, Transform } from "node:stream";

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => ({
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    CopyObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

let parserRows: Record<string, string>[] = [];
let parserShouldError = false;

jest.mock("csv-parser", () =>
    jest.fn(() => {
        const transform = new Transform({
            objectMode: true,
            transform(_chunk: Buffer, _enc: string, cb: () => void) { cb(); },
        });
        process.nextTick(() => {
            if (parserShouldError) {
                transform.emit("error", new Error("parse error"));
            } else {
                for (const row of parserRows) {
                    transform.emit("data", row);
                }
                transform.emit("end");
            }
        });
        return transform;
    })
);

import { handler } from "../lambda/importFileParser";

const makeEvent = (bucket: string, key: string): S3Event =>
({
    Records: [
        {
            s3: {
                bucket: { name: bucket },
                object: { key },
            },
        },
    ],
} as unknown as S3Event);

const makeStream = (): Readable => Readable.from([]);

describe("importFileParser", () => {
    beforeAll(() => {
        jest.spyOn(console, "log").mockImplementation(() => { });
        jest.spyOn(console, "error").mockImplementation(() => { });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        parserRows = [];
        parserShouldError = false;
        mockSend.mockResolvedValue({ Body: makeStream() });
    });

    it("calls GetObjectCommand with correct bucket and key", async () => {
        await handler(makeEvent("my-bucket", "uploaded/test.csv"));

        const { GetObjectCommand } = jest.requireMock("@aws-sdk/client-s3");
        expect(GetObjectCommand).toHaveBeenCalledWith({
            Bucket: "my-bucket",
            Key: "uploaded/test.csv",
        });
    });

    it("decodes URL-encoded key", async () => {
        await handler(makeEvent("my-bucket", "uploaded/my+file.csv"));

        const { GetObjectCommand } = jest.requireMock("@aws-sdk/client-s3");
        expect(GetObjectCommand).toHaveBeenCalledWith({
            Bucket: "my-bucket",
            Key: "uploaded/my file.csv",
        });
    });

    it("logs each parsed CSV row", async () => {
        parserRows = [
            { title: "Product A", price: "10" },
            { title: "Product B", price: "20" },
        ];

        await handler(makeEvent("my-bucket", "uploaded/test.csv"));

        const logMock = console.log as jest.Mock;
        const loggedRows = logMock.mock.calls
            .filter(([msg]) => msg === "Parsed record:")
            .map(([, row]) => row);

        expect(loggedRows).toEqual([
            JSON.stringify(parserRows[0]),
            JSON.stringify(parserRows[1]),
        ]);
    });

    it("processes multiple S3 records", async () => {
        const event: S3Event = {
            Records: [
                { s3: { bucket: { name: "b" }, object: { key: "uploaded/a.csv" } } },
                { s3: { bucket: { name: "b" }, object: { key: "uploaded/b.csv" } } },
            ],
        } as unknown as S3Event;

        await handler(event);
        // GetObjectCommand + CopyObjectCommand + DeleteObjectCommand per record = 3 * 2
        expect(mockSend).toHaveBeenCalledTimes(6);
    });

    it("copies file to parsed/ folder after parsing", async () => {
        await handler(makeEvent("my-bucket", "uploaded/test.csv"));

        const { CopyObjectCommand } = jest.requireMock("@aws-sdk/client-s3");
        expect(CopyObjectCommand).toHaveBeenCalledWith({
            Bucket: "my-bucket",
            CopySource: "my-bucket/uploaded/test.csv",
            Key: "parsed/test.csv",
        });
    });

    it("deletes file from uploaded/ folder after copying", async () => {
        await handler(makeEvent("my-bucket", "uploaded/test.csv"));

        const { DeleteObjectCommand } = jest.requireMock("@aws-sdk/client-s3");
        expect(DeleteObjectCommand).toHaveBeenCalledWith({
            Bucket: "my-bucket",
            Key: "uploaded/test.csv",
        });
    });

    it("rejects when csv-parser emits error", async () => {
        parserShouldError = true;
        await expect(handler(makeEvent("my-bucket", "uploaded/bad.csv"))).rejects.toThrow("parse error");
    });
});
