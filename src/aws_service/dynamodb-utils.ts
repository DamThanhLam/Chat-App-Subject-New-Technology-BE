import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  QueryCommand, 
  UpdateCommand,
  PutCommandInput,
  GetCommandInput,
  QueryCommandInput,
  UpdateCommandInput
} from '@aws-sdk/lib-dynamodb';
import { dynamoDBClient } from '../config/aws-config';

const docClient = DynamoDBDocumentClient.from(dynamoDBClient);

interface DynamoDBParams {
  TableName: string;
  [key: string]: any;
}

export const DynamoDB = {
  putItem: async (params: PutCommandInput): Promise<void> => {
    try {
      await docClient.send(new PutCommand(params));
    } catch (error) {
      console.error('DynamoDB Put Error:', error);
      throw error;
    }
  },

  getItem: async <T = any>(params: GetCommandInput): Promise<T | undefined> => {
    try {
      const result = await docClient.send(new GetCommand(params));
      return result.Item as T;
    } catch (error) {
      console.error('DynamoDB Get Error:', error);
      throw error;
    }
  },

  updateItem: async (params: UpdateCommandInput): Promise<any> => {
    try {
      const result = await docClient.send(new UpdateCommand(params));
      return result.Attributes;
    } catch (error) {
      console.error('DynamoDB Update Error:', error);
      throw error;
    }
  },

  queryItems: async <T = any>(params: QueryCommandInput): Promise<T[]> => {
    try {
      const result = await docClient.send(new QueryCommand(params));
      return result.Items as T[] || [];
    } catch (error) {
      console.error('DynamoDB Query Error:', error);
      throw error;
    }
  }
};