import { randomUUID } from "crypto";
import { Message } from "../models/Message";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDBClient } from "../config/aws-config";

const client = dynamoDBClient; 
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "Message"; 

export class MessageRepository {
    async post(message: Message) {
        message.id = randomUUID();

        const params = new PutCommand({
            TableName: TABLE_NAME,
            Item: message
        });

        await docClient.send(params);
        return message;
    }
}
