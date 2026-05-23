import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as path from 'node:path';

export class ProductServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const productsTable = dynamodb.Table.fromTableName(this, 'ProductsTable', 'products');
        const stocksTable = dynamodb.Table.fromTableName(this, 'StocksTable', 'stocks');

        const getProductsList = new NodejsFunction(this, 'GetProductsList', {
            runtime: lambda.Runtime.NODEJS_22_X,
            entry: path.join(__dirname, '../lambda/getProductsList.ts'),
            handler: 'handler',
            environment: {
                PRODUCTS_TABLE: productsTable.tableName,
                STOCKS_TABLE: stocksTable.tableName,
            },
        });

        const getProductsById = new NodejsFunction(this, 'GetProductsById', {
            runtime: lambda.Runtime.NODEJS_22_X,
            entry: path.join(__dirname, '../lambda/getProductsById.ts'),
            handler: 'handler',
            environment: {
                PRODUCTS_TABLE: productsTable.tableName,
                STOCKS_TABLE: stocksTable.tableName,
            },
        });

        const createProduct = new NodejsFunction(this, 'CreateProduct', {
            runtime: lambda.Runtime.NODEJS_22_X,
            entry: path.join(__dirname, '../lambda/createProduct.ts'),
            handler: 'handler',
            environment: {
                PRODUCTS_TABLE: productsTable.tableName,
                STOCKS_TABLE: stocksTable.tableName,
            },
        });

        const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
            topicName: 'createProductTopic',
        });

        createProductTopic.addSubscription(
            new snsSubscriptions.EmailSubscription('kuhni.info@gmail.com'),
        );

        const catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
            queueName: 'catalogItemsQueue',
            visibilityTimeout: cdk.Duration.seconds(30),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
        });

        const catalogBatchProcess = new NodejsFunction(this, 'CatalogBatchProcess', {
            runtime: lambda.Runtime.NODEJS_22_X,
            entry: path.join(__dirname, '../lambda/catalogBatchProcess.ts'),
            handler: 'handler',
            environment: {
                PRODUCTS_TABLE: productsTable.tableName,
                STOCKS_TABLE: stocksTable.tableName,
                SNS_TOPIC_ARN: createProductTopic.topicArn,
            },
        });

        catalogBatchProcess.addEventSource(new SqsEventSource(catalogItemsQueue, {
            batchSize: 5,
            maxBatchingWindow: cdk.Duration.seconds(1),
        }));

        productsTable.grantWriteData(catalogBatchProcess);
        stocksTable.grantWriteData(catalogBatchProcess);
        createProductTopic.grantPublish(catalogBatchProcess);

        productsTable.grantReadData(getProductsList);
        stocksTable.grantReadData(getProductsList);
        productsTable.grantReadData(getProductsById);
        stocksTable.grantReadData(getProductsById);
        productsTable.grantWriteData(createProduct);
        stocksTable.grantWriteData(createProduct);

        const api = new apigateway.RestApi(this, 'ProductServiceApi', {
            restApiName: 'Product Service',
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
            },
        });

        const products = api.root.addResource('products');
        products.addMethod('GET', new apigateway.LambdaIntegration(getProductsList));
        products.addMethod('POST', new apigateway.LambdaIntegration(createProduct));

        const productById = products.addResource('{productId}');
        productById.addMethod('GET', new apigateway.LambdaIntegration(getProductsById));

        new cdk.CfnOutput(this, 'CatalogItemsQueueArn', {
            value: catalogItemsQueue.queueArn,
            description: 'Catalog Items SQS Queue ARN',
            exportName: 'CatalogItemsQueueArn',
        });

        new cdk.CfnOutput(this, 'CatalogItemsQueueUrl', {
            value: catalogItemsQueue.queueUrl,
            description: 'Catalog Items SQS Queue URL',
            exportName: 'CatalogItemsQueueUrl',
        });
    }
}
