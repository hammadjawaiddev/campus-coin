/**
 * Deterministic demo-data generator.
 *
 * Produces ~8 months of realistic student transactions (allowance, part-time
 * shifts, a scholarship disbursement, canteen food, transport, hostel rent,
 * subscriptions, outings...), budgets, a savings goal, insights and tips.
 *
 * Values are generated with a seeded PRNG so a demo run is reproducible and the
 * dashboard always looks convincing without hardcoding data in the front end.
 */
const { DEFAULT_CATEGORIES } = require('../config/constants');

/** Merchant names that are genuinely recurring subscriptions. */
const SUBSCRIPTION_RE = /Netflix|Spotify|iCloud|Notion|Adobe/i;

/** Mulberry32 — tiny deterministic PRNG. */
function makeRandom(seed = 20260214) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const between = (rand, min, max) => min + rand() * (max - min);
const money = (rand, min, max) => Math.round(between(rand, min, max) * 100) / 100;

/** Student-flavoured descriptions per category, with a rough price band. */
const EXPENSE_PLAYBOOK = {
  Food: {
    merchants: [
      ['Campus cafeteria lunch', 3, 7], ['Campus cafe burger', 5, 9], ['Samosa + chai with friends', 1.5, 4],
      ['Hostel mess dinner', 3, 6], ['Food delivery order', 8, 16], ['Late night pizza slice', 3, 6],
      ['Grocery run for the room', 12, 28], ['Coffee before lecture', 2, 5], ['Shawarma after class', 4, 8],
      ['Birthday treat for roommate', 8, 15],
    ],
    frequency: 22,
  },
  Transport: {
    merchants: [
      ['Metro card top-up', 5, 14], ['Rickshaw to campus', 2, 5], ['Bus fare home', 3, 8],
      ['Ride share to study group', 6, 13], ['Bike fuel', 6, 12], ['Parking at exam centre', 1, 3],
      ['Late night taxi back to hostel', 7, 14],
    ],
    frequency: 12,
  },
  'Hostel/Rent': {
    merchants: [
      ['Hostel monthly rent share', 90, 130], ['Electricity bill split', 12, 24],
      ['Internet / wifi share', 8, 15], ['Water can for the room', 2, 5],
    ],
    frequency: 3,
  },
  Academics: {
    merchants: [
      ['Course textbook (used)', 25, 60], ['Photocopy of past papers', 3, 8],
      ['Stationery and notebooks', 6, 16], ['Lab manual printing', 4, 10],
      ['Online course subscription', 12, 30], ['Semester exam fee share', 20, 45],
    ],
    frequency: 4,
  },
  Subscriptions: {
    merchants: [
      ['Netflix monthly payment', 9, 16], ['Spotify student plan', 3, 6],
      ['iCloud storage renewal', 1, 3], ['Notion student plan', 4, 9],
      ['Adobe student licence', 10, 20],
    ],
    frequency: 3,
  },
  Entertainment: {
    merchants: [
      ['Cinema ticket with friends', 6, 13], ['Arcade night out', 8, 18],
      ['Concert ticket share', 15, 40], ['Weekend trip share', 25, 55],
      ['Bowling with classmates', 7, 15], ['Game top-up', 5, 20],
    ],
    frequency: 5,
  },
  Miscellaneous: {
    merchants: [
      ['Haircut', 5, 12], ['Medicine from pharmacy', 4, 15],
      ['New shirt', 15, 35], ['Phone screen repair', 20, 45],
      ['Donation at campus drive', 2, 10], ['Laundry service', 4, 9],
    ],
    frequency: 5,
  },
};

const INCOME_PLAYBOOK = {
  Allowance: [
    ['Monthly allowance from home', 300, 420],
    ['Top-up allowance from Dad', 40, 90],
  ],
  'Part-time Job': [
    ['Campus library shift', 45, 90],
    ['Weekend tutoring session', 25, 60],
    ['Freelance design gig', 50, 140],
  ],
  Scholarship: [['Merit scholarship disbursement', 250, 500]],
  Gift: [['Birthday gift from uncle', 20, 60], ['Festival gift from family', 25, 80]],
  'Other Income': [['Sold old textbooks', 12, 35], ['Cashback reward', 3, 12]],
};

/**
 * Spend profile per month so the demo tells a story: the current month shows a
 * genuine (but believable) rise in food and transport spending, which the tips
 * engine then picks up, while the rest of the history stays at baseline.
 */
const MONTH_PROFILE = (monthsAgo) => {
  if (monthsAgo === 0) return { foodMultiplier: 1.28, entertainmentMultiplier: 1.0, transportMultiplier: 1.2, label: 'current' };
  if (monthsAgo === 1) return { foodMultiplier: 1.02, entertainmentMultiplier: 1.18, transportMultiplier: 1.0, label: 'previous' };
  return { foodMultiplier: 1, entertainmentMultiplier: 1, transportMultiplier: 1, label: 'baseline' };
};

