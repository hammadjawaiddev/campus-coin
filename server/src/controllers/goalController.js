const SavingsGoal = require('../models/SavingsGoal');
const notificationService = require('../services/notificationService');
const activityService = require('../services/activityService');
const analytics = require('../services/analyticsService');
const { currencySymbol } = require('../services/transactionService');
const { ok, created } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { round2, percentOf } = require('../utils/number');

const MILESTONES = [25, 50, 75, 100];

const serialise = (goal, monthlyPace = 0) => {
  const progress = Math.min(100, percentOf(goal.currentAmount, goal.targetAmount));
  const remaining = round2(Math.max(0, goal.targetAmount - goal.currentAmount));
  const monthsLeft = goal.targetDate ? Math.max(0, Math.round((new Date(goal.targetDate) - Date.now()) / (30 * 86400000))) : null;
  const requiredMonthly = monthsLeft ? round2(remaining / Math.max(1, monthsLeft)) : null;
  return {
    id: goal._id,
    name: goal.name,
    targetAmount: round2(goal.targetAmount),
    currentAmount: round2(goal.currentAmount),
    remaining,
    progress,
    targetDate: goal.targetDate,
    color: goal.color,
    icon: goal.icon,
    note: goal.note,
    isPrimary: goal.isPrimary,
    status: goal.status,
    monthsLeft,
    requiredMonthly,
    monthlyPace: round2(monthlyPace),
    onTrack: requiredMonthly === null ? null : monthlyPace >= requiredMonthly,
    projectedCompletion: monthlyPace > 0 ? round2(monthsLeft ? remaining / monthlyPace : null) : null,
    milestones: goal.milestones,
    completedAt: goal.completedAt,
    createdAt: goal.createdAt,
    updatedAt: goal.updatedAt,
  };
};

/** GET /api/goals */
const list = asyncHandler(async (req, res) => {
  const [goals, summary] = await Promise.all([
    SavingsGoal.find({ user: req.user._id }).sort({ status: 1, isPrimary: -1, createdAt: 1 }).lean(),
    analytics.summaryWithComparisons(req.user._id, new Date(), currencySymbol(req.user)),
  ]);

  const monthlyPace = summary.current.net > 0 ? summary.current.net : 0;
  const items = goals.map((g) => serialise(g, monthlyPace));
  const active = items.filter((g) => g.status === 'active');

  return ok(
    res,
    {
      goals: items,
      active,
      completed: items.filter((g) => g.status === 'completed'),
      summary: {
        totalTarget: round2(active.reduce((s, g) => s + g.targetAmount, 0)),
        totalSaved: round2(active.reduce((s, g) => s + g.currentAmount, 0)),
        overallProgress: percentOf(active.reduce((s, g) => s + g.currentAmount, 0), active.reduce((s, g) => s + g.targetAmount, 0)),
        monthlyPace,
        currency: currencySymbol(req.user),
        studentSavingsTarget: req.user.savingsGoal,
      },
    },
    'Savings goals loaded',
  );
});

/** POST /api/goals */
const create = asyncHandler(async (req, res) => {
  const { name, targetAmount, currentAmount, targetDate, color, icon, note, isPrimary } = req.body;

  if (isPrimary) await SavingsGoal.updateMany({ user: req.user._id }, { $set: { isPrimary: false } });

  const goal = await SavingsGoal.create({
    user: req.user._id,
    name,
    targetAmount: Number(targetAmount),
    currentAmount: Math.min(Number(currentAmount) || 0, Number(targetAmount)),
    targetDate: targetDate ? new Date(targetDate) : null,
    color: color || '#22C55E',
    icon: icon || 'Target',
    note: note || '',
    isPrimary: Boolean(isPrimary),
  });

  await activityService.logActivity({ user: req.user._id, action: 'create', entity: 'goal', entityId: goal._id, label: goal.name });
  return created(res, { goal: serialise(goal) }, 'Savings goal created');
});

