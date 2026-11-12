const db = require('../config/db');
const ruleService = require('./ruleService');

class BookService {
  getAllBooks({ search = '', categoryId = '', authorId = '', availableOnly = false, limit = 100, offset = 0 } = {}) {
    let sql = `
      SELECT b.*, 
             c.name as category_name, c.code as category_code,
             a.name as author_name, 
             p.name as publisher_name,
             (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = b.id) as total_copies,
             (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = b.id AND bc.status = 'available') as available_copies
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN publishers p ON b.publisher_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim() !== '') {
      sql += ` AND (b.title LIKE ? OR b.isbn LIKE ? OR a.name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    if (categoryId) {
      sql += ` AND b.category_id = ?`;
      params.push(categoryId);
    }

    if (authorId) {
      sql += ` AND b.author_id = ?`;
      params.push(authorId);
    }

    if (availableOnly) {
      sql += ` AND (SELECT COUNT(*) FROM book_copies bc WHERE bc.book_id = b.id AND bc.status = 'available') > 0`;
    }

    sql += ` ORDER BY b.id DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return db.prepare(sql).all(...params);
  }

  getBookById(id) {
    const book = db.prepare(`
      SELECT b.*, 
             c.name as category_name, c.code as category_code,
             a.name as author_name, a.bio as author_bio,
             p.name as publisher_name, p.address as publisher_address
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN publishers p ON b.publisher_id = p.id
      WHERE b.id = ?
    `).get(id);

    if (!book) return null;

    book.copies = db.prepare(`
      SELECT * FROM book_copies WHERE book_id = ? ORDER BY id ASC
    `).all(id);

    book.total_copies = book.copies.length;
    book.available_copies = book.copies.filter(c => c.status === 'available').length;

    return book;
  }

  createBook(bookData) {
    // 1. Kiểm tra  về năm xuất bản
    const ruleCheck = ruleService.validateBookEntry(bookData.publish_year);
    if (!ruleCheck.valid) {
      throw new Error(ruleCheck.message);
    }

    const {
      title, category_id, author_id, publisher_id,
      publish_year, price, entry_date, isbn, cover_image, summary,
      initial_copies = 1, location = 'Kệ chung'
    } = bookData;

    const todayStr = new Date().toISOString().split('T')[0];

    const insertBook = db.prepare(`
      INSERT INTO books (title, category_id, author_id, publisher_id, publish_year, price, entry_date, isbn, cover_image, summary, total_copies, available_copies)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertCopy = db.prepare(`
      INSERT INTO book_copies (book_id, barcode, status, location, note)
      VALUES (?, ?, 'available', ?, ?)
    `);

    let newBookId;
    const tx = db.transaction(() => {
      const copiesCount = Math.max(1, Number(initial_copies) || 1);
      const res = insertBook.run(
        title.trim(),
        category_id,
        author_id || null,
        publisher_id || null,
        Number(publish_year),
        Number(price) || 0,
        entry_date || todayStr,
        isbn || null,
        cover_image || null,
        summary || null,
        copiesCount,
        copiesCount
      );
      newBookId = res.lastInsertRowid;

      for (let i = 1; i <= copiesCount; i++) {
        const barcode = `BK${String(newBookId).padStart(4, '0')}-${String(i).padStart(2, '0')}`;
        insertCopy.run(newBookId, barcode, location, 'Bản sách tiếp nhận ban đầu');
      }
    });

    tx();
    return this.getBookById(newBookId);
  }

  updateBook(id, bookData) {
    if (bookData.publish_year) {
      const ruleCheck = ruleService.validateBookEntry(bookData.publish_year);
      if (!ruleCheck.valid) {
        throw new Error(ruleCheck.message);
      }
    }

    const stmt = db.prepare(`
      UPDATE books
      SET title = ?, category_id = ?, author_id = ?, publisher_id = ?,
          publish_year = ?, price = ?, isbn = ?, cover_image = ?, summary = ?
      WHERE id = ?
    `);

    stmt.run(
      bookData.title.trim(),
      bookData.category_id,
      bookData.author_id || null,
      bookData.publisher_id || null,
      Number(bookData.publish_year),
      Number(bookData.price) || 0,
      bookData.isbn || null,
      bookData.cover_image || null,
      bookData.summary || null,
      id
    );

    return this.getBookById(id);
  }

  deleteBook(id) {
    // Không cho xoá nếu có bản sách đang mượn
    const activeBorrows = db.prepare(`
      SELECT COUNT(*) as count 
      FROM borrow_details bd
      JOIN book_copies bc ON bd.book_copy_id = bc.id
      WHERE bc.book_id = ? AND bd.status = 'borrowed'
    `).get(id).count;

    if (activeBorrows > 0) {
      throw new Error(`Không thể xoá đầu sách này vì đang có ${activeBorrows} cuốn đang được mượn!`);
    }

    // Xoá bản sách rồi xoá đầu sách
    db.prepare('DELETE FROM book_copies WHERE book_id = ?').run(id);
    const res = db.prepare('DELETE FROM books WHERE id = ?').run(id);
    return res.changes > 0;
  }

  addCopies(bookId, count = 1, location = 'Kệ chung', note = '') {
    const book = db.prepare('SELECT id FROM books WHERE id = ?').get(bookId);
    if (!book) throw new Error('Không tìm thấy sách.');

    const currentCopiesCount = db.prepare('SELECT COUNT(*) as count FROM book_copies WHERE book_id = ?').get(bookId).count;
    const insertCopy = db.prepare('INSERT INTO book_copies (book_id, barcode, status, location, note) VALUES (?, ?, ?, ?, ?)');

    const tx = db.transaction(() => {
      for (let i = 1; i <= count; i++) {
        const nextIndex = currentCopiesCount + i;
        const barcode = `BK${String(bookId).padStart(4, '0')}-${String(nextIndex).padStart(2, '0')}`;
        insertCopy.run(bookId, barcode, 'available', location, note || 'Bổ sung thêm');
      }

      this.recalculateCopies(bookId);
    });

    tx();
    return this.getBookById(bookId);
  }

  recalculateCopies(bookId) {
    const total = db.prepare('SELECT COUNT(*) as count FROM book_copies WHERE book_id = ?').get(bookId).count;
    const avail = db.prepare("SELECT COUNT(*) as count FROM book_copies WHERE book_id = ? AND status = 'available'").get(bookId).count;
    db.prepare('UPDATE books SET total_copies = ?, available_copies = ? WHERE id = ?').run(total, avail, bookId);
  }

  getCategories() {
    return db.prepare('SELECT * FROM categories ORDER BY code ASC').all();
  }

  getAuthors() {
    return db.prepare('SELECT * FROM authors ORDER BY name ASC').all();
  }

  getPublishers() {
    return db.prepare('SELECT * FROM publishers ORDER BY name ASC').all();
  }

  createCategory(code, name, description = '') {
    const stmt = db.prepare('INSERT INTO categories (code, name, description) VALUES (?, ?, ?)');
    return stmt.run(code.trim().toUpperCase(), name.trim(), description.trim());
  }

  createAuthor(name, bio = '') {
    const stmt = db.prepare('INSERT INTO authors (name, bio) VALUES (?, ?)');
    return stmt.run(name.trim(), bio.trim());
  }

  createPublisher(name, address = '', phone = '') {
    const stmt = db.prepare('INSERT INTO publishers (name, address, phone) VALUES (?, ?, ?)');
    return stmt.run(name.trim(), address.trim(), phone.trim());
  }
}

module.exports = new BookService();
