const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');
const bookController = require('../controllers/bookController');
const readerController = require('../controllers/readerController');
const borrowController = require('../controllers/borrowController');
const fineController = require('../controllers/fineController');
const ruleController = require('../controllers/ruleController');
const reportController = require('../controllers/reportController');
const userController = require('../controllers/userController');
const portalController = require('../controllers/portalController');
const reservationController = require('../controllers/reservationController');

const { isAuthenticated, authorize } = require('../middleware/authMiddleware');

// Home redirection
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'reader') {
      return res.redirect('/books');
    }
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

// Authentication
router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.get('/logout', authController.logout);

// User Profile (All logged-in users)
router.get('/profile', isAuthenticated, authController.showProfile);
router.post('/profile/password', isAuthenticated, authController.changePassword);

// Dashboard (Admin & Librarian)
router.get('/dashboard', isAuthenticated, authorize('admin', 'librarian'), dashboardController.index);

// --- Books Management ---
// Anyone logged in can browse & view books
router.get('/books', isAuthenticated, bookController.index);
router.get('/books/export', isAuthenticated, authorize('admin', 'librarian'), bookController.exportExcel);
router.get('/books/create', isAuthenticated, authorize('admin', 'librarian'), bookController.showCreate);
router.post('/books', isAuthenticated, authorize('admin', 'librarian'), bookController.create);
router.get('/books/:id', isAuthenticated, bookController.showDetail);
router.get('/books/:id/edit', isAuthenticated, authorize('admin', 'librarian'), bookController.showEdit);
router.post('/books/:id', isAuthenticated, authorize('admin', 'librarian'), bookController.update);
router.post('/books/:id/delete', isAuthenticated, authorize('admin'), bookController.delete);
router.post('/books/:id/copies', isAuthenticated, authorize('admin', 'librarian'), bookController.addCopies);

// --- Readers & Cards Management ---
router.get('/readers', isAuthenticated, authorize('admin', 'librarian'), readerController.index);
router.get('/readers/export', isAuthenticated, authorize('admin', 'librarian'), readerController.exportExcel);
router.get('/readers/create', isAuthenticated, authorize('admin', 'librarian'), readerController.showCreate);
router.post('/readers', isAuthenticated, authorize('admin', 'librarian'), readerController.create);
router.get('/readers/:id', isAuthenticated, readerController.showDetail);
router.get('/readers/:id/edit', isAuthenticated, authorize('admin', 'librarian'), readerController.showEdit);
router.post('/readers/:id', isAuthenticated, authorize('admin', 'librarian'), readerController.update);
router.post('/readers/:id/extend', isAuthenticated, authorize('admin', 'librarian'), readerController.extend);
router.post('/readers/:id/delete', isAuthenticated, authorize('admin'), readerController.delete);

// --- Borrow & Return Management ---
router.get('/borrow', isAuthenticated, authorize('admin', 'librarian'), borrowController.index);
router.get('/borrow/export', isAuthenticated, authorize('admin', 'librarian'), borrowController.exportExcel);
router.get('/borrow/overdue', isAuthenticated, authorize('admin', 'librarian'), borrowController.overdueList);
router.get('/borrow/create', isAuthenticated, authorize('admin', 'librarian'), borrowController.showCreate);
router.post('/borrow', isAuthenticated, authorize('admin', 'librarian'), borrowController.create);
router.get('/borrow/:id', isAuthenticated, borrowController.showDetail);
router.get('/borrow/:id/return', isAuthenticated, authorize('admin', 'librarian'), borrowController.showReturn);
router.post('/borrow/:id/return', isAuthenticated, authorize('admin', 'librarian'), borrowController.processReturn);
router.post('/borrow/:id/extend', isAuthenticated, authorize('admin', 'librarian'), borrowController.extend);

// --- Fine Receipts ---
router.get('/fines', isAuthenticated, authorize('admin', 'librarian'), fineController.index);
router.get('/fines/export', isAuthenticated, authorize('admin', 'librarian'), fineController.exportExcel);
router.get('/fines/create', isAuthenticated, authorize('admin', 'librarian'), fineController.showCreate);
router.post('/fines', isAuthenticated, authorize('admin', 'librarian'), fineController.create);
router.get('/fines/:id', isAuthenticated, fineController.showDetail);
router.get('/fines/:id/print', isAuthenticated, fineController.printReceipt);

// --- Reader Portal (Doc gia) ---
router.get('/portal', isAuthenticated, authorize('reader'), portalController.index);
router.post('/portal/reserve', isAuthenticated, authorize('reader'), portalController.reserveBook);
router.post('/portal/reservations/:id/cancel', isAuthenticated, authorize('reader'), portalController.cancelReservation);

// --- Book Reservations (Admin & Librarian) ---
router.get('/reservations', isAuthenticated, authorize('admin', 'librarian'), reservationController.index);
router.post('/reservations/:id/status', isAuthenticated, authorize('admin', 'librarian'), reservationController.updateStatus);

// --- Business Rules (Admin only) ---
router.get('/rules', isAuthenticated, authorize('admin'), ruleController.index);
router.post('/rules', isAuthenticated, authorize('admin'), ruleController.update);
router.post('/rules/categories', isAuthenticated, authorize('admin'), ruleController.addCategory);
router.post('/rules/reader-types', isAuthenticated, authorize('admin'), ruleController.addReaderType);

// --- Reports ---
router.get('/reports/categories', isAuthenticated, authorize('admin', 'librarian'), reportController.categoryReport);
router.get('/reports/categories/export', isAuthenticated, authorize('admin', 'librarian'), reportController.exportCategoryExcel);
router.get('/reports/overdue', isAuthenticated, authorize('admin', 'librarian'), reportController.overdueReport);
router.get('/reports/overdue/export', isAuthenticated, authorize('admin', 'librarian'), reportController.exportOverdueExcel);

// --- User Management (Admin only) ---
router.get('/users', isAuthenticated, authorize('admin'), userController.index);
router.post('/users', isAuthenticated, authorize('admin'), userController.create);
router.post('/users/:id', isAuthenticated, authorize('admin'), userController.update);
router.post('/users/:id/reset-password', isAuthenticated, authorize('admin'), userController.resetPassword);
router.post('/users/:id/delete', isAuthenticated, authorize('admin'), userController.delete);

module.exports = router;
