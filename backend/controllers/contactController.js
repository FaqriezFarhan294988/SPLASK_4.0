import pool from '../database/db.js';

// POST /api/contact - Submit a contact message (public)
export const submitContactMessage = async (req, res, next) => {
  const { email, subject, message } = req.body;

  if (!email || !subject || !message) {
    return res.status(400).json({ success: false, error: 'Email, subject, and message are required.' });
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }

  if (subject.length > 500) {
    return res.status(400).json({ success: false, error: 'Subject must be 500 characters or fewer.' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.execute(
      'INSERT INTO contact_messages (email, subject, message) VALUES (?, ?, ?)',
      [email, subject, message]
    );

    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};

// GET /api/admin/messages?page=1&limit=10 - Get all messages (admin only)
export const getAdminMessages = async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const connection = await pool.getConnection();
  try {
    const [[{ total }]] = await connection.execute(
      'SELECT COUNT(*) AS total FROM contact_messages'
    );

    const [rows] = await connection.execute(
      'SELECT id, email, subject, message, created_at FROM contact_messages ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [String(limit), String(offset)]
    );

    res.json({
      success: true,
      data: {
        messages: rows,
        total: Number(total),
        page,
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};
