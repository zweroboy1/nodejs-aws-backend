import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({});

const BUCKET_NAME = process.env.IMPORT_BUCKET_NAME!;
const SIGNED_URL_EXPIRES_IN = 300; // 5 minutes

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log("importProductsFile invoked, queryStringParameters:", event.queryStringParameters);

    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    };

    try {
        const fileName = event.queryStringParameters?.name;

        if (!fileName) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: "Query parameter 'name' is required" }),
            };
        }

        if (!fileName.endsWith(".csv")) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: "Only CSV files are allowed" }),
            };
        }

        const key = `uploaded/${fileName}`;

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: "text/csv",
        });

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: SIGNED_URL_EXPIRES_IN });

        return {
            statusCode: 200,
            headers: {
                ...headers,
                "Content-Type": "text/plain",
            },
            body: signedUrl,
        };
    } catch (error) {
        console.error("importProductsFile error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: "Internal server error" }),
        };
    }
};
