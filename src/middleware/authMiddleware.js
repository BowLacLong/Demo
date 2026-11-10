const ruleService = require('../services/ruleService');

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error', 'Vui lòng đăng nhập để tiếp tục.');
  return res.redirect('/login');
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.flash('error', 'Vui lòng đăng nhập.');
      return res.redirect('/login');
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      req.flash('error', 'Bạn không có quyền truy cập vào chức năng này!');
      return res.status(403).render('error', {
        title: 'Truy cập bị từ chối (403)',
        message: 'Bạn không có quyền hạn để thực hiện thao tác này.',
        statusCode: 403
      });
    }

    next();
  };
}

function attachLocals(req, res, next) {
  res.locals.currentUser = req.session ? req.session.user : null;
  res.locals.flashSuccess = req.flash('success');
  res.locals.flashError = req.flash('error');
  res.locals.currentPath = req.path;
  
  // Attach common library info
  try {
    const rules = ruleService.getRulesMap();
    res.locals.libraryName = rules.library_name || 'Hệ Thống Quản Lý Thư Viện';
    res.locals.systemRules = rules;
  } catch (e) {
    res.locals.libraryName = 'Hệ Thống Quản Lý Thư Viện';
    res.locals.systemRules = {};
  }

  next();
}

module.exports = {
  isAuthenticated,
  authorize,
  attachLocals
};
