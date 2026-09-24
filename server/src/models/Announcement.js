const mongoose = require('mongoose');

/**
 * Admin-authored announcement / tip template.
 * When published it is broadcast to every active student as a notification.
 */
const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 1200 },
    kind: { type: String, enum: ['announcement', 'tip'], default: 'announcement' },
    audience: { type: String, enum: ['all', 'new_users', 'admins'], default: 'all' },
    severity: { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
    link: { type: String, default: '' },
    isPublished: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stats: {
      recipients: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

announcementSchema.index({ isPublished: 1, publishedAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
