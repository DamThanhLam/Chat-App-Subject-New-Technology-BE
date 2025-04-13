// src/utils/pagination.ts
import {
  DynamoDBDocumentClient,
  ScanCommandInput,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";

// Interface để định nghĩa kiểu trả về của phân trang
export interface PaginatedResult<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
}

// Hàm phân trang chung cho DynamoDB Scan
export const paginateScan = async <T>(
  docClient: DynamoDBDocumentClient,
  params: ScanCommandInput,
  page: number = 1,
  limit: number = 10
): Promise<PaginatedResult<T>> => {
  let allItems: T[] = [];
  let lastEvaluatedKey: any = undefined;
  let totalItems = 0;

  // Đếm tổng số item khớp với điều kiện
  const countCommand = new ScanCommand({
    ...params,
    Select: "COUNT",
  });

  const countResult = await docClient.send(countCommand);
  totalItems = countResult.Count || 0;

  // Tính vị trí bắt đầu dựa trên page và limit
  const startIndex = (page - 1) * limit;
  let currentIndex = 0;
  let items: T[] = [];

  // Quét dữ liệu với phân trang
  do {
    const scanCommand = new ScanCommand({
      ...params,
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: limit,
    });

    const result = await docClient.send(scanCommand);
    const scannedItems = (result.Items as T[]) || [];
    allItems = allItems.concat(scannedItems);

    // Tính toán các item thuộc trang hiện tại
    for (const item of scannedItems) {
      if (currentIndex >= startIndex && items.length < limit) {
        items.push(item);
      }
      currentIndex++;
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey && items.length < limit);

  // Tính tổng số trang
  const totalPages = Math.ceil(totalItems / limit);

  return {
    items,
    currentPage: page,
    totalPages,
    totalItems,
    limit,
  };
};
