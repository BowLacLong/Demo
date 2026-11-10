const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.NODE_ENV === 'test' 
  ? ':memory:' 
  : path.join(__dirname, '../../data/library.db');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Initialize schema
function initSchema() {
  db.exec(`
    -- 1. System Parameters (Cấu hình quy định QĐ1 - QĐ6)
    CREATE TABLE IF NOT EXISTS system_parameters (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      data_type TEXT NOT NULL DEFAULT 'number',
      unit TEXT,
      description TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Book Categories (Thể loại sách - QĐ1)
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Authors (Tác giả)
    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bio TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 4. Publishers (Nhà xuất bản)
    CREATE TABLE IF NOT EXISTS publishers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Books (Tựa sách / Đầu sách)
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      author_id INTEGER REFERENCES authors(id) ON DELETE SET NULL,
      publisher_id INTEGER REFERENCES publishers(id) ON DELETE SET NULL,
      publish_year INTEGER NOT NULL,
      price REAL NOT NULL,
      entry_date DATE NOT NULL,
      isbn TEXT,
      cover_image TEXT,
      summary TEXT,
      total_copies INTEGER DEFAULT 0,
      available_copies INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. Book Copies (Bản sách / Cuốn sách cá biệt)
    CREATE TABLE IF NOT EXISTS book_copies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      barcode TEXT UNIQUE NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'borrowed', 'damaged', 'lost', 'reserved')),
      location TEXT DEFAULT 'Kệ chung',
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 7. Reader Types (Loại độc giả - QĐ2)
    CREATE TABLE IF NOT EXISTS reader_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      max_borrow_limit INTEGER DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 8. Readers (Độc giả / Thẻ thư viện)
    CREATE TABLE IF NOT EXISTS readers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reader_code TEXT UNIQUE NOT NULL,
      fullname TEXT NOT NULL,
      date_of_birth DATE NOT NULL,
      reader_type_id INTEGER NOT NULL REFERENCES reader_types(id) ON DELETE RESTRICT,
      address TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      created_date DATE NOT NULL,
      expiry_date DATE NOT NULL,
      total_debt REAL DEFAULT 0,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'expired')),
      avatar TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 9. Users (Tài khoản người dùng hệ thống)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullname TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL CHECK(role IN ('admin', 'librarian', 'reader')),
      reader_id INTEGER REFERENCES readers(id) ON DELETE SET NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 10. Borrow Tickets (Phiếu mượn sách - QĐ3)
    CREATE TABLE IF NOT EXISTS borrow_tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_code TEXT UNIQUE NOT NULL,
      reader_id INTEGER NOT NULL REFERENCES readers(id) ON DELETE RESTRICT,
      borrow_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'borrowing' CHECK(status IN ('borrowing', 'returned', 'overdue', 'partially_returned')),
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 11. Borrow Details (Chi tiết mượn từng cuốn sách)
    CREATE TABLE IF NOT EXISTS borrow_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES borrow_tickets(id) ON DELETE CASCADE,
      book_copy_id INTEGER NOT NULL REFERENCES book_copies(id) ON DELETE RESTRICT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE RESTRICT,
      return_date DATE,
      status TEXT NOT NULL DEFAULT 'borrowed' CHECK(status IN ('borrowed', 'returned', 'lost', 'damaged')),
      fine_amount REAL DEFAULT 0,
      overdue_days INTEGER DEFAULT 0,
      damage_note TEXT
    );

    -- 12. Fine Receipts (Phiếu thu tiền phạt - QĐ5)
    CREATE TABLE IF NOT EXISTS fine_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_code TEXT UNIQUE NOT NULL,
      reader_id INTEGER NOT NULL REFERENCES readers(id) ON DELETE RESTRICT,
      total_debt REAL NOT NULL,
      collected_amount REAL NOT NULL,
      remaining_debt REAL NOT NULL,
      receipt_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      note TEXT
    );

    -- 13. Book Reservations (Đặt mượn sách online)
    CREATE TABLE IF NOT EXISTS book_reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reader_id INTEGER NOT NULL REFERENCES readers(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      reserve_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'fulfilled', 'cancelled', 'expired')),
      note TEXT
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_books_title ON books(title);
    CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
    CREATE INDEX IF NOT EXISTS idx_book_copies_barcode ON book_copies(barcode);
    CREATE INDEX IF NOT EXISTS idx_book_copies_book ON book_copies(book_id);
    CREATE INDEX IF NOT EXISTS idx_readers_code ON readers(reader_code);
    CREATE INDEX IF NOT EXISTS idx_readers_name ON readers(fullname);
    CREATE INDEX IF NOT EXISTS idx_borrow_tickets_reader ON borrow_tickets(reader_id);
    CREATE INDEX IF NOT EXISTS idx_borrow_tickets_code ON borrow_tickets(ticket_code);
    CREATE INDEX IF NOT EXISTS idx_borrow_details_ticket ON borrow_details(ticket_id);
  `);
}

initSchema();

module.exports = db;
