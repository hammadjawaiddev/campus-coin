/**
 * Domain constants shared by the API, the seed script and the rule based
 * intelligence services (categorisation + saving tips).
 */

/** Icon names map to lucide-react icons on the client (`components/ui/CategoryIcon`). */
const DEFAULT_CATEGORIES = [
  // Income -----------------------------------------------------------------
  { name: 'Allowance', type: 'income', icon: 'Wallet', color: '#6D5DFB', keywords: ['allowance', 'pocket money', 'parents', 'dad', 'mom', 'home transfer'] },
  { name: 'Part-time Job', type: 'income', icon: 'Briefcase', color: '#14B8A6', keywords: ['part time', 'job', 'internship', 'shift', 'salary', 'freelance', 'gig', 'tutoring'] },
  { name: 'Scholarship', type: 'income', icon: 'GraduationCap', color: '#F59E0B', keywords: ['scholarship', 'grant', 'stipend', 'financial aid'] },
  { name: 'Gift', type: 'income', icon: 'Gift', color: '#EC4899', keywords: ['gift', 'birthday', 'eidi', 'present'] },
  { name: 'Other Income', type: 'income', icon: 'Coins', color: '#64748B', keywords: ['refund', 'cashback', 'interest', 'other income', 'sold'] },

  // Expense ----------------------------------------------------------------
  { name: 'Food', type: 'expense', icon: 'UtensilsCrossed', color: '#F97316', keywords: ['food', 'lunch', 'dinner', 'breakfast', 'cafe', 'canteen', 'cafeteria', 'burger', 'pizza', 'biryani', 'snack', 'coffee', 'tea', 'restaurant', 'zomato', 'foodpanda', 'swiggy', 'ubereats', 'delivery', 'kfc', 'mcdonald', 'starbucks', 'grocery', 'groceries', 'mess', 'juice', 'samosa', 'shawarma'] },
  { name: 'Transport',  type: 'expense', icon: 'Bus', color: '#0EA5E9', keywords: ['bus', 'metro', 'train', 'taxi', 'uber', 'careem', 'rickshaw', 'ricksha', 'fuel', 'petrol', 'diesel', 'cng', 'bike', 'rickshaw fare', 'fare', 'parking', 'toll', 'ride', 'van'] },
  { name: 'Hostel/Rent', type: 'expense', icon: 'Home', color: '#8B5CF6', keywords: ['hostel', 'rent', 'accommodation', 'dorm', 'dormitory', 'pg', 'utilities', 'electricity', 'wifi', 'internet', 'water bill', 'gas bill', 'maintenance', 'room'] },
  { name: 'Academics', type: 'expense', icon: 'BookOpen', color: '#6366F1', keywords: ['book', 'books', 'stationery', 'notebook', 'photocopy', 'print', 'printing', 'tuition', 'fee', 'fees', 'semester', 'lab', 'lab coat', 'course', 'exam', 'udemy', 'coursera', 'thesis', 'project material', 'pen', 'paper'] },
  { name: 'Subscriptions', type: 'expense', icon: 'Repeat', color: '#A855F7', keywords: ['netflix', 'spotify', 'subscription', 'prime', 'youtube premium', 'icloud', 'google one', 'chatgpt', 'canva', 'adobe', 'apple music', 'hotstar', 'disney', 'hbo', 'gym membership', 'hosting', 'domain', 'vpn'] },
  { name: 'Entertainment', type: 'expense', icon: 'Clapperboard', color: '#EC4899', keywords: ['movie', 'cinema', 'concert', 'gaming', 'game', 'steam', 'playstation', 'outing', 'party', 'trip', 'picnic', 'bowling', 'arcade', 'hanging out', 'friends'] },
  { name: 'Miscellaneous', type: 'expense', icon: 'Package', color: '#94A3B8', keywords: ['misc', 'other', 'personal', 'medicine', 'pharmacy', 'doctor', 'haircut', 'clothes', 'shopping', 'donation', 'repair'] },
];

