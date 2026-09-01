import type { TransactionInput, TransactionType } from './db';

const REQUIRED_HEADERS = ['日期', '类型', '金额', '一级分类'];

export interface ImportCsvRow {
  date: string;
  type: TransactionType;
  amountCents: number;
  currency: string;
  category: string;
  subcategory: string | null;
  merchant: string | null;
  paymentMethod: string | null;
  description: string | null;
  rawText: string;
}

export function parseImportCsv(text: string): ImportCsvRow[] {
  const records = parseCsvRecords(text.replace(/^\uFEFF/, ''));
  if (records.length < 2) {
    throw new Error('CSV 没有可导入的数据行');
  }

  const headers = records[0].map((header) => header.trim());
  for (const header of REQUIRED_HEADERS) {
    if (!headers.includes(header)) {
      throw new Error(`CSV 缺少必要列：${header}`);
    }
  }

  const columns = new Map(headers.map((header, index) => [header, index]));
  return records.slice(1).map((record, index) => parseRow(record, index + 2, columns));
}

export async function createImportRequestId(row: ImportCsvRow, occurrence: number): Promise<string> {
  const value = [
    row.date,
    row.type,
    row.amountCents,
    row.currency,
    row.category,
    row.subcategory ?? '',
    row.merchant ?? '',
    row.paymentMethod ?? '',
    row.description ?? '',
    row.rawText,
    occurrence,
  ].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `import:${hash}`;
}

export function toImportTransactionInput(row: ImportCsvRow, requestId: string): TransactionInput {
  return {
    request_id: requestId,
    type: row.type,
    amount_cents: row.amountCents,
    currency: row.currency,
    category: row.category,
    subcategory: row.subcategory,
    merchant: row.merchant,
    payment_method: row.paymentMethod,
    transaction_date: row.date,
    description: row.description,
    raw_text: row.rawText,
    source: 'manual',
    parse_status: 'parsed',
    model_name: null,
    confidence: null,
  };
}

function parseRow(record: string[], rowNumber: number, columns: Map<string, number>): ImportCsvRow {
  const value = (header: string): string => record[columns.get(header) ?? -1]?.trim() ?? '';
  const date = value('日期');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isValidDate(date)) {
    throw new Error(`CSV 第 ${rowNumber} 行日期无效：${date || '空值'}`);
  }

  const typeValue = value('类型');
  const type: TransactionType = typeValue === '收入' || typeValue === 'income' ? 'income' : typeValue === '支出' || typeValue === 'expense' ? 'expense' : invalidType(rowNumber, typeValue);
  const amount = Number(value('金额').replace(/[¥￥,\s]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`CSV 第 ${rowNumber} 行金额无效：${value('金额') || '空值'}`);
  }

  const category = value('一级分类');
  if (!category) {
    throw new Error(`CSV 第 ${rowNumber} 行一级分类为空`);
  }

  const description = nullable(value('备注'));
  const rawText = value('原始识别文本') || description || `${type === 'income' ? '收入' : '支出'} ${amount} ${category}`;
  return {
    date,
    type,
    amountCents: Math.round(amount * 100),
    currency: value('币种') || 'CNY',
    category,
    subcategory: nullable(value('二级分类')),
    merchant: nullable(value('商户')),
    paymentMethod: nullable(value('支付方式')),
    description,
    rawText,
  };
}

function invalidType(rowNumber: number, value: string): never {
  throw new Error(`CSV 第 ${rowNumber} 行类型无效：${value || '空值'}，只能是支出或收入`);
}

function nullable(value: string): string | null {
  return value || null;
}

function isValidDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      record.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      record.push(field);
      if (record.some((item) => item.trim())) records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV 引号不匹配');
  if (field || record.length > 0) {
    record.push(field);
    if (record.some((item) => item.trim())) records.push(record);
  }
  return records;
}
