import { S3Event } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import csvParser from "csv-parser";

const s3Client = new S3Client({});

export const handler = async (event: S3Event): Promise<void> => {
  console.log("importFileParser invoked, records:", JSON.stringify(event.Records));

  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replaceAll('+', " "));

    console.log(`Processing file: s3://${bucket}/${key}`);

    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );

    await new Promise<void>((resolve, reject) => {
      (response.Body as Readable)
        .pipe(csvParser())
        .on("data", (row: Record<string, string>) => {
          console.log("Parsed record:", JSON.stringify(row));
        })
        .on("end", () => {
          console.log(`Finished parsing: ${key}`);
          resolve();
        })
        .on("error", (error: Error) => {
          console.error(`Error parsing ${key}:`, error);
          reject(error);
        });
    });
  }
};
