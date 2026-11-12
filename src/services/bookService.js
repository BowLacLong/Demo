const { getDb, nextId } = require('../config/db');
const ruleService = require('./ruleService');
const { escapeRegex } = require('../utils/search');

class BookService {
  async getAllBooks({ search = '', categoryId = '', authorId = '', availableOnly = false, limit = 100, offset = 0 } = {}) {
    const db = await getDb();
    const filter = {};

    if (search && String(search).trim() !== '') {
      const term = String(search).trim();
      const regex = { $regex: escapeRegex(term), $options: 'i' };

      const authors = await db.collection('authors').find({ name: regex }).project({ id: 1 }).toArray();
      const authorIds = authors.map(a => a.id);
      const links = authorIds.length
        ? await db.collection('book_authors').find({ author_id: { $in: authorIds } }).project({ book_id: 1 }).toArray()
        : [];
      const bookIds = [...new Set(links.map(l => l.book_id))];

      filter.$or = [
        { title: regex },
        { isbn: regex },
        ...(bookIds.length ? [{ id: { $in: bookIds } }] : [])
      ];
    }

    if (categoryId) filter.category_id = Number(categoryId);
    if (authorId) filter.author_id = Number(authorId);

    let books = await db.collection('books')
      .find(filter)
      .sort({ id: -1 })
      .skip(Number(offset) || 0)
      .limit(Number(limit) || 100)
      .toArray();

    books = await this.attachRelations(books);

    if (availableOnly) {
      books = books.filter(b => b.available_copies > 0);
    }

    return books;
  }

  /**
   * Gắn thể loại, tác giả, nhà xuất bản và số bản sách cho danh sách đầu sách.
   */
  async attachRelations(books) {
    if (books.length === 0) return [];

    const db = await getDb();
    const bookIds = books.map(b => b.id);
    const categoryIds = [...new Set(books.map(b => b.category_id).filter(Boolean))];
    const publisherIds = [...new Set(books.map(b => b.publisher_id).filter(Boolean))];

    const [categories, publishers, authors, links, copyStats] = await Promise.all([
      categoryIds.length ? db.collection('categories').find({ id: { $in: categoryIds } }).toArray() : [],
      publisherIds.length ? db.collection('publishers').find({ id: { $in: publisherIds } }).toArray() : [],
      db.collection('authors').find({}).toArray(),
      db.collection('book_authors').find({ book_id: { $in: bookIds } }).toArray(),
      db.collection('book_copies').aggregate([
        { $match: { book_id: { $in: bookIds } } },
        { $group: { _id: { book_id: '$book_id', status: '$status' }, count: { $sum: 1 } } }
      ]).toArray()
    ]);

    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const publisherMap = new Map(publishers.map(p => [p.id, p]));
    const authorMap = new Map(authors.map(a => [a.id, a]));

    const authorsByBook = new Map();
    for (const link of links.sort((a, b) => a.author_id - b.author_id)) {
      const author = authorMap.get(link.author_id);
      if (!author) continue;
      if (!authorsByBook.has(link.book_id)) authorsByBook.set(link.book_id, []);
      authorsByBook.get(link.book_id).push(author.name);
    }

    const statsByBook = new Map();
    for (const row of copyStats) {
      const bookId = row._id.book_id;
      if (!statsByBook.has(bookId)) statsByBook.set(bookId, { total: 0, available: 0 });
      const stat = statsByBook.get(bookId);
      stat.total += row.count;
      if (row._id.status === 'available') stat.available += row.count;
    }

    return books.map(book => {
      const category = categoryMap.get(book.category_id);
      const publisher = publisherMap.get(book.publisher_id);
      const names = authorsByBook.get(book.id);
      const fallbackAuthor = authorMap.get(book.author_id);
      const stat = statsByBook.get(book.id) || { total: 0, available: 0 };

      return {
        ...book,
        category_name: category ? category.name : null,
        category_code: category ? category.code : null,
        author_name: names && names.length ? names.join(', ') : (fallbackAuthor ? fallbackAuthor.name : null),
        publisher_name: publisher ? publisher.name : null,
        publisher_address: publisher ? publisher.address : null,
        total_copies: stat.total,
        available_copies: stat.available
      };
    });
  }

  async getBookById(id) {
    const db = await getDb();
    const book = await db.collection('books').findOne({ id: Number(id) });
    if (!book) return null;

    const [withRelations] = await this.attachRelations([book]);
    const copies = await db.collection('book_copies').find({ book_id: book.id }).sort({ id: 1 }).toArray();

    const primaryAuthor = book.author_id
      ? await db.collection('authors').findOne({ id: book.author_id })
      : null;

    return {
      ...withRelations,
      author_bio: primaryAuthor ? primaryAuthor.bio : null,
      copies,
      total_copies: copies.length,
      available_copies: copies.filter(c => c.status === 'available').length
    };
  }

