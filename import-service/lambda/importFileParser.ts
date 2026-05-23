import { S3Event } from "aws-lambda";
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Readable } from "node:stream";
import csvParser from "csv-parser";

const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

export const handler = async (event: S3Event): Promise<void> => {
    console.log("importFileParser invoked, records:", JSON.stringify(event.Records));

    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replaceAll('+', " "));

        console.log(`Processing file: s3://${bucket}/${key}`);

        const response = await s3Client.send(
            new GetObjectCommand({ Bucket: bucket, Key: key })
        );

        const queueUrl = process.env.CATALOG_ITEMS_QUEUE_URL!;
        const sendPromises: Promise<void>[] = [];

        await new Promise<void>((resolve, reject) => {
            (response.Body as Readable)
                .pipe(csvParser())
                .on("data", (row: Record<string, string>) => {
                    const promise = sqsClient.send(new SendMessageCommand({
                        QueueUrl: queueUrl,
                        MessageBody: JSON.stringify(row),
                    })).then(() => {
                        console.log("Sent to SQS:", row.title);
                    }).catch((error: Error) => {
                        console.error("Failed to send message to SQS:", error);
                    });
                    sendPromises.push(promise);
                })
                .on("end", () => {
                    Promise.all(sendPromises)
                        .then(() => {
                            console.log(`Finished parsing and sending: ${key}`);
                            resolve();
                        })
                        .catch(reject);
                })
                .on("error", (error: Error) => {
                    console.error(`Error parsing ${key}:`, error);
                    reject(error);
                });
        });

        const parsedKey = key.replace("uploaded/", "parsed/");

        await s3Client.send(
            new CopyObjectCommand({
                Bucket: bucket,
                CopySource: `${bucket}/${key}`,
                Key: parsedKey,
            })
        );

        await s3Client.send(
            new DeleteObjectCommand({ Bucket: bucket, Key: key })
        );

        console.log(`Moved: ${key} -> ${parsedKey}`);
    }
};