/** PUT /api/goals/:id */
const update = asyncHandler(async (req, res) => {
  const goal = req.owned;
  const { name, targetAmount, targetDate, color, icon, note, isPrimary, status } = req.body;

  if (name) goal.name = name;
  if (targetAmount !== undefined) goal.targetAmount = Number(targetAmount);
  if (targetDate !== undefined) goal.targetDate = targetDate ? new Date(targetDate) : null;
  if (color) goal.color = color;
  if (icon) goal.icon = icon;
  if (note !== undefined) goal.note = note;
  if (status && ['active', 'completed', 'archived'].includes(status)) goal.status = status;
  if (isPrimary) {
    await SavingsGoal.updateMany({ user: req.user._id, _id: { $ne: goal._id } }, { $set: { isPrimary: false } });
    goal.isPrimary = true;
  }

  if (goal.currentAmount >= goal.targetAmount && goal.status === 'active') {
    goal.status = 'completed';
    goal.completedAt = new Date();
  }

  await goal.save();
  await activityService.logActivity({ user: req.user._id, action: 'update', entity: 'goal', entityId: goal._id, label: goal.name });
  return ok(res, { goal: serialise(goal) }, 'Goal updated');
});

/**
 * POST /api/goals/:id/contribute — add (or withdraw with a negative amount)
 * money from the month's free cash flow and fire milestone notifications.
 */
const contribute = asyncHandler(async (req, res) => {
  const goal = req.owned;
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount === 0) throw ApiError.badRequest('Enter an amount to add or withdraw');

  const currency = currencySymbol(req.user);
  const before = goal.currentAmount;
  const next = Math.max(0, round2(before + amount));
  const capped = Math.min(next, goal.targetAmount);

  goal.currentAmount = capped;

  const reached = MILESTONES.filter((m) => percentOf(before, goal.targetAmount) < m && percentOf(capped, goal.targetAmount) >= m);
  reached.forEach((percent) => goal.milestones.push({ percent }));

  if (capped >= goal.targetAmount) {
    goal.status = 'completed';
    goal.completedAt = new Date();
  } else if (goal.status === 'completed') {
    goal.status = 'active';
    goal.completedAt = null;
  }

  await goal.save();

  for (const percent of reached) {
    if (percent === 100) {
      await notificationService.notify({
        user: req.user._id,
        ...notificationService.NOTIFICATION_TEMPLATES.goalCompleted(goal.name),
        dedupeKey: `goal-complete:${goal._id}`,
      });
    } else {
      await notificationService.notify({
        user: req.user._id,
        ...notificationService.NOTIFICATION_TEMPLATES.savingsMilestone(goal.name, percent, capped, currency),
        dedupeKey: `goal-${percent}:${goal._id}`,
      });
    }
  }

  await activityService.logActivity({
    user: req.user._id, action: 'update', entity: 'goal', entityId: goal._id,
    label: `${amount > 0 ? 'Added' : 'Withdrew'} ${currency}${Math.abs(amount)} ${amount > 0 ? 'to' : 'from'} ${goal.name}`,
  });

  const summary = await analytics.summaryWithComparisons(req.user._id, new Date(), currency);
  return ok(
    res,
    { goal: serialise(goal, summary.current.net > 0 ? summary.current.net : 0), milestonesReached: reached },
    reached.length ? `Milestone reached! ${goal.name} is now ${Math.min(100, percentOf(capped, goal.targetAmount))}% funded` : 'Savings updated',
  );
});

/** DELETE /api/goals/:id */
const remove = asyncHandler(async (req, res) => {
  await req.owned.deleteOne();
  await activityService.logActivity({ user: req.user._id, action: 'delete', entity: 'goal', entityId: req.params.id, label: 'Goal deleted' });
  return ok(res, { id: req.params.id }, 'Goal deleted');
});

module.exports = { list, create, update, contribute, remove, serialise };
