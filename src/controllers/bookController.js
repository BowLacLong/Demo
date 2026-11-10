const bookService = require('../services/bookService');
const ruleService = require('../services/ruleService');
const { exportToExcel } = require('../utils/excelExport');

class BookController {
  index(req, res) {
    const { search, category_id, author_id, available_only } = req.query;
    const books = bookService.getAllBooks({
      search,
      categoryId: category_id,
      authorId: author_id,
      availableOnly: available_only === 'true'
    });

    const categories = bookService.getCategories();
    const authors = bookService.getAuthors();

    res.render('books/index', {
      title: 'Quản lý Sách & Tra cứu',
      books,
      categories,
      authors,
      filters: { search, category_id, author_id, available_only }
    });
  }

  showCreate(req, res) {
    const categories = bookService.getCategories();
    const authors = bookService.getAuthors();
    const publishers = bookService.getPublishers();
    const maxGap = ruleService.getRule('max_publish_years_gap', 8);
    const minPublishYear = new Date().getFullYear() - maxGap;

    res.render('books/create', {
      title: 'Tiếp nhận sách mới (QĐ1)',
      categories,
      authors,
      publishers,
      minPublishYear,
      currentYear: new Date().getFullYear(),
      maxGap
    });
  }

  create(req, res) {
    try {
      const newBook = bookService.createBook(req.body);
      req.flash('success', `Đã tiếp nhận sách "${newBook.title}" thành công với ${newBook.total_copies} bản sách!`);
      res.redirect(`/books/${newBook.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/books/create');
    }
  }

  showDetail(req, res) {
    const book = bookService.getBookById(req.params.id);
    if (!book) {
      req.flash('error', 'Không tìm thấy sách yêu cầu.');
      return res.redirect('/books');
    }

    res.render('books/detail', {
      title: `Chi tiết: ${book.title}`,
      book
    });
  }

  showEdit(req, res) {
    const book = bookService.getBookById(req.params.id);
    if (!book) {
      req.flash('error', 'Không tìm thấy sách yêu cầu.');
      return res.redirect('/books');
    }

    const categories = bookService.getCategories();
    const authors = bookService.getAuthors();
    const publishers = bookService.getPublishers();
    const maxGap = ruleService.getRule('max_publish_years_gap', 8);

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

  update(req, res) {
    try {
      bookService.updateBook(req.params.id, req.body);
      req.flash('success', 'Cập nhật thông tin sách thành công!');
      res.redirect(`/books/${req.params.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/books/${req.params.id}/edit`);
    }
  }

  delete(req, res) {
    try {
      bookService.deleteBook(req.params.id);
      req.flash('success', 'Đã xoá sách thành công.');
      res.redirect('/books');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/books/${req.params.id}`);
    }
  }

  addCopies(req, res) {
    const { count, location, note } = req.body;
    try {
      bookService.addCopies(req.params.id, Number(count) || 1, location, note);
      req.flash('success', `Đã bổ sung ${count} bản sách mới!`);
      res.redirect(`/books/${req.params.id}`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect(`/books/${req.params.id}`);
    }
  }

  exportExcel(req, res) {
    const books = bookService.getAllBooks();
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
