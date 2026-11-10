const express = require('express');
const router = express.Router();
const bookService = require('../services/bookService');
const readerService = require('../services/readerService');
const borrowService = require('../services/borrowService');
const fineService = require('../services/fineService');
const ruleService = require('../services/ruleService');
const reportService = require('../services/reportService');

// --- Books API ---
router.get('/books', (req, res) => {
  try {
    const books = bookService.getAllBooks(req.query);
    res.json({ success: true, count: books.length, data: books });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/books/:id', (req, res) => {
  try {
    const book = bookService.getBookById(req.params.id);
    if (!book) return res.status(404).json({ success: false, error: 'Không tìm thấy sách' });
    res.json({ success: true, data: book });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/books', (req, res) => {
  try {
    const book = bookService.createBook(req.body);
    res.status(201).json({ success: true, data: book });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Readers API ---
router.get('/readers', (req, res) => {
  try {
    const readers = readerService.getAllReaders(req.query);
    res.json({ success: true, count: readers.length, data: readers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/readers/:id', (req, res) => {
  try {
    const reader = readerService.getReaderById(req.params.id);
    if (!reader) return res.status(404).json({ success: false, error: 'Không tìm thấy độc giả' });
    res.json({ success: true, data: reader });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/readers', (req, res) => {
  try {
    const reader = readerService.createReader(req.body);
    res.status(201).json({ success: true, data: reader });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Borrow & Return API ---
router.get('/borrow', (req, res) => {
  try {
    const tickets = borrowService.getAllTickets(req.query);
    res.json({ success: true, count: tickets.length, data: tickets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/borrow', (req, res) => {
  try {
    const ticket = borrowService.createBorrowTicket(req.body);
    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/borrow/:id/return', (req, res) => {
  try {
    const { items, return_date } = req.body;
    const result = borrowService.returnBooks(req.params.id, items, return_date);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Fines API ---
router.get('/fines', (req, res) => {
  try {
    const receipts = fineService.getAllReceipts(req.query);
    res.json({ success: true, count: receipts.length, data: receipts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/fines', (req, res) => {
  try {
    const receipt = fineService.createReceipt(req.body);
    res.status(201).json({ success: true, data: receipt });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Rules & System Params API ---
router.get('/rules', (req, res) => {
  try {
    const rules = ruleService.getAllRules();
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/rules', (req, res) => {
  try {
    ruleService.updateManyRules(req.body);
    res.json({ success: true, message: 'Cập nhật quy định thành công' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Reports & Stats API ---
router.get('/stats', (req, res) => {
  try {
    const stats = reportService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reports/categories', (req, res) => {
  try {
    const { month, year } = req.query;
    const today = new Date();
    const report = reportService.getMonthlyBorrowByCategory(
      month || (today.getMonth() + 1),
      year || today.getFullYear()
    );
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/reports/overdue', (req, res) => {
  try {
    const report = reportService.getOverdueReport(req.query.date);
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
