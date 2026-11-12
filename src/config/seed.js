const db = require('./db');
const bcrypt = require('bcryptjs');

function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) {
    console.log('Database already has data. Skipping full seed.');
    return;
  }

  console.log('Seeding database with initial library data...');

  const insertParam = db.prepare(`
    INSERT OR REPLACE INTO system_parameters (key, name, value, data_type, unit, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const params = [
    ['min_reader_age', 'Tuổi tối thiểu của độc giả', '18', 'number', 'tuổi', 'Độc giả phải đủ tuổi tối thiểu theo quy định'],
    ['max_reader_age', 'Tuổi tối đa của độc giả', '55', 'number', 'tuổi', 'Độc giả không quá tuổi tối đa theo quy định'],
    ['card_valid_months', 'Thời hạn thẻ độc giả', '6', 'number', 'tháng', 'Thẻ độc giả có giá trị trong vòng M tháng tính từ ngày cấp theo quy định'],
    ['max_publish_years_gap', 'Khoảng cách năm xuất bản tối đa', '8', 'number', 'năm', 'Chỉ nhận sách xuất bản trong vòng N năm theo quy định'],
    ['max_borrow_books', 'Số sách mượn tối đa', '5', 'number', 'cuốn', 'Mỗi độc giả chỉ được mượn tối đa K cuốn cùng lúc theo quy định'],
    ['max_borrow_days', 'Số ngày mượn tối đa', '14', 'number', 'ngày', 'Thời gian mượn tối đa cho mỗi lần mượn theo quy định'],
    ['fine_per_day', 'Tiền phạt trễ hạn mỗi ngày', '1000', 'number', 'VNĐ/ngày', 'Tiền phạt cho mỗi ngày trả trễ theo quy định'],
    ['prevent_borrow_if_overdue', 'Chặn mượn sách nếu có nợ quá hạn', '1', 'boolean', '', 'Nếu có sách quá hạn chưa trả thì không được mượn tiếp'],
    ['library_name', 'Tên Thư Viện', 'Thư Viện Trung Tâm ĐHQG', 'string', '', 'Tên hiển thị trên tiêu đề và phiếu mượn/thu'],
    ['library_address', 'Địa chỉ', 'Khu phố 6, P. Linh Trung, TP. Thủ Đức, TP. Hồ Chí Minh', 'string', '', 'Địa chỉ thư viện'],
    ['library_phone', 'Số điện thoại', '028 3725 2002', 'string', '', 'Hotline thư viện'],
    ['library_email', 'Email', 'thuvien@dhqg.edu.vn', 'string', '', 'Email liên hệ']
  ];

  const insertParamsTx = db.transaction(() => {
    for (const p of params) {
      insertParam.run(...p);
    }
  });
  insertParamsTx();

  // Categories
  const insertCategory = db.prepare('INSERT INTO categories (code, name, description) VALUES (?, ?, ?)');
  const categories = [
    ['A', 'Công nghệ Thông tin & Lập trình', 'Sách về phần mềm, trí tuệ nhân tạo, an toàn thông tin, web, di động'],
    ['B', 'Khoa học Kỹ thuật', 'Cơ khí, điện tử, viễn thông, vật liệu'],
    ['C', 'Kinh tế & Quản trị', 'Tài chính, marketing, khởi nghiệp, quản trị dự án'],
    ['D', 'Ngoại ngữ & Ngôn ngữ học', 'Tiếng Anh chuyên ngành, IELTS, tiếng Nhật, tiếng Hàn'],
    ['E', 'Văn học & Nghệ thuật', 'Tiểu thuyết, truyện ngắn, mỹ thuật, nhiếp ảnh'],
    ['F', 'Kỹ năng sống & Tư duy', 'Kỹ năng mềm, giao tiếp, lãnh đạo, quản lý thời gian']
  ];
  for (const c of categories) insertCategory.run(...c);

  // Authors
  const insertAuthor = db.prepare('INSERT INTO authors (name, bio) VALUES (?, ?)');
  const authors = [
    ['Robert C. Martin (Uncle Bob)', 'Chuyên gia phần mềm huyền thoại, tác giả Clean Code và Agile Principles'],
    ['Martin Fowler', 'Chuyên gia kiến trúc phần mềm hàng đầu, tác giả cuốn Refactoring'],
    ['Nguyễn Nhật Ánh', 'Nhà văn nổi tiếng của thiếu nhi và thanh thiếu niên Việt Nam'],
    ['James Clear', 'Tác giả sách bán chạy thế giới Atomic Habits'],
    ['Andrew S. Tanenbaum', 'Giáo sư khoa học máy tính, tác giả sách Mạng máy tính & Hệ điều hành'],
    ['PGS.TS Trần Minh Triết', 'Giảng viên cao cấp bộ môn Công nghệ Phần mềm ĐH CNTT']
  ];
  for (const a of authors) insertAuthor.run(...a);

  // Publishers
  const insertPub = db.prepare('INSERT INTO publishers (name, address, phone) VALUES (?, ?, ?)');
  const publishers = [
    ['NXB Đại học Quốc gia TP.HCM', 'Khu phố 6, Linh Trung, Thủ Đức', '028 3724 2160'],
    ['NXB Thông tin và Truyền thông', 'Tòa nhà Cục Tần số, Hà Nội', '024 3577 2139'],
    ['NXB Trẻ', '161B Lý Chính Thắng, Quận 3, TP.HCM', '028 3931 6289'],
    ['NXB Khoa học và Kỹ thuật', '70 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội', '024 3942 3173'],
    ['NXB Kim Đồng', '55 Quang Trung, Hai Bà Trưng, Hà Nội', '024 3943 4730']
  ];
  for (const pub of publishers) insertPub.run(...pub);

  // Reader Types
  const insertRT = db.prepare('INSERT INTO reader_types (code, name, max_borrow_limit) VALUES (?, ?, ?)');
  insertRT.run('X', 'Sinh viên đại học', 5);
  insertRT.run('Y', 'Giảng viên / Nghiên cứu sinh', 10);
  insertRT.run('Z', 'Học viên cao học', 7);

  // Sample Readers
  const insertReader = db.prepare(`
    INSERT INTO readers (reader_code, fullname, date_of_birth, reader_type_id, address, email, phone, created_date, expiry_date, total_debt, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date().toISOString().split('T')[0];
  const sixMonthsLater = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
  const oneMonthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  insertReader.run('DG0001', 'Nguyễn Văn An', '2004-05-15', 1, 'Ký túc xá Khu B ĐHQG, Thủ Đức', 'an.nguyen@sinhvien.edu.vn', '0901234567', oneMonthAgo, sixMonthsLater, 0, 'active');
  insertReader.run('DG0002', 'Trần Thị Bích', '2003-08-20', 1, '123 Đặng Văn Bi, Thủ Đức, TP.HCM', 'bich.tran@sinhvien.edu.vn', '0912345678', oneMonthAgo, sixMonthsLater, 15000, 'active');
  insertReader.run('DG0003', 'TS. Lê Hoàng Nam', '1985-02-10', 2, 'Phòng B204, ĐH Bách Khoa TP.HCM', 'lhnam@giangvien.edu.vn', '0987654321', oneMonthAgo, sixMonthsLater, 0, 'active');
  insertReader.run('DG0004', 'Phạm Minh Đức', '2005-11-02', 1, '45 Võ Văn Ngân, Thủ Đức', 'duc.pm@sinhvien.edu.vn', '0933445566', oneMonthAgo, sixMonthsLater, 0, 'active');

  // Users (Admin, Librarian, Reader)
  const salt = bcrypt.genSaltSync(10);
  const hashPass = (pass) => bcrypt.hashSync(pass, salt);

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, fullname, email, role, reader_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('admin', hashPass('admin123'), 'Quản Trị Viên Hệ Thống', 'admin@thuvien.edu.vn', 'admin', null);
  insertUser.run('thuthu01', hashPass('thuthu123'), 'Nguyễn Thị Mai (Thủ Thư)', 'mai.librarian@thuvien.edu.vn', 'librarian', null);
  insertUser.run('docgia01', hashPass('docgia123'), 'Nguyễn Văn An', 'an.nguyen@sinhvien.edu.vn', 'reader', 1);
  insertUser.run('docgia02', hashPass('docgia123'), 'Trần Thị Bích', 'bich.tran@sinhvien.edu.vn', 'reader', 2);

  // Books
  const insertBook = db.prepare(`
    INSERT INTO books (title, category_id, author_id, publisher_id, publish_year, price, entry_date, isbn, cover_image, summary, total_copies, available_copies)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const booksData = [
    [
      'Clean Code - Mã Sạch Trong Lập Trình', 
      1, 1, 2, 2022, 185000, '2024-01-10', '978-604-80-5511-1', 
      'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=400&q=80',
      'Cẩm nang nâng cao chất lượng mã nguồn, kiến trúc sạch và tư duy viết mã chuyên nghiệp.',
      4, 3
    ],
    [
      'Thiết Kế Mẫu Trong Công Nghệ Phần Mềm (Design Patterns)', 
      1, 2, 1, 2023, 210000, '2024-02-15', '978-604-58-9922-3',
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
      'Các mẫu thiết kế kinh điển Gang of Four, áp dụng trong xây dựng phần mềm mở rộng và bảo trì.',
      3, 2
    ],
    [
      'Cấu Trúc Dữ Liệu và Giải Thuật Ứng Dụng', 
      1, 6, 1, 2024, 150000, '2024-03-01', '978-604-58-1123-4',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80',
      'Giáo trình bài bản cho sinh viên ngành Khoa học máy tính và Kỹ thuật phần mềm.',
      5, 4
    ],
    [
      'Mạng Máy Tính và Hệ Thống Phân Tán', 
      1, 5, 4, 2021, 175000, '2023-11-20', '978-604-67-0899-2',
      'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&q=80',
      'Kiến thức từ căn bản đến nâng cao về giao thức mạng TCP/IP, định tuyến và bảo mật.',
      3, 3
    ],
    [
      'Atomic Habits - Thay Đổi Tí Hon, Hiệu Quả Bất Ngờ', 
      6, 4, 3, 2023, 169000, '2024-04-12', '978-604-1-20344-9',
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80',
      'Phương pháp khoa học xây dựng thói quen tốt và loại bỏ thói quen xấu mỗi ngày.',
      4, 3
    ],
    [
      'Cho Tôi Xin Một Vé Đi Tuổi Thơ', 
      5, 3, 3, 2024, 98000, '2024-05-18', '978-604-1-19800-4',
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80',
      'Tác phẩm văn học đoạt giải thưởng văn học ASEAN của nhà văn Nguyễn Nhật Ánh.',
      4, 4
    ]
  ];

  const insertCopy = db.prepare(`
    INSERT INTO book_copies (book_id, barcode, status, location, note)
    VALUES (?, ?, ?, ?, ?)
  `);

  booksData.forEach((b, idx) => {
    const bookId = insertBook.run(...b).lastInsertRowid;
    const totalCopies = b[10];
    const availCopies = b[11];

    for (let c = 1; c <= totalCopies; c++) {
      const barcode = `BK${String(bookId).padStart(4, '0')}-${String(c).padStart(2, '0')}`;
      const status = (c <= availCopies) ? 'available' : 'borrowed';
      const shelf = `Kệ ${(idx % 4) + 1} - Ngăn ${(c % 3) + 1}`;
      insertCopy.run(bookId, barcode, status, shelf, 'Sách mới nhập năm 2024');
    }
  });

  // Borrow Tickets & Details
  const insertTicket = db.prepare(`
    INSERT INTO borrow_tickets (ticket_code, reader_id, borrow_date, due_date, status, created_by, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDetail = db.prepare(`
    INSERT INTO borrow_details (ticket_id, book_copy_id, book_id, return_date, status, fine_amount, overdue_days)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Ticket 1: Nguyen Van An (DG0001) borrowed 1 book, active
  const past5Days = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];
  const due9DaysLater = new Date(Date.now() + 9 * 86400000).toISOString().split('T')[0];
  const ticket1 = insertTicket.run('PM0001', 1, past5Days, due9DaysLater, 'borrowing', 2, 'Mượn ôn tập thi cuối kỳ').lastInsertRowid;
  insertDetail.run(ticket1, 4, 1, null, 'borrowed', 0, 0); // Clean code copy 4

  // Ticket 2: Tran Thi Bich (DG0002) borrowed 2 books, OVERDUE by 15 days! (Fine: 15.000 VNĐ)
  const past29Days = new Date(Date.now() - 29 * 86400000).toISOString().split('T')[0];
  const due15DaysAgo = new Date(Date.now() - 15 * 86400000).toISOString().split('T')[0];
  const ticket2 = insertTicket.run('PM0002', 2, past29Days, due15DaysAgo, 'overdue', 2, 'Quá hạn 15 ngày').lastInsertRowid;
  insertDetail.run(ticket2, 7, 2, null, 'borrowed', 15000, 15); // Design patterns copy 3

  // Ticket 3: TS. Le Hoang Nam returned book on time
  const past40Days = new Date(Date.now() - 40 * 86400000).toISOString().split('T')[0];
  const due30DaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const return32DaysAgo = new Date(Date.now() - 32 * 86400000).toISOString().split('T')[0];
  const ticket3 = insertTicket.run('PM0003', 3, past40Days, due30DaysAgo, 'returned', 2, 'Đã hoàn trả đủ và đúng hạn').lastInsertRowid;
  insertDetail.run(ticket3, 12, 3, return32DaysAgo, 'returned', 0, 0);

  console.log('Database seeded successfully!');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
