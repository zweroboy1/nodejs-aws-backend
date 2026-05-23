import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as path from 'node:path';

const IMPORT_BUCKET_NAME = process.env.IMPORT_BUCKET_NAME ?? 'import-service-zweroboy1';

export class ImportServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const importBucket = s3.Bucket.fromBucketName(this, 'ImportBucket', IMPORT_BUCKET_NAME);

        const importProductsFile = new NodejsFunction(this, 'ImportProductsFile', {
            runtime: lambda.Runtime.NODEJS_22_X,
            entry: path.join(__dirname, '../lambda/importProductsFile.ts'),
            handler: 'handler',
            environment: {
                IMPORT_BUCKET_NAME: importBucket.bucketName,
            },
        });

        importBucket.grantPut(importProductsFile);

        const importFileParser = new NodejsFunction(this, 'ImportFileParser', {
            runtime: lambda.Runtime.NODEJS_22_X,
            entry: path.join(__dirname, '../lambda/importFileParser.ts'),
            handler: 'handler',
            environment: {
                IMPORT_BUCKET_NAME: importBucket.bucketName,
            },
        });

        importBucket.grantRead(importFileParser);
        importBucket.grantPut(importFileParser);
        importBucket.grantDelete(importFileParser);
        importBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(importFileParser),
            { prefix: 'uploaded/' }
        );

        const api = new apigateway.RestApi(this, 'ImportServiceApi', {
            restApiName: 'Import Service',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
            },
        });

        const importResource = api.root.addResource('import');
        importResource.addMethod('GET', new apigateway.LambdaIntegration(importProductsFile), {
            requestParameters: {
                'method.request.querystring.name': true,
            },
        });

        new cdk.CfnOutput(this, 'ApiUrl', {
            value: api.url,
            description: 'Import Service API URL',
        });
    }
}
