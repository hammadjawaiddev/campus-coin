const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ACADEMIC_YEARS, CURRENCIES } = require('../config/constants');

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false, // never returned unless explicitly requested
    },
    role: { type: String, enum: ['student', 'admin'], default: 'student', index: true },

    // Student profile ------------------------------------------------------
    academicYear: { type: String, enum: [...ACADEMIC_YEARS, null], default: null },
    university: { type: String, trim: true, maxlength: 120, default: '' },
    monthlyAllowance: { type: Number, min: 0, default: 0 },
    savingsGoal: { type: Number, min: 0, default: 0 },
    avatar: {
      color: { type: String, default: '#6D5DFB' },
      url: { type: String, default: '' },
    },

    // Preferences ----------------------------------------------------------
    preferences: {
      currency: { type: String, enum: CURRENCIES.map((c) => c.code), default: 'USD' },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      fontSize: { type: String, enum: ['sm', 'base', 'lg'], default: 'base' },
      reducedMotion: { type: Boolean, default: false },
      emailAlerts: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
    },

    // Onboarding -----------------------------------------------------------
    onboarding: {
      completed: { type: Boolean, default: false },
      completedAt: { type: Date, default: null },
      dismissedChecklist: { type: Boolean, default: false },
    },

    // Engagement -----------------------------------------------------------
    streak: {
      current: { type: Number, default: 0 },
      longest: { type: Number, default: 0 },
      lastLoggedDate: { type: Date, default: null },
    },

    // Account state --------------------------------------------------------
    isActive: { type: Boolean, default: true },
    disabledReason: { type: String, default: '' },
    lastLoginAt: { type: Date, default: null },
    loginCount: { type: Number, default: 0 },

    // Password reset / recovery -------------------------------------------
    resetPasswordToken: { type: String, select: false, default: null },
    resetPasswordExpires: { type: Date, select: false, default: null },
    passwordChangedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.index({ createdAt: -1 });

userSchema.virtual('initials').get(function initials() {
  if (!this.name) return '?';
  return this.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
});

/** Hash the password whenever it changes. Never store plaintext. */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  if (!this.isNew) this.passwordChangedAt = new Date();
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

/** Returns a raw reset token (only the hash is persisted). */
userSchema.methods.createPasswordResetToken = function createPasswordResetToken(ttlMinutes) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.resetPasswordExpires = new Date(Date.now() + ttlMinutes * 60 * 1000);
  return rawToken;
};

userSchema.statics.hashResetToken = (rawToken) =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

/** Public shape used by the client (no secrets). */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    academicYear: this.academicYear,
    university: this.university,
    monthlyAllowance: this.monthlyAllowance,
    savingsGoal: this.savingsGoal,
    avatar: this.avatar,
    preferences: this.preferences,
    onboarding: this.onboarding,
    streak: this.streak,
    isActive: this.isActive,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt,
  };
};

module.exports = mongoose.model('User', userSchema);
