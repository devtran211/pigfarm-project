const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

function createTokenAndRespond(user, res) {
  const payload = { id: user._id };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true', 
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 // chơi được 1 tiếng
  };
  res.cookie('token', token, cookieOptions);

  return token;
}

router.post('/register', [
  body('name').notEmpty().withMessage('Name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password min 8 chars')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;

    // Check duplicate
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const user = new User({ name, email, password });
    await user.save();

    const token = createTokenAndRespond(user, res);
    res.status(201).json({ message: 'User created', user: user.toJSON(), token });
  } catch (err) {
    next(err);
  }
});

router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = createTokenAndRespond(user, res);
    res.json({ message: 'Logged in', user: user.toJSON(), token });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    // authMiddleware attaches req.user
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

module.exports = router;