/**
 * Thoát các ký tự đặc biệt để dùng chuỗi người dùng nhập làm regex tìm kiếm an toàn.
 */
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tạo điều kiện $or tìm kiếm chuỗi con (không phân biệt hoa thường) cho nhiều trường.
 */
function searchOr(term, fields) {
  const regex = { $regex: escapeRegex(term), $options: 'i' };
  return { $or: fields.map(field => ({ [field]: regex })) };
}

module.exports = { escapeRegex, searchOr };
