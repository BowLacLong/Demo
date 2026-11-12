const os = require('os');
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB
  || (process.env.NODE_ENV === 'test' ? 'library_test' : 'library');

let client = null;
let database = null;
let connecting = null;

const UNIQUE_INDEXES = [
  ['books', 'id'],
  ['book_copies', 'id'],
  ['book_copies', 'barcode'],
  ['readers', 'id'],
  ['readers', 'reader_code'],
  ['users', 'id'],
  ['users', 'username'],
  ['borrow_tickets', 'id'],
  ['borrow_tickets', 'ticket_code'],
  ['borrow_details', 'id'],
  ['fine_receipts', 'id'],
  ['fine_receipts', 'receipt_code'],
  ['book_reservations', 'id'],
  ['categories', 'id'],
  ['categories', 'code'],
  ['authors', 'id'],
  ['publishers', 'id'],
  ['reader_types', 'id'],
  ['reader_types', 'code']
];

/**
 * Tạo index cho các trường thường truy vấn và các trường duy nhất.
 * Gọi mỗi lần kết nối, createIndex là thao tác idempotent.
 */
const SECONDARY_INDEXES = [
  ['book_copies', 'book_id'],
  ['book_copies', 'status'],
  ['book_authors', 'book_id'],
  ['book_authors', 'author_id'],
  ['borrow_tickets', 'reader_id'],
  ['borrow_tickets', 'due_date'],
  ['borrow_details', 'ticket_id'],
  ['borrow_details', 'book_copy_id'],
  ['book_reservations', 'reader_id'],
  ['books', 'category_id'],
  ['readers', 'reader_type_id']
];

/**
 * Tạo index, tự xử lý trường hợp index cùng tên nhưng khác tuỳ chọn (unique) từ phiên bản trước.
 */
async function ensureIndex(collection, field, options = {}) {
  const keys = { [field]: 1 };
  try {
    await collection.createIndex(keys, options);
  } catch (err) {
    if (err && (err.code === 85 || err.code === 86)) {
      try { await collection.dropIndex(`${field}_1`); } catch (_) { /* index không tồn tại */ }
      await collection.createIndex(keys, options);
      return;
    }
    throw err;
  }
}

async function createIndexes(db) {
  await Promise.all(SECONDARY_INDEXES.map(([name, field]) => ensureIndex(db.collection(name), field)));

  for (const [name, field] of UNIQUE_INDEXES) {
    await ensureIndex(db.collection(name), field, { unique: true });
  }
}

async function connect() {
  if (database) return database;

  if (!connecting) {
    connecting = (async () => {
      client = new MongoClient(MONGO_URI, {
        serverSelectionTimeoutMS: 8000,
        // Truyền adapter os trực tiếp: môi trường Jest không hỗ trợ dynamic import('os')
        // khiến driver không gửi được metadata và MongoDB 9 từ chối handshake.
        runtimeAdapters: { os }
      });
      await client.connect();
      database = client.db(DB_NAME);
      await createIndexes(database);
      return database;
    })().catch((err) => {
      connecting = null;
      database = null;
      if (client) {
        try { client.close(); } catch (_) { /* bỏ qua */ }
        client = null;
      }
      throw err;
    });
  }

  return connecting;
}

async function getDb() {
  return connect();
}

async function collection(name) {
  const db = await connect();
  return db.collection(name);
}

/**
 * Sinh id số tăng dần cho từng bảng (giữ nguyên định dạng mã nghiệp vụ như PM0001, DG0001).
 */
async function nextId(name) {
  const db = await connect();
  const doc = await db.collection('counters').findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return doc.seq;
}

/**
 * Đồng bộ counter theo id lớn nhất đang có (dùng sau khi seed hoặc nhập dữ liệu).
 */
async function syncCounter(name, value) {
  const db = await connect();
  await db.collection('counters').updateOne(
    { _id: name },
    { $max: { seq: Number(value) || 0 } },
    { upsert: true }
  );
}

async function resetDatabase() {
  const db = await connect();
  await db.dropDatabase();
  database = db;
  await createIndexes(db);
  return db;
}

async function disconnect() {
  if (client) {
    await client.close();
  }
  client = null;
  database = null;
  connecting = null;
}

module.exports = {
  MONGO_URI,
  DB_NAME,
  connect,
  getDb,
  collection,
  nextId,
  syncCounter,
  resetDatabase,
  disconnect
};
