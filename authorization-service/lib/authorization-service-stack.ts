import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../.env') });

export class AuthorizationServiceStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const githubLogin = process.env.GITHUB_LOGIN;
        const testPassword = process.env.TEST_PASSWORD;

        if (!githubLogin || !testPassword) {
            throw new Error('Missing required environment variables: GITHUB_LOGIN and TEST_PASSWORD must be set in .env file');
        }

        const basicAuthorizer = new NodejsFunction(this, 'BasicAuthorizer', {
            runtime: lambda.Runtime.NODEJS_22_X,
            entry: path.join(__dirname, '../lambda/basicAuthorizer.ts'),
            handler: 'handler',
            environment: {
                [githubLogin]: testPassword,
            },
        });

        new cdk.CfnOutput(this, 'BasicAuthorizerArn', {
            value: basicAuthorizer.functionArn,
            exportName: 'BasicAuthorizerArn',
        });
    }
}
