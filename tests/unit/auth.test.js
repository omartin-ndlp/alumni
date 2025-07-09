const authMiddleware = require('../../src/middleware/auth');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      session: {},
      originalUrl: '/test-url',
    };
    mockRes = {
      locals: {},
      redirect: jest.fn(),
      render: jest.fn(),
      status: jest.fn().mockReturnThis(), // Allows chaining .status().render()
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addUserToLocals', () => {
    test('should set res.locals.user and isLoggedIn to true if user exists in session', () => {
      mockReq.session.user = { id: 1, username: 'testuser', is_admin: false };
      authMiddleware(mockReq, mockRes, mockNext);
      expect(mockRes.locals.user).toEqual(mockReq.session.user);
      expect(mockRes.locals.isLoggedIn).toBe(true);
      expect(mockRes.locals.isAdmin).toBe(false);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should set res.locals.user to null and isLoggedIn to false if no user in session', () => {
      authMiddleware(mockReq, mockRes, mockNext);
      expect(mockRes.locals.user).toBeNull();
      expect(mockRes.locals.isLoggedIn).toBe(false);
      expect(mockRes.locals.isAdmin).toBe(false);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should set res.locals.isAdmin to true if user is admin', () => {
      mockReq.session.user = { id: 1, username: 'admin', is_admin: true };
      authMiddleware(mockReq, mockRes, mockNext);
      expect(mockRes.locals.isAdmin).toBe(true);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should set res.locals.title to default if not already set', () => {
      authMiddleware(mockReq, mockRes, mockNext);
      expect(mockRes.locals.title).toBe('Anciens BTS SN/CIEL LJV');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should not overwrite res.locals.title if already set', () => {
      mockRes.locals.title = 'Custom Title';
      authMiddleware(mockReq, mockRes, mockNext);
      expect(mockRes.locals.title).toBe('Custom Title');
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireAuth', () => {
    test('should call next() if user is authenticated and approved', () => {
      mockReq.session.user = { id: 1, is_approved: true };
      authMiddleware.requireAuth(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.redirect).not.toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    test('should redirect to login if user is not authenticated', () => {
      authMiddleware.requireAuth(mockReq, mockRes, mockNext);
      expect(mockRes.redirect).toHaveBeenCalledWith('/login?redirect=%2Ftest-url');
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    test('should render pending-approval if user is authenticated but not approved', () => {
      mockReq.session.user = { id: 1, is_approved: false };
      authMiddleware.requireAuth(mockReq, mockRes, mockNext);
      expect(mockRes.render).toHaveBeenCalledWith('pending-approval', {
        title: 'Compte en attente d\'approbation'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    test('should call next() if user is admin', () => {
      mockReq.session.user = { id: 1, is_admin: true };
      authMiddleware.requireAdmin(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.render).not.toHaveBeenCalled();
    });

    test('should return 403 and render error if user is not admin', () => {
      mockReq.session.user = { id: 1, is_admin: false };
      authMiddleware.requireAdmin(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        message: 'Accès refusé - Droits administrateur requis',
        error: {},
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should return 403 and render error if no user in session', () => {
      authMiddleware.requireAdmin(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.render).toHaveBeenCalledWith('error', {
        message: 'Accès refusé - Droits administrateur requis',
        error: {},
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('redirectIfLoggedIn', () => {
    test('should redirect to dashboard if user is logged in and approved', () => {
      mockReq.session.user = { id: 1, is_approved: true };
      authMiddleware.redirectIfLoggedIn(mockReq, mockRes, mockNext);
      expect(mockRes.redirect).toHaveBeenCalledWith('/dashboard');
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next() if user is not logged in', () => {
      authMiddleware.redirectIfLoggedIn(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });

    test('should call next() if user is logged in but not approved', () => {
      mockReq.session.user = { id: 1, is_approved: false };
      authMiddleware.redirectIfLoggedIn(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRes.redirect).not.toHaveBeenCalled();
    });
  });
});
