import { moneyFormat, numberFormat, type FuelMetrics, type FuelProfile } from "@/lib/fuel";

export type SpendPlan = {
  /** What the driver can spend right now, in rand. */
  spend: number;
  /** Litres that money buys at the reference price. */
  litres: number;
  /** Litres actually added once the tank is full. */
  litresAdded: number;
  /** True when the money buys a full tank with change left over. */
  fillsTank: boolean;
  /** Estimated kilometres this purchase adds. */
  km: number;
  /** Remaining money if the tank filled before the budget ran out. */
  change: number;
  /** Fuel in the tank after topping up, in litres. */
  tankAfter: number;
  /** Percentage of the tank this represents. */
  percentAfter: number;
  /** Even daily amount if the driver spreads this spend over a week. */
  perDay: number;
};

export function planFuelSpend(
  profile: FuelProfile,
  metrics: FuelMetrics,
  spend: number,
): SpendPlan | null {
  const price = metrics.pricePerLitre;
  if (!price || price <= 0 || !Number.isFinite(spend) || spend < 0) return null;

  const litres = spend / price;
  const litresAdded = Math.min(litres, metrics.refillLitres);
  const fillsTank = litres >= metrics.refillLitres;
  const consumption = Math.max(0.1, profile.consumptionLPer100Km);
  const tankAfter = metrics.fuelLitres + litresAdded;

  return {
    spend,
    litres,
    litresAdded: Math.max(0, litresAdded),
    fillsTank,
    km: (Math.max(0, litresAdded) / consumption) * 100,
    change: fillsTank ? spend - metrics.refillLitres * price : 0,
    tankAfter,
    percentAfter: profile.tankCapacityLitres > 0
      ? Math.min(100, (tankAfter / profile.tankCapacityLitres) * 100)
      : 0,
    perDay: spend / 7,
  };
}

/** A plain-language summary of a spend plan, used on screen and for speech. */
export function describeSpendPlan(plan: SpendPlan, profile: FuelProfile): string {
  if (plan.litresAdded <= 0) {
    return "The tank is already full, so nothing needs buying today.";
  }
  const totalRange = (plan.tankAfter / Math.max(0.1, profile.consumptionLPer100Km)) * 100;
  const total = numberFormat(totalRange);
  const changeNote = plan.fillsTank && plan.change >= 1
    ? ` That fills the tank and leaves about ${moneyFormat(plan.change, 0)}.`
    : "";
  return `${moneyFormat(plan.spend, 0)} buys about ${numberFormat(plan.litres, 1)} litres, roughly ${numberFormat(plan.km)} kilometres of driving, and puts the tank at ${total} kilometres of total range.${changeNote}`;
}

/** Suggested amounts, kept small because the audience budgets week to week. */
export const SPEND_PRESETS = [20, 50, 100, 150, 200, 300, 500, 1000, 1500, 2000];
