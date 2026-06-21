import {
    APIGatewayTokenAuthorizerEvent,
    APIGatewayAuthorizerResult,
} from 'aws-lambda';

export const handler = async (
    event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
    const token = event.authorizationToken;

    if (!token) {
        throw new Error('Unauthorized');
    }

    try {
        const encodedCredentials = token.replace(/^Basic\s+/i, '');
        const decoded = Buffer.from(encodedCredentials, 'base64').toString('utf-8');
        const [username, password] = decoded.split(':');

        const storedPassword = process.env[username];

        if (storedPassword && storedPassword === password) {
            return generatePolicy('user', 'Allow', event.methodArn);
        }

        return generatePolicy('user', 'Deny', event.methodArn);
    } catch {
        throw new Error('Unauthorized');
    }
};

function generatePolicy(
    principalId: string,
    effect: 'Allow' | 'Deny',
    resource: string
): APIGatewayAuthorizerResult {
    return {
        principalId,
        policyDocument: {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: effect,
                    Resource: resource,
                },
            ],
        },
    };
}
