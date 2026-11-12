const bookService = require('../services/bookService');
const ruleService = require('../services/ruleService');
const { exportToExcel } = require('../utils/excelExport');

class BookController {
  async index(req, res) {
    const { search, category_id, author_id, available_only } = req.query;
    const books = await bookService.getAllBooks({
      search,
      categoryId: category_id,
      authorId: author_id,
      availableOnly: available_only === 'true'
    });

    const [categories, authors] = await Promise.all([
      bookService.getCategories(),
      bookService.getAuthors()
    ]);

    res.render('books/index', {
      title: 'Quản lý Sách & Tra cứu',
      books,
      categories,
      authors,
      filters: { search, category_id, author_id, available_only }
    });
  }

  async showCreate(req, res) {
    const [categories, authors, publishers] = await Promise.all([
      bookService.getCategories(),
      bookService.getAuthors(),
      bookService.getPublishers()
    ]);
    const maxGap = await ruleService.getRule('max_publish_years_gap', 8);
    const minPublishYear = new Date().getFullYear() - maxGap;

    res.render('books/create', {
      title: 'Tiếp nhận sách mới',
      categories,
      authors,
      publishers,
      minPublishYear,
      currentYear: new Date().getFullYear(),
      maxGap
    });
  }

  async create(req, res) {
    try {
      const newBook = await bookService.createBook(req.body);
      req.flash('success', `Đã tiếp nhận sách "${newBook.title}" thành công với ${newBook.total_copies} bản sách!`);
      res.redirect(`/books/${newBook.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/books/create');
    }
  }

  async showDetail(req, res) {
    const book = await bookService.getBookById(req.params.id);
    if (!book) {
      req.flash('error', 'Không tìm thấy sách yêu cầu.');
      return res.redirect('/books');
    }

    res.render('books/detail', {
      title: `Chi tiết: ${book.title}`,
      book
    });
  }

  async showEdit(req, res) {
    const book = await bookService.getBookById(req.params.id);
    if (!book) {
      req.flash('error', 'Không tìm thấy sách yêu cầu.');
      return res.redirect('/books');
    }

    const [categories, authors, publishers] = await Promise.all([
      bookService.getCategories(),
      bookService.getAuthors(),
      bookService.getPublishers()
    ]);
    const maxGap = await ruleService.getRule('max_publish_years_gap', 8);

    res.render('books/edit', {
      title: `Chỉnh sửa: ${book.title}`,
      book,
      categories,
      authors,
      publishers,
      currentYear: new Date().getFullYear(),
      minPublishYear: new Date().getFullYear() - maxGap
    });
  }

  async update(req, res) {
    try {
      await bookService.updateBook(req.params.id, req.body);
      req.flash('success', 'Cập nhật thông tin sách thành công!');
      res.redirect(`/books/${req.params.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/books/${req.params.id}/edit`);
    }
  }

  async delete(req, res) {
    try {
      await bookService.deleteBook(req.params.id);
      req.flash('success', 'Đã xoá sách thành công.');
      res.redirect('/books');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/books/${req.params.id}`);
    }
  }

  async addCopies(req, res) {
    const { count, location, note } = req.body;
    try {
      await bookService.addCopies(req.params.id, Number(count) || 1, location, note);
      req.flash('success', `Đã bổ sung ${count} bản sách mới!`);
      res.redirect(`/books/${req.params.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/books/${req.params.id}`);
    }
  }

  async exportExcel(req, res) {
    const books = await bookService.getAllBooks();
    const exportData = books.map((b, idx) => ({
      STT: idx + 1,
      'Mã Sách': `B${String(b.id).padStart(4, '0')}`,
      'Tên Sách': b.title,
      'Thể Loại': b.category_name,
      'Tác Giả': b.author_name || 'N/A',
      'Nhà Xuất Bản': b.publisher_name || 'N/A',
      'Năm Xuất Bản': b.publish_year,
      'Trị Giá (VNĐ)': b.price,
      'Tổng Số Bản': b.total_copies,
      'Hiện Có Sẵn': b.available_copies,
      'ISBN': b.isbn || ''
    }));

    exportToExcel(res, exportData, 'DanhSachSach', 'Danh_Sach_Sach_Thu_Vien');
  }
}

module.exports = new BookController();
