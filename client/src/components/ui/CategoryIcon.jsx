import {
  AlertOctagon, AlertTriangle, Banknote, Bike, BookOpen, Briefcase, Building2, Bus, Car, CheckCircle2, Clapperboard,
  Coffee, Coins, Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, HeartPulse, Home, Info, Laptop, Music, Package,
  PawPrint, PenTool, Phone, PiggyBank, Pill, Plane, Repeat, Shirt, ShoppingBag, Smartphone, Sparkles, Target, Ticket,
  Users, UtensilsCrossed, Wallet, Wifi,
} from 'lucide-react';

/**
 * Categories store their icon as a string (so the API stays presentation-free).
 * Only the curated registry below is bundled — importing the whole icon library
 * just to resolve a name would add ~700 kB to the first paint.
 *
 * The names mirror `CATEGORY_ICON_CHOICES` in the API's config/constants.js.
 */
const REGISTRY = {
  Wallet, Briefcase, GraduationCap, Gift, Coins, Banknote, PiggyBank,
  UtensilsCrossed, Coffee, Bus, Car, Bike, Fuel, Home, Building2,
  BookOpen, PenTool, Repeat, Clapperboard, Gamepad2, ShoppingBag,
  Shirt, HeartPulse, Pill, Phone, Smartphone, Laptop, Wifi,
  Dumbbell, Music, Plane, Ticket, Package, Sparkles, Users, PawPrint,
  // Feedback + UI names that also travel as strings (announcement severities,
  // notification types, budget/goal badges).
  AlertTriangle, AlertOctagon, Info, CheckCircle2, Target,
};

/** Renders a lucide icon by name, falling back to a neutral icon. */
export default function CategoryIcon({ name = 'Package', className = 'h-4 w-4', strokeWidth = 2, ...rest }) {
  const Icon = REGISTRY[name] || REGISTRY.Package;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" {...rest} />;
}

/** Names the icon pickers are allowed to offer. */
export const CATEGORY_ICON_NAMES = Object.keys(REGISTRY);