  // Tách chuỗi "Tác giả A, Tác giả B" thành danh sách id tác giả (tự tạo tác giả mới nếu chưa có)
  async resolveAuthorIds(authorNames, fallbackAuthorId = null) {
    const raw = Array.isArray(authorNames) ? authorNames.join(',') : (authorNames || '');
    const names = String(raw)
      .split(/[,;]/)
      .map(n => n.trim())
      .filter(Boolean);

    const seen = new Set();
    const uniqueNames = [];
    for (const name of names) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueNames.push(name);
    }

    if (uniqueNames.length === 0) {
      return fallbackAuthorId ? [Number(fallbackAuthorId)] : [];
    }

    const db = await getDb();
    const ids = [];

    for (const name of uniqueNames) {
      const existing = await db.collection('authors').findOne({
        name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
      });

      if (existing) {
        ids.push(existing.id);
      } else {
        const id = await nextId('authors');
        await db.collection('authors').insertOne({ id, name, bio: null, created_at: new Date() });
        ids.push(id);
      }
    }

    return ids;
  }

  async createBook(bookData) {
    // 1. Kiểm tra về năm xuất bản
    const ruleCheck = await ruleService.validateBookEntry(bookData.publish_year);
    if (!ruleCheck.valid) {
      throw new Error(ruleCheck.message);
    }

    const {
      title, category_id, author_id, author_names, publisher_id,
      publish_year, price, entry_date, isbn, cover_image, summary,
      initial_copies = 1, location = 'Kệ chung'
    } = bookData;

    const db = await getDb();
    const todayStr = new Date().toISOString().split('T')[0];
    const copiesCount = Math.max(1, Number(initial_copies) || 1);
    const authorIds = await this.resolveAuthorIds(author_names, author_id);

    const bookId = await nextId('books');

    await db.collection('books').insertOne({
      id: bookId,
      title: String(title || '').trim(),
      category_id: Number(category_id),
      author_id: authorIds[0] || null,
      publisher_id: publisher_id ? Number(publisher_id) : null,
      publish_year: Number(publish_year),
      price: Number(price) || 0,
      entry_date: entry_date || todayStr,
      isbn: isbn || null,
      cover_image: cover_image || null,
      summary: summary || null,
      total_copies: copiesCount,
      available_copies: copiesCount,
      created_at: new Date()
    });

    if (authorIds.length) {
      await db.collection('book_authors').insertMany(
        authorIds.map(authorId => ({ book_id: bookId, author_id: authorId }))
      );
    }

    const copies = [];
    for (let i = 1; i <= copiesCount; i++) {
      copies.push({
        id: await nextId('book_copies'),
        book_id: bookId,
        barcode: `BK${String(bookId).padStart(4, '0')}-${String(i).padStart(2, '0')}`,
        status: 'available',
        location: location || 'Kệ chung',
        note: 'Bản sách tiếp nhận ban đầu',
        created_at: new Date()
      });
    }
    await db.collection('book_copies').insertMany(copies);

    return this.getBookById(bookId);
  }

  async updateBook(id, bookData) {
    if (bookData.publish_year) {
      const ruleCheck = await ruleService.validateBookEntry(bookData.publish_year);
      if (!ruleCheck.valid) {
        throw new Error(ruleCheck.message);
      }
    }

    const db = await getDb();
    const bookId = Number(id);
    const authorIds = await this.resolveAuthorIds(bookData.author_names, bookData.author_id);

    await db.collection('books').updateOne(
      { id: bookId },
      {
        $set: {
          title: String(bookData.title || '').trim(),
          category_id: Number(bookData.category_id),
          author_id: authorIds[0] || null,
          publisher_id: bookData.publisher_id ? Number(bookData.publisher_id) : null,
          publish_year: Number(bookData.publish_year),
          price: Number(bookData.price) || 0,
          isbn: bookData.isbn || null,
          cover_image: bookData.cover_image || null,
          summary: bookData.summary || null
        }
      }
    );

    await db.collection('book_authors').deleteMany({ book_id: bookId });
    if (authorIds.length) {
      await db.collection('book_authors').insertMany(
        authorIds.map(authorId => ({ book_id: bookId, author_id: authorId }))
      );
    }

    return this.getBookById(bookId);
  }

  async deleteBook(id) {
    const db = await getDb();
    const bookId = Number(id);

    const copies = await db.collection('book_copies').find({ book_id: bookId }).project({ id: 1 }).toArray();
    const copyIds = copies.map(c => c.id);

    const activeBorrows = copyIds.length
      ? await db.collection('borrow_details')
        .countDocuments({ book_copy_id: { $in: copyIds }, status: 'borrowed' })
      : 0;

    if (activeBorrows > 0) {
      throw new Error(`Không thể xoá đầu sách này vì đang có ${activeBorrows} cuốn đang được mượn!`);
    }

    await db.collection('book_copies').deleteMany({ book_id: bookId });
    await db.collection('book_authors').deleteMany({ book_id: bookId });
    const result = await db.collection('books').deleteOne({ id: bookId });
    return result.deletedCount > 0;
  }

  async addCopies(bookId, count = 1, location = 'Kệ chung', note = '') {
    const db = await getDb();
    const id = Number(bookId);
    const book = await db.collection('books').findOne({ id });
    if (!book) throw new Error('Không tìm thấy sách.');

    const currentCopiesCount = await db.collection('book_copies').countDocuments({ book_id: id });
    const copies = [];

    for (let i = 1; i <= Number(count); i++) {
      const nextIndex = currentCopiesCount + i;
      copies.push({
        id: await nextId('book_copies'),
        book_id: id,
        barcode: `BK${String(id).padStart(4, '0')}-${String(nextIndex).padStart(2, '0')}`,
        status: 'available',
        location: location || 'Kệ chung',
        note: note || 'Bổ sung thêm',
        created_at: new Date()
      });
    }

    if (copies.length) {
      await db.collection('book_copies').insertMany(copies);
    }

    await this.recalculateCopies(id);
    return this.getBookById(id);
  }

  async recalculateCopies(bookId) {
    const db = await getDb();
    const id = Number(bookId);
    const [total, avail] = await Promise.all([
      db.collection('book_copies').countDocuments({ book_id: id }),
      db.collection('book_copies').countDocuments({ book_id: id, status: 'available' })
    ]);

    await db.collection('books').updateOne(
      { id },
      { $set: { total_copies: total, available_copies: avail } }
    );
  }

  /**
   * Danh sách bản sách còn sẵn sàng cho mượn (kèm thông tin sách).
   */
  async getAvailableCopies() {
    const db = await getDb();
    const copies = await db.collection('book_copies').find({ status: 'available' }).toArray();
    if (copies.length === 0) return [];

    const bookIds = [...new Set(copies.map(c => c.book_id))];
    const [books, categories] = await Promise.all([
      db.collection('books').find({ id: { $in: bookIds } }).toArray(),
      db.collection('categories').find({}).toArray()
    ]);

    const bookMap = new Map(books.map(b => [b.id, b]));
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    return copies.map(copy => {
      const book = bookMap.get(copy.book_id) || {};
      const category = categoryMap.get(book.category_id);
      return {
        ...copy,
        title: book.title || null,
        isbn: book.isbn || null,
        cover_image: book.cover_image || null,
        category_name: category ? category.name : null
      };
    }).sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))
      || String(a.barcode || '').localeCompare(String(b.barcode || '')));
  }

  async getCategories() {
    const db = await getDb();
    return db.collection('categories').find({}).sort({ code: 1 }).toArray();
  }

  async getAuthors() {
    const db = await getDb();
    return db.collection('authors').find({}).sort({ name: 1 }).toArray();
  }

  async getPublishers() {
    const db = await getDb();
    return db.collection('publishers').find({}).sort({ name: 1 }).toArray();
  }

  async createCategory(code, name, description = '') {
    const db = await getDb();
    const normalizedCode = String(code || '').trim().toUpperCase();
    const existing = await db.collection('categories').findOne({ code: normalizedCode });
    if (existing) {
      throw new Error(`Mã thể loại "${normalizedCode}" đã tồn tại.`);
    }

    const id = await nextId('categories');
    await db.collection('categories').insertOne({
      id,
      code: normalizedCode,
      name: String(name || '').trim(),
      description: String(description || '').trim(),
      created_at: new Date()
    });

    return id;
  }

  async createAuthor(name, bio = '') {
    const db = await getDb();
    const id = await nextId('authors');
    await db.collection('authors').insertOne({
      id,
      name: String(name || '').trim(),
      bio: String(bio || '').trim(),
      created_at: new Date()
    });
    return id;
  }

  async createPublisher(name, address = '', phone = '') {
    const db = await getDb();
    const id = await nextId('publishers');
    await db.collection('publishers').insertOne({
      id,
      name: String(name || '').trim(),
      address: String(address || '').trim(),
      phone: String(phone || '').trim(),
      created_at: new Date()
    });
    return id;
  }
}

module.exports = new BookService();