const CATEGORY_MULTIPLIER = (categoryName, profile) => {
  if (categoryName === 'Food') return profile.foodMultiplier;
  if (categoryName === 'Entertainment') return profile.entertainmentMultiplier;
  if (categoryName === 'Transport') return profile.transportMultiplier;
  return 1;
};

/**
 * @param {object} opts
 * @param {Date} opts.now                 reference date
 * @param {number} opts.months            how many months of history to create
 * @param {Map<string,string>} opts.categoryIdByName  category name → id (expense + income)
 * @returns {{transactions: object[], incomeTotal: number, expenseTotal: number}}
 */
function generateTransactions({ now = new Date(), months = 8, categoryIdByName }) {
  const rand = makeRandom(987654321);
  const transactions = [];
  const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  for (let monthsAgo = months - 1; monthsAgo >= 0; monthsAgo -= 1) {
    const monthStart = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - monthsAgo, 1));
    const isCurrentMonth = monthsAgo === 0;
    const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    const maxDay = isCurrentMonth ? today.getUTCDate() : daysInMonth;
    const profile = MONTH_PROFILE(monthsAgo);
    const progress = isCurrentMonth ? maxDay / daysInMonth : 1;

    // ── Income ────────────────────────────────────────────────────────────
    Object.entries(INCOME_PLAYBOOK).forEach(([categoryName, entries]) => {
      const categoryId = categoryIdByName.get(categoryName);
      if (!categoryId) return;

      if (categoryName === 'Allowance') {
        // Allowance always lands on day 1-3; mid-month top-ups happen sometimes.
        const [label, min, max] = entries[0];
        transactions.push({
          category: categoryId,
          type: 'income',
          amount: money(rand, min, max),
          description: label,
          date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1 + Math.floor(rand() * 2), 9, 15)),
          recurring: true,
          recurringFrequency: 'monthly',
          recurringStatus: 'active',
          source: 'seed',
        });
        if (rand() > 0.45 && (!isCurrentMonth || maxDay > 15)) {
          transactions.push({
            category: categoryId,
            type: 'income',
            amount: money(rand, entries[1][1], entries[1][2]),
            description: entries[1][0],
            date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 14 + Math.floor(rand() * 6), 18, 40)),
            source: 'seed',
          });
        }
        return;
      }

      if (categoryName === 'Part-time Job') {
        const shifts = isCurrentMonth ? Math.max(1, Math.round(3 * progress + 0.5)) : 3 + Math.floor(rand() * 2);
        for (let i = 0; i < shifts; i += 1) {
          const [label, min, max] = pick(rand, entries);
          const day = Math.min(maxDay, 4 + i * 7 + Math.floor(rand() * 3));
          transactions.push({
            category: categoryId,
            type: 'income',
            amount: money(rand, min, max),
            description: label,
            date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), Math.max(1, day), 17, 30)),
            source: 'seed',
          });
        }
        return;
      }

      if (categoryName === 'Scholarship') {
        // Disbursed twice per semester — months 7-ago and 3-ago.
        if (monthsAgo === months - 1 || monthsAgo === 3) {
          transactions.push({
            category: categoryId,
            type: 'income',
            amount: money(rand, entries[0][1], entries[0][2]),
            description: entries[0][0],
            date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 5, 11, 0)),
            source: 'seed',
          });
        }
        return;
      }

      if (rand() > 0.55) {
        const [label, min, max] = pick(rand, entries);
        transactions.push({
          category: categoryId,
          type: 'income',
          amount: money(rand, min, max),
          description: label,
          date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 6 + Math.floor(rand() * Math.max(1, maxDay - 6)), 12, 0)),
          source: 'seed',
        });
      }
    });

    // ── Expenses ──────────────────────────────────────────────────────────
    Object.entries(EXPENSE_PLAYBOOK).forEach(([categoryName, config]) => {
      const categoryId = categoryIdByName.get(categoryName);
      if (!categoryId) return;

      let count;
      if (categoryName === 'Hostel/Rent') {
        count = 0; // handled as fixed monthly bills below
      } else {
        const base = config.frequency * CATEGORY_MULTIPLIER(categoryName, profile);
        count = Math.max(1, Math.round(base * progress * between(rand, 0.85, 1.15)));
      }

      for (let i = 0; i < count; i += 1) {
        const [description, min, max] = pick(rand, config.merchants);
        const day = Math.max(1, Math.min(maxDay, Math.round(between(rand, 1, maxDay))));
        const multiplier = CATEGORY_MULTIPLIER(categoryName, profile);
        transactions.push({
          category: categoryId,
          type: 'expense',
          amount: money(rand, min * multiplier, max * multiplier),
          description,
          date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day, 8 + Math.floor(rand() * 13), Math.floor(rand() * 60))),
          // Only true subscriptions become recurring templates: a one-off
          // "Online course subscription" purchase must stay a normal expense.
          recurring: SUBSCRIPTION_RE.test(description),
          recurringFrequency: SUBSCRIPTION_RE.test(description) ? 'monthly' : null,
          recurringStatus: SUBSCRIPTION_RE.test(description) ? 'active' : null,
          source: 'seed',
        });
      }
    });

    // Fixed monthly bills
    const hostelId = categoryIdByName.get('Hostel/Rent');
    if (hostelId && (monthsAgo !== 0 || maxDay >= 3)) {
      const rent = pick(rand, EXPENSE_PLAYBOOK['Hostel/Rent'].merchants);
      transactions.push({
        category: hostelId, type: 'expense', amount: money(rand, rent[1], rent[2]), description: rent[0],
        date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 3, 10, 0)),
        recurring: true, recurringFrequency: 'monthly', recurringStatus: 'active', source: 'seed',
      });
      if (monthsAgo !== 0 || maxDay >= 8) {
        transactions.push({
          category: hostelId, type: 'expense', amount: money(rand, 8, 15), description: 'Internet / wifi share',
          date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 8, 19, 0)),
          recurring: true, recurringFrequency: 'monthly', recurringStatus: 'active', source: 'seed',
        });
      }
      if (monthsAgo !== 0 || maxDay >= 12) {
        transactions.push({
          category: hostelId, type: 'expense', amount: money(rand, 12, 24), description: 'Electricity bill split',
          date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 12, 20, 30)), source: 'seed',
        });
      }
    }

    // One deliberate anomaly: an unusually large purchase 2 months ago so the
    // smart-detection feature has something real to flag. It is stored with the
    // same metadata the live detector would have written on entry.
    const miscId = categoryIdByName.get('Miscellaneous');
    if (miscId && monthsAgo === 2) {
      transactions.push({
        category: miscId, type: 'expense', amount: 210.0, description: 'Replaced broken laptop charger + SSD upgrade',
        date: new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 17, 16, 0)),
        source: 'seed', notes: 'One-off, not part of the usual month',
        isAnomaly: true, anomalyScore: 0.82,
        anomalyReason: 'This transaction is 3.4x higher than your usual spend in this category (average 61.50).',
      });
    }
  }

  // Most recent transactions get realistic local timestamps for "today".
  const incomeTotal = Math.round(transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0) * 100) / 100;
  const expenseTotal = Math.round(transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0) * 100) / 100;

  // Give every recurring template a real next occurrence so the "Recurring"
  // screen and the on-demand sweep (recurringService.runForUser) work from seed.
  const sweepNow = new Date();
  const { nextOccurrenceFrom } = require('../utils/date');
  transactions.forEach((t) => {
    if (!t.recurring || !t.recurringFrequency) return;
    let next = nextOccurrenceFrom(t.date, t.recurringFrequency);
    let guard = 0;
    while (next <= sweepNow && guard < 60) {
      next = nextOccurrenceFrom(next, t.recurringFrequency);
      guard += 1;
    }
    t.nextOccurrence = next;
  });

  return {
    transactions: transactions.sort((a, b) => b.date - a.date),
    incomeTotal,
    expenseTotal,
  };
}