const CATEGORY_ICON_CHOICES = [
  'Wallet', 'Briefcase', 'GraduationCap', 'Gift', 'Coins', 'Banknote', 'PiggyBank',
  'UtensilsCrossed', 'Coffee', 'Bus', 'Car', 'Bike', 'Fuel', 'Home', 'Building2',
  'BookOpen', 'PenTool', 'Repeat', 'Clapperboard', 'Gamepad2', 'ShoppingBag',
  'Shirt', 'HeartPulse', 'Pill', 'Phone', 'Smartphone', 'Laptop', 'Wifi',
  'Dumbbell', 'Music', 'Plane', 'Ticket', 'Package', 'Sparkles', 'Users', 'PawPrint',
];

const CATEGORY_COLOR_CHOICES = [
  '#6D5DFB', '#8B5CF6', '#A855F7', '#EC4899', '#F43F5E', '#F97316', '#F59E0B',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6', '#0EA5E9', '#3B82F6', '#6366F1',
  '#64748B', '#0F172A',
];

const ACADEMIC_YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Postgraduate', 'Other'];

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'PKR', symbol: 'Rs', label: 'Pakistani Rupee' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'AED', symbol: 'AED', label: 'UAE Dirham' },
  { code: 'SAR', symbol: 'SAR', label: 'Saudi Riyal' },
  { code: 'BDT', symbol: '৳', label: 'Bangladeshi Taka' },
];

/** Student-specific guidance used by the tips engine. */
const CATEGORY_PLAYBOOK = {
  Food: {
    insight: 'Food is usually the most flexible line in a student budget.',
    tip: 'Cook 3 dinners at home this week and cap delivery orders at 2 — students typically save 15-25% on food this way.',
    minSpendShare: 0.22,
  },
  Transport: {
    insight: 'Daily commuting adds up quietly.',
    tip: 'Try a weekly campus shuttle pass or share rides with a classmate 3 days a week.',
    minSpendShare: 0.1,
  },
  'Hostel/Rent': {
    insight: 'Rent is fixed — the flexible part is utilities.',
    tip: 'Split internet/utility bills with roommates and switch off standby devices to trim the bill.',
    minSpendShare: 0.25,
  },
  Academics: {
    insight: 'Academic costs spike around exams.',
    tip: 'Buy second-hand textbooks or split a course subscription with a study group.',
    minSpendShare: 0.08,
  },
  Subscriptions: {
    insight: 'Subscriptions renew silently.',
    tip: 'Audit your subscriptions: cancelling just one unused streaming plan frees up money every month.',
    minSpendShare: 0.05,
  },
  Entertainment: {
    insight: 'Fun money needs a limit, not a ban.',
    tip: 'Set a weekly entertainment cap and treat it as cash — once it is gone, plan a free campus activity.',
    minSpendShare: 0.08,
  },
  Miscellaneous: {
    insight: 'Uncategorised spending hides patterns.',
    tip: 'Give the biggest "Miscellaneous" items a real category so next month’s budget is accurate.',
    minSpendShare: 0.12,
  },
};

const NOTIFICATION_TYPES = {
  BUDGET_NEAR: 'budget_near',
  BUDGET_EXCEEDED: 'budget_exceeded',
  SAVINGS_MILESTONE: 'savings_milestone',
  INSIGHT: 'insight',
  IMPORT: 'import',
  LARGE_TRANSACTION: 'large_transaction',
  DUPLICATE_TRANSACTION: 'duplicate_transaction',
  ANNOUNCEMENT: 'announcement',
  WELCOME: 'welcome',
  GOAL: 'goal',
  RECURRING: 'recurring',
};

const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

const EXPORT_DATE_FORMAT = 'YYYY-MM-DD';

module.exports = {
  DEFAULT_CATEGORIES,
  CATEGORY_ICON_CHOICES,
  CATEGORY_COLOR_CHOICES,
  ACADEMIC_YEARS,
  CURRENCIES,
  CATEGORY_PLAYBOOK,
  NOTIFICATION_TYPES,
  RECURRING_FREQUENCIES,
  EXPORT_DATE_FORMAT,
};
