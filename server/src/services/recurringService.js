const Transaction = require('../models/Transaction');
const notificationService = require('./notificationService');
const { nextOccurrenceFrom, startOfDayUTC } = require('../utils/date');
const { logger } = require('../utils/logger');

/**
 * Materialises recurring templates (monthly allowance, subscriptions, hostel
 * rent) into real transactions once their next occurrence has passed.
 *
 * Runs lazily when a student opens the dashboard/transactions list so the demo
 * works without a scheduler, and is also safe to call from a cron job:
 *   node -e "require('./src/services/recurringService').runForAll()"
 */
async function runForUser(userId, { upTo = new Date(), maxPerTemplate = 12 } = {}) {
  const cutoff = startOfDayUTC(upTo);
  const templates = await Transaction.find({
    user: userId,
    recurring: true,
    recurringStatus: 'active',
    nextOccurrence: { $ne: null, $lte: cutoff },
  });

  const created = [];
  for (const template of templates) {
    let guard = 0;
    let cursor = template.nextOccurrence;
    while (cursor && cursor <= cutoff && guard < maxPerTemplate) {
      const exists = await Transaction.findOne({
        user: userId,
        parentTransaction: template._id,
        date: cursor,
      });
      if (!exists) {
        created.push({
          user: userId,
          category: template.category,
          type: template.type,
          amount: template.amount,
          description: template.description,
          notes: template.notes,
          date: cursor,
          recurring: false,
          parentTransaction: template._id,
          isGenerated: true,
          source: 'recurring',
          userConfirmedCategory: template.category,
        });
      }
      cursor = nextOccurrenceFrom(cursor, template.recurringFrequency || 'monthly');
      guard += 1;
    }
    template.nextOccurrence = cursor;
    await template.save();
  }

  let inserted = [];
  if (created.length) {
    inserted = await Transaction.insertMany(created);
    const total = inserted.reduce((s, t) => (t.type === 'expense' ? s + t.amount : s), 0);
    await notificationService.notify({
      user: userId,
      type: 'recurring',
      title: `${inserted.length} recurring transaction${inserted.length === 1 ? '' : 's'} added`,
      message: `Your recurring entries were recorded automatically (expenses totalling ${total.toFixed(2)}).`,
      severity: 'info',
      link: '/transactions?recurring=true',
      dedupeKey: `recurring:${userId}:${cutoff.toISOString().slice(0, 10)}`,
    });
  }

  return { created: inserted.length, templatesProcessed: templates.length };
}

/** Cron-friendly: sweep every student with active recurring templates. */
async function runForAll(options = {}) {
  const userIds = await Transaction.distinct('user', { recurring: true, recurringStatus: 'active' });
  let total = 0;
  for (const userId of userIds) {
    // eslint-disable-next-line no-await-in-loop
    const result = await runForUser(userId, options);
    total += result.created;
  }
  logger.info(`recurring sweep complete: ${total} transactions created for ${userIds.length} students`);
  return { created: total, users: userIds.length };
}

/** Pause / resume / end a recurring template. */
const setStatus = (userId, id, status) =>
  Transaction.findOneAndUpdate({ _id: id, user: userId, recurring: true }, { $set: { recurringStatus: status } }, { new: true });

/**
 * Scheduled templates only (a template without a frequency would never fire).
 * Missing next occurrences are back-filled from the original date so the UI and
 * the sweep always agree on when the next entry is due.
 */
async function listTemplates(userId) {
  const templates = await Transaction.find({ user: userId, recurring: true, recurringFrequency: { $ne: null } })
    .populate('category', 'name color icon type')
    .lean();

  const now = new Date();
  const backfills = [];

  const rows = templates.map((template) => {
    const frequency = template.recurringFrequency || 'monthly';
    let next = template.nextOccurrence
      ? new Date(template.nextOccurrence)
      : nextOccurrenceFrom(template.date, frequency);
    let guard = 0;
    while (next <= now && guard < 60) {
      next = nextOccurrenceFrom(next, frequency);
      guard += 1;
    }
    if (!template.nextOccurrence) backfills.push({ id: template._id, next });
    return { ...template, recurringStatus: template.recurringStatus || 'active', nextOccurrence: next };
  });

  if (backfills.length) {
    await Promise.all(
      backfills.map(({ id, next }) => Transaction.updateOne({ _id: id }, { $set: { nextOccurrence: next, recurringStatus: 'active' } })),
    );
  }

  return rows.sort((a, b) => new Date(a.nextOccurrence) - new Date(b.nextOccurrence));
}

async function createFromTransaction(user, payload) {
  const date = payload.date ? new Date(payload.date) : new Date();
  const doc = await Transaction.create({
    user: user._id,
    category: payload.category,
    type: payload.type,
    amount: payload.amount,
    description: payload.description || 'Recurring entry',
    notes: payload.notes || '',
    date,
    recurring: true,
    recurringFrequency: payload.recurringFrequency || 'monthly',
    recurringStatus: 'active',
    nextOccurrence: nextOccurrenceFrom(date, payload.recurringFrequency || 'monthly'),
    source: 'manual',
    userConfirmedCategory: payload.category,
  });
  return doc.populate('category', 'name color icon type');
}

module.exports = { runForUser, runForAll, setStatus, listTemplates, createFromTransaction };
