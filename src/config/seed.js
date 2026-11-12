const { connect, getDb, syncCounter } = require('./db');
const bcrypt = require('bcryptjs');

function daysFromNow(days) {
  return new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
}

async function seedDatabase() {
  await connect();
  const db = await getDb();

  const userCount = await db.collection('users').countDocuments();
  if (userCount > 0) {
    console.log('Database already has data. Skipping full seed.');
    return;
  }

  console.log('Seeding MongoDB with initial library data...');

  // 1. System parameters (Quy định QĐ1 - QĐ6)
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

  await db.collection('system_parameters').insertMany(params.map(([key, name, value, data_type, unit, description]) => ({
    key,
    name,
    value,
    data_type,
    unit,
    description,
    updated_at: new Date()
  })));

  // 2. Categories
  const categories = [
    ['A', 'Công nghệ Thông tin & Lập trình', 'Sách về phần mềm, trí tuệ nhân tạo, an toàn thông tin, web, di động'],
    ['B', 'Khoa học Kỹ thuật', 'Cơ khí, điện tử, viễn thông, vật liệu'],
    ['C', 'Kinh tế & Quản trị', 'Tài chính, marketing, khởi nghiệp, quản trị dự án'],
    ['D', 'Ngoại ngữ & Ngôn ngữ học', 'Tiếng Anh chuyên ngành, IELTS, tiếng Nhật, tiếng Hàn'],
    ['E', 'Văn học & Nghệ thuật', 'Tiểu thuyết, truyện ngắn, mỹ thuật, nhiếp ảnh'],
    ['F', 'Kỹ năng sống & Tư duy', 'Kỹ năng mềm, giao tiếp, lãnh đạo, quản lý thời gian']
  ];
  await db.collection('categories').insertMany(categories.map(([code, name, description], idx) => ({
    id: idx + 1, code, name, description, created_at: new Date()
  })));

  // 3. Authors
  const authors = [
    ['Robert C. Martin (Uncle Bob)', 'Chuyên gia phần mềm huyền thoại, tác giả Clean Code và Agile Principles'],
    ['Martin Fowler', 'Chuyên gia kiến trúc phần mềm hàng đầu, tác giả cuốn Refactoring'],
    ['Nguyễn Nhật Ánh', 'Nhà văn nổi tiếng của thiếu nhi và thanh thiếu niên Việt Nam'],
    ['James Clear', 'Tác giả sách bán chạy thế giới Atomic Habits'],
    ['Andrew S. Tanenbaum', 'Giáo sư khoa học máy tính, tác giả sách Mạng máy tính & Hệ điều hành'],
    ['PGS.TS Trần Minh Triết', 'Giảng viên cao cấp bộ môn Công nghệ Phần mềm ĐH CNTT']
  ];
  await db.collection('authors').insertMany(authors.map(([name, bio], idx) => ({
    id: idx + 1, name, bio, created_at: new Date()
  })));

  // 4. Publishers
  const publishers = [
    ['NXB Đại học Quốc gia TP.HCM', 'Khu phố 6, Linh Trung, Thủ Đức', '028 3724 2160'],
    ['NXB Thông tin và Truyền thông', 'Tòa nhà Cục Tần số, Hà Nội', '024 3577 2139'],
    ['NXB Trẻ', '161B Lý Chính Thắng, Quận 3, TP.HCM', '028 3931 6289'],
    ['NXB Khoa học và Kỹ thuật', '70 Trần Hưng Đạo, Hoàn Kiếm, Hà Nội', '024 3942 3173'],
    ['NXB Kim Đồng', '55 Quang Trung, Hai Bà Trưng, Hà Nội', '024 3943 4730']
  ];
  await db.collection('publishers').insertMany(publishers.map(([name, address, phone], idx) => ({
    id: idx + 1, name, address, phone, created_at: new Date()
  })));

  // 5. Reader types
  const readerTypes = [
    ['X', 'Sinh viên đại học', 5],
    ['Y', 'Giảng viên / Nghiên cứu sinh', 10],
    ['Z', 'Học viên cao học', 7]
  ];
  await db.collection('reader_types').insertMany(readerTypes.map(([code, name, max_borrow_limit], idx) => ({
    id: idx + 1, code, name, max_borrow_limit, created_at: new Date()
  })));

  // 6. Readers
  const oneMonthAgo = daysFromNow(-30);
  const sixMonthsLater = daysFromNow(180);
  const readers = [
    ['DG0001', 'Nguyễn Văn An', '2004-05-15', 1, 'Ký túc xá Khu B ĐHQG, Thủ Đức', 'an.nguyen@sinhvien.edu.vn', '0901234567', 0, 'active'],
    ['DG0002', 'Trần Thị Bích', '2003-08-20', 1, '123 Đặng Văn Bi, Thủ Đức, TP.HCM', 'bich.tran@sinhvien.edu.vn', '0912345678', 15000, 'active'],
    ['DG0003', 'TS. Lê Hoàng Nam', '1985-02-10', 2, 'Phòng B204, ĐH Bách Khoa TP.HCM', 'lhnam@giangvien.edu.vn', '0987654321', 0, 'active'],
    ['DG0004', 'Phạm Minh Đức', '2005-11-02', 1, '45 Võ Văn Ngân, Thủ Đức', 'duc.pm@sinhvien.edu.vn', '0933445566', 0, 'active']
  ];
  await db.collection('readers').insertMany(readers.map((r, idx) => ({
    id: idx + 1,
    reader_code: r[0],
    fullname: r[1],
    date_of_birth: r[2],
    reader_type_id: r[3],
    address: r[4],
    email: r[5],
    phone: r[6],
    created_date: oneMonthAgo,
    expiry_date: sixMonthsLater,
    total_debt: r[7],
    status: r[8],
    avatar: null,
    created_at: new Date()
  })));

  // 7. Users
  const salt = bcrypt.genSaltSync(10);
  const hashPass = (pass) => bcrypt.hashSync(pass, salt);
  const users = [
    ['admin', hashPass('admin123'), 'Quản Trị Viên Hệ Thống', 'admin@thuvien.edu.vn', 'admin', null],
    ['thuthu01', hashPass('thuthu123'), 'Nguyễn Thị Mai (Thủ Thư)', 'mai.librarian@thuvien.edu.vn', 'librarian', null],
    ['docgia01', hashPass('docgia123'), 'Nguyễn Văn An', 'an.nguyen@sinhvien.edu.vn', 'reader', 1],
    ['docgia02', hashPass('docgia123'), 'Trần Thị Bích', 'bich.tran@sinhvien.edu.vn', 'reader', 2]
  ];
  await db.collection('users').insertMany(users.map(([username, password, fullname, email, role, reader_id], idx) => ({
    id: idx + 1, username, password, fullname, email, role, reader_id, is_active: 1, created_at: new Date()
  })));

  // 8. Books
  const booksData = [
    ['Clean Code - Mã Sạch Trong Lập Trình', 1, 1, 2, 2022, 185000, '2024-01-10', '978-604-80-5511-1',
      'https://images.unsplash.com/photo-1532012164546-f432f2e3edd4?w=400&q=80',
      'Cẩm nang nâng cao chất lượng mã nguồn, kiến trúc sạch và tư duy viết mã chuyên nghiệp.', 4, 3],
    ['Thiết Kế Mẫu Trong Công Nghệ Phần Mềm (Design Patterns)', 1, 2, 1, 2023, 210000, '2024-02-15', '978-604-58-9922-3',
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
      'Các mẫu thiết kế kinh điển Gang of Four, áp dụng trong xây dựng phần mềm mở rộng và bảo trì.', 3, 2],
    ['Cấu Trúc Dữ Liệu và Giải Thuật Ứng Dụng', 1, 6, 1, 2024, 150000, '2024-03-01', '978-604-58-1123-4',
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80',
      'Giáo trình bài bản cho sinh viên ngành Khoa học máy tính và Kỹ thuật phần mềm.', 5, 4],
    ['Mạng Máy Tính và Hệ Thống Phân Tán', 1, 5, 4, 2021, 175000, '2023-11-20', '978-604-67-0899-2',
      'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&q=80',
      'Kiến thức từ căn bản đến nâng cao về giao thức mạng TCP/IP, định tuyến và bảo mật.', 3, 3],
    ['Atomic Habits - Thay Đổi Tí Hon, Hiệu Quả Bất Ngờ', 6, 4, 3, 2023, 169000, '2024-04-12', '978-604-1-20344-9',
      'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&q=80',
      'Phương pháp khoa học xây dựng thói quen tốt và loại bỏ thói quen xấu mỗi ngày.', 4, 3],
    ['Cho Tôi Xin Một Vé Đi Tuổi Thơ', 5, 3, 3, 2024, 98000, '2024-05-18', '978-604-1-19800-4',
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80',
      'Tác phẩm văn học đoạt giải thưởng văn học ASEAN của nhà văn Nguyễn Nhật Ánh.', 4, 4]
  ];

  const bookDocs = [];
  const copyDocs = [];
  const bookAuthorDocs = [];
  let copyId = 0;

  booksData.forEach((b, idx) => {
    const bookId = idx + 1;
    const totalCopies = b[10];
    const availCopies = b[11];

    bookDocs.push({
      id: bookId,
      title: b[0],
      category_id: b[1],
      author_id: b[2],
      publisher_id: b[3],
      publish_year: b[4],
      price: b[5],
      entry_date: b[6],
      isbn: b[7],
      cover_image: b[8],
      summary: b[9],
      total_copies: totalCopies,
      available_copies: availCopies,
      created_at: new Date()
    });

    bookAuthorDocs.push({ book_id: bookId, author_id: b[2] });

    for (let c = 1; c <= totalCopies; c++) {
      copyId += 1;
      copyDocs.push({
        id: copyId,
        book_id: bookId,
        barcode: `BK${String(bookId).padStart(4, '0')}-${String(c).padStart(2, '0')}`,
        status: c <= availCopies ? 'available' : 'borrowed',
        location: `Kệ ${(idx % 4) + 1} - Ngăn ${(c % 3) + 1}`,
        note: 'Sách mới nhập năm 2024',
        created_at: new Date()
      });
    }
  });

  await db.collection('books').insertMany(bookDocs);
  await db.collection('book_authors').insertMany(bookAuthorDocs);
  await db.collection('book_copies').insertMany(copyDocs);

  // 9. Borrow tickets & details
  const tickets = [
    ['PM0001', 1, daysFromNow(-5), daysFromNow(9), 'borrowing', 2, 'Mượn ôn tập thi cuối kỳ'],
    ['PM0002', 2, daysFromNow(-29), daysFromNow(-15), 'overdue', 2, 'Quá hạn 15 ngày'],
    ['PM0003', 3, daysFromNow(-40), daysFromNow(-30), 'returned', 2, 'Đã hoàn trả đủ và đúng hạn']
  ];

  await db.collection('borrow_tickets').insertMany(tickets.map((t, idx) => ({
    id: idx + 1,
    ticket_code: t[0],
    reader_id: t[1],
    borrow_date: t[2],
    due_date: t[3],
    status: t[4],
    created_by: t[5],
    note: t[6],
    created_at: new Date()
  })));

  const details = [
    [1, 4, 1, null, 'borrowed', 0, 0],
    [2, 7, 2, null, 'borrowed', 15000, 15],
    [3, 12, 3, daysFromNow(-32), 'returned', 0, 0]
  ];

  await db.collection('borrow_details').insertMany(details.map((d, idx) => ({
    id: idx + 1,
    ticket_id: d[0],
    book_copy_id: d[1],
    book_id: d[2],
    return_date: d[3],
    status: d[4],
    fine_amount: d[5],
    overdue_days: d[6],
    damage_note: null
  })));

  // 10. Bộ đếm id đồng bộ theo dữ liệu vừa nạp
  await Promise.all([
    syncCounter('categories', 6),
    syncCounter('authors', 6),
    syncCounter('publishers', 5),
    syncCounter('reader_types', 3),
    syncCounter('readers', 4),
    syncCounter('users', 4),
    syncCounter('books', bookDocs.length),
    syncCounter('book_copies', copyDocs.length),
    syncCounter('borrow_tickets', 3),
    syncCounter('borrow_details', 3),
    syncCounter('fine_receipts', 0),
    syncCounter('book_reservations', 0)
  ]);

  console.log('MongoDB seeded successfully!');
}

if (require.main === module) {
  seedDatabase()
    .then(() => require('./db').disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed thất bại:', err.message);
      process.exit(1);
    });
}

module.exports = seedDatabase;
