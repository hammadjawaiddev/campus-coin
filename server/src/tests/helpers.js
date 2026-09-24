const request = require('supertest');
const app = require('../app');

/** Supertest agent bound to the real Express app. */
const api = () => request(app);

let counter = 0;
const uniqueEmail = (prefix = 'student') => `${prefix}.${Date.now()}.${++counter}@campuscoin.test`;

/**
 * Registers a student through the public API (so password hashing, default
 * category cloning and onboarding defaults are all exercised) and returns the
 * token plus the created user.
 */
const registerStudent = async (overrides = {}) => {
  const payload = {
    name: 'Test Student',
    email: uniqueEmail(),
    password: 'CampusCoin123',
    academicYear: '3rd Year',
    university: 'Test University',
    monthlyAllowance: 400,
    savingsGoal: 800,
    currency: 'USD',
    ...overrides,
  };
  const response = await api().post('/api/auth/register').send(payload).expect(201);
  return { ...response.body.data, password: payload.password, email: payload.email };
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Registers an admin directly in the database (role escalation is not public). */
const registerAdmin = async (overrides = {}) => {
  const User = require('../models/User');
  const { user } = await registerStudent(overrides);
  await User.findByIdAndUpdate(user._id, { role: 'admin' });
  return { ...user, role: 'admin' };
};

/** Picks one of the cloned default categories for a fresh account. */
const pickCategory = async (token, { type = 'expense', name } = {}) => {
  const response = await api().get('/api/categories').set(auth(token)).expect(200);
  const list = response.body.data.categories;
  const found = name
    ? list.find((category) => category.name.toLowerCase() === name.toLowerCase())
    : list.find((category) => category.type === type);
  if (!found) throw new Error(`No ${type} category available for the test account`);
  return found;
};

const createTransaction = async (token, overrides = {}) => {
  const category = overrides.categoryId
    ? { id: overrides.categoryId }
    : await pickCategory(token, { type: overrides.type || 'expense' });
  const { categoryId, ...rest } = overrides;

  const payload = {
    type: 'expense',
    amount: 12.5,
    description: 'Test purchase',
    date: new Date().toISOString(),
    categoryId: category.id || category._id,
    ...rest,
  };
  const response = await api().post('/api/transactions').set(auth(token)).send(payload).expect(201);
  const data = response.body.data;
  return data.transaction || data;
};

module.exports = { api, auth, registerStudent, registerAdmin, pickCategory, createTransaction, uniqueEmail };
