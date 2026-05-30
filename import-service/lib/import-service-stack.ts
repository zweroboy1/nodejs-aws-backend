import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as path from 'node:path';

const IMPORT_BUCKET_NAME = process.env.IMPORT_BUCKET_NAME ?? 'import-service-zweroboy1';

export class ImportServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const importBucket = s3.Bucket.fromBucketName(this, 'ImportBucket', IMPORT_BUCKET_NAME);

        const catalogItemsQueue = sqs.Queue.fromQueueArn(
            this,
            'CatalogItemsQueue',
            cdk.Fn.importValue('CatalogItemsQueueArn'),
        );

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
                CATALOG_ITEMS_QUEUE_URL: cdk.Fn.importValue('CatalogItemsQueueUrl'),
            },
        });

        importBucket.grantRead(importFileParser);
        importBucket.grantPut(importFileParser);
        importBucket.grantDelete(importFileParser);
        catalogItemsQueue.grantSendMessages(importFileParser);
        importBucket.addEventNotification(
            s3.EventType.OBJECT_CREATED,
            new s3n.LambdaDestination(importFileParser),
            { prefix: 'uploaded/' }
        );

        const basicAuthorizerArn = cdk.Fn.importValue('BasicAuthorizerArn');
        const basicAuthorizerFn = lambda.Function.fromFunctionArn(
            this,
            'BasicAuthorizerFn',
            basicAuthorizerArn,
        );

        const authorizer = new apigateway.TokenAuthorizer(this, 'BasicAuthorizer', {
            handler: basicAuthorizerFn,
            identitySource: apigateway.IdentitySource.header('Authorization'),
        });

        new lambda.CfnPermission(this, 'BasicAuthorizerPermission', {
            action: 'lambda:InvokeFunction',
            functionName: basicAuthorizerFn.functionArn,
            principal: 'apigateway.amazonaws.com',
            sourceAccount: this.account,
        });

        const api = new apigateway.RestApi(this, 'ImportServiceApi', {
            restApiName: 'Import Service',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
            },
        });

        api.addGatewayResponse('Unauthorized', {
            type: apigateway.ResponseType.UNAUTHORIZED,
            responseHeaders: {
                'Access-Control-Allow-Origin': "'*'",
            },
        });

        api.addGatewayResponse('AccessDenied', {
            type: apigateway.ResponseType.ACCESS_DENIED,
            responseHeaders: {
                'Access-Control-Allow-Origin': "'*'",
            },
        });

        const importResource = api.root.addResource('import');
        importResource.addMethod('GET', new apigateway.LambdaIntegration(importProductsFile), {
            authorizer,
            authorizationType: apigateway.AuthorizationType.CUSTOM,
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