/** Budget plan for a given month, scaled slightly by month for realism. */
function generateBudgets({ month, currencyScale = 1, categoryIdByName, templateBudgets }) {
  return templateBudgets
    .map(({ name, limit }) => {
      const categoryId = categoryIdByName.get(name);
      if (!categoryId) return null;
      return { category: categoryId, limitAmount: Math.round(limit * currencyScale), name };
    })
    .filter(Boolean)
    .map((b) => ({ ...b, month }));
}

/** CSV text used by the "try the importer" flow on the import page. */
function sampleCsv(currency = '$') {
  const rows = [
    ['date', 'description', 'amount', 'type', 'category'],
    ['2026-08-02', 'Campus cafe burger', '7.50', 'expense', 'Food'],
    ['2026-08-03', 'Metro card top-up', '10.00', 'expense', 'Transport'],
    ['2026-08-05', 'Netflix monthly payment', '12.99', 'expense', 'Subscriptions'],
    ['2026-08-07', 'Photocopy of past papers', '4.20', 'expense', 'Academics'],
    ['2026-08-09', 'Monthly allowance from home', '350.00', 'income', 'Allowance'],
    ['2026-08-11', 'Cinema ticket with friends', '11.00', 'expense', 'Entertainment'],
    ['2026-08-14', 'Hostel electricity share', '18.40', 'expense', 'Hostel/Rent'],
    ['2026-08-16', 'Weekend tutoring session', '40.00', 'income', 'Part-time Job'],
    ['', 'Missing date row (should be skipped)', '5.00', 'expense', 'Food'],
    ['2026-08-19', 'Pharmacy medicine', '6.75', 'expense', 'Miscellaneous'],
  ];
  return `${rows.map((r) => r.join(',')).join('\n')}\n`;
}

const SAMPLE_CATEGORY_NAMES = DEFAULT_CATEGORIES.map((c) => c.name);

module.exports = {
  makeRandom,
  generateTransactions,
  generateBudgets,
  sampleCsv,
  EXPENSE_PLAYBOOK,
  INCOME_PLAYBOOK,
  SAMPLE_CATEGORY_NAMES,
};
