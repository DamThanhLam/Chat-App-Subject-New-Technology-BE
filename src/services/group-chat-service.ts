import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { DynamoDB } from '../aws_service/dynamodb-utils';
import { S3Utils } from '../aws_service/s3-utils';

interface IGroup {
  groupId: string;
  groupName: string;
  admins: string[];
  createdAt: string;
  createdBy: string;
  description?: string;
  lastMessageAt?: string;
  members: string[];
  numOfMembers: number;
  updatedAt?: string;
  url?: string;
}

interface IGroupMessage {
  messageId: string;
  groupId: string;
  content: string;
  createdAt: string;
  senderId: string;
  status: string;
  fileType?: string;
  fileUrl?: string;
  replyTo?: string;
  updatedAt?: string;
  reactions?: Record<string, string[]>;
}

declare module 'express' {
  interface Request {
    file?: Express.Multer.File;
  }
}

export class GroupChatService {
  static async createGroup(req: Request, res: Response) {
    try {
      const { groupName, createdBy, description } = req.body;
      const groupId = `grp_${uuidv4().split('-').join('').substring(0, 8)}`;
      const createdAt = new Date().toISOString();
      const initialMembers = [createdBy];

      const group: IGroup = {
        groupId,
        groupName,
        admins: [createdBy],
        createdAt,
        createdBy,
        members: initialMembers,
        numOfMembers: initialMembers.length,
        ...(description && { description })
      };

      await DynamoDB.putItem({
        TableName: 'Groups',
        Item: group
      });

      res.status(201).json({ 
        success: true, 
        data: group
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create group',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async sendMessage(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { senderId, content, replyTo } = req.body;
      const file = req.file;
      const now = new Date().toISOString();

      const group = await DynamoDB.getItem({
        TableName: 'Groups',
        Key: { groupId }
      }) as IGroup | null;

      if (!group) {
        return res.status(404).json({ 
          success: false, 
          message: 'Group not found' 
        });
      }

      if (!group.members.includes(senderId)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not a group member' 
        });
      }

      const messageId = `msg_${uuidv4().split('-').join('').substring(0, 8)}`;
      let fileUrl: string | undefined;
      let fileType: string | undefined;

      if (file) {
        fileType = file.mimetype.split('/')[1] || 'unknown';
        const fileKey = `group-chats/${groupId}/${messageId}/${file.originalname}`;
        await S3Utils.uploadFile({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimetype
        });
        fileUrl = await S3Utils.getFileUrl({
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: fileKey
        });
      }

      const message: IGroupMessage = {
        messageId,
        groupId,
        content,
        createdAt: now,
        senderId,
        status: 'sent',
        updatedAt: now,
        ...(fileUrl && { fileUrl }),
        ...(fileType && { fileType }),
        ...(replyTo && { replyTo }),
        reactions: {}
      };

      await Promise.all([
        DynamoDB.putItem({
          TableName: 'GroupMessages',
          Item: message
        }),
        DynamoDB.updateItem({
          TableName: 'Groups',
          Key: { groupId },
          UpdateExpression: 'SET lastMessageAt = :lastMessageAt',
          ExpressionAttributeValues: {
            ':lastMessageAt': now
          }
        })
      ]);

      res.status(201).json({ 
        success: true,
        data: message
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send message',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async updateGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { description, url } = req.body;
      const updatedAt = new Date().toISOString();

      const updateValues: Record<string, any> = {
        ':updatedAt': updatedAt
      };

      let updateExpression = 'SET updatedAt = :updatedAt';

      if (description) {
        updateExpression += ', description = :description';
        updateValues[':description'] = description;
      }

      if (url) {
        updateExpression += ', url = :url';
        updateValues[':url'] = url;
      }

      const result = await DynamoDB.updateItem({
        TableName: 'Groups',
        Key: { groupId },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: updateValues,
        ReturnValues: 'ALL_NEW'
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Failed to update group'
      });
    }
  }

  static async getGroupInfo(req: Request, res: Response) {
    try {
      const { groupId } = req.params;

      const group = await DynamoDB.getItem({
        TableName: 'Groups',
        Key: { groupId }
      }) as IGroup | null;

      if (!group) {
        return res.status(404).json({ 
          success: false, 
          message: 'Group not found' 
        });
      }

      res.status(200).json({
        success: true,
        data: group
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Failed to get group info'
      });
    }
  }

  static async addMemberToGroup(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { userId } = req.body;

      const group = await DynamoDB.getItem({
        TableName: 'Groups',
        Key: { groupId }
      }) as IGroup | null;

      if (!group) {
        return res.status(404).json({ 
          success: false, 
          message: 'Group not found' 
        });
      }

      if (group.members.includes(userId)) {
        return res.status(400).json({ 
          success: false, 
          message: 'User already in group' 
        });
      }

      const result = await DynamoDB.updateItem({
        TableName: 'Groups',
        Key: { groupId },
        UpdateExpression: 'SET members = list_append(members, :newMember), numOfMembers = :newCount',
        ExpressionAttributeValues: {
          ':newMember': [userId],
          ':newCount': group.numOfMembers + 1
        },
        ReturnValues: 'ALL_NEW'
      });

      res.status(200).json({
        success: true,
        data: {
          numOfMembers: result?.numOfMembers,
          members: result?.members
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Failed to add member to group'
      });
    }
  }

  static async getMessages(req: Request, res: Response) {
    try {
      const { groupId } = req.params;
      const { limit = 20, lastEvaluatedKey } = req.query;

      const params = {
        TableName: 'GroupMessages',
        KeyConditionExpression: 'groupId = :groupId',
        ExpressionAttributeValues: {
          ':groupId': groupId
        },
        Limit: Number(limit),
        ScanIndexForward: false,
        ...(lastEvaluatedKey && { ExclusiveStartKey: JSON.parse(lastEvaluatedKey as string) })
      };

      const messages = await DynamoDB.queryItems(params) as IGroupMessage[];

      res.status(200).json({
        success: true,
        data: {
          messages: messages.reverse(),
          lastEvaluatedKey: messages.length ? JSON.stringify(messages[messages.length - 1]) : null
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Failed to get messages'
      });
    }
  }
}