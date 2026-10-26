import { moneyFormat, numberFormat, type FuelMetrics, type FuelProfile } from "@/lib/fuel";

export type FuelStatusLevel = "critical" | "low" | "moderate" | "good";
export type RecommendationTone = "urgent" | "warning" | "info" | "positive";

export type Recommendation = {
  id: string;
  tone: RecommendationTone;
  title: string;
  detail: string;
};

export type BudgetOption = { amount: number; litres: number; km: number; label: string };

export type FuelAdvice = {
  level: FuelStatusLevel;
  headline: string;
  summary: string;
  budgets: BudgetOption[];
  recommendations: Recommendation[];
};

export type ReadingContext = {
  source: "obd" | "manual" | "demo" | null;
  takenAt: string | null;
};

/** South African fuel prices change on the first Wednesday of each month. */
export function nextPriceAdjustment(from = new Date()): Date {
  const firstWednesday = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    while (date.getDay() !== 3) date.setDate(date.getDate() + 1);
    return date;
  };
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const thisMonth = firstWednesday(from.getFullYear(), from.getMonth());
  return thisMonth >= today ? thisMonth : firstWednesday(from.getFullYear(), from.getMonth() + 1);
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? (Date.now() - time) / 3_600_000 : null;
}

export function buildFuelAdvice(profile: FuelProfile, metrics: FuelMetrics, reading: ReadingContext): FuelAdvice {
  const percent = Math.min(100, Math.max(0, profile.fuelPercent));
  const isDiesel = profile.fuelType.startsWith("diesel");
  const low = numberFormat(metrics.rangeLow);
  const high = numberFormat(metrics.rangeHigh);

  let level: FuelStatusLevel;
  let headline: string;
  let summary: string;
  if (percent <= 10 || metrics.rangeLow < 40) {
    level = "critical";
    headline = "Refuel now";
    summary = `Only about ${low}–${high} km left. Go straight to the nearest station and avoid starting any longer trip.`;
  } else if (percent <= 25 || metrics.rangeLow < 100) {
    level = "low";
    headline = "Plan to fill up today";
    summary = `About ${low}–${high} km left. Enough for short trips, but fill up before heading out of town.`;
  } else if (percent <= 50) {
    level = "moderate";
    headline = "Fine for everyday driving";
    summary = `About ${low}–${high} km left. Top up before any trip longer than ${numberFormat(metrics.safeStopKm)} km.`;
  } else {
    level = "good";
    headline = "You're well covered";
    summary = `About ${low}–${high} km left. No need to refuel soon.`;
  }

  const recommendations: Recommendation[] = [];

  // Freshness of the number everything else is based on.
  const age = hoursSince(reading.takenAt);
  if (reading.source === "demo") {
    recommendations.push({
      id: "demo-reading",
      tone: "warning",
      title: "Demo reading, not your car",
      detail: "This value is simulated. Enter your dashboard gauge level or connect a compatible adapter for advice about your car.",
    });
  } else if (reading.source === null) {
    recommendations.push({
      id: "no-reading",
      tone: "warning",
      title: "Get a fresh fuel reading",
      detail: "Your fuel level comes from setup. Connect your car or update it from your gauge so these suggestions match reality.",
    });
  } else if (age !== null && age > 6) {
    recommendations.push({
      id: "stale",
      tone: "warning",
      title: "Your reading is getting old",
      detail: `Last reading was ${age > 48 ? `${Math.round(age / 24)} days` : `${Math.round(age)} hours`} ago. If you've driven since, read your fuel again.`,
    });
  }

  if (level === "critical" || level === "low") {
    recommendations.push({
      id: "safe-distance",
      tone: level === "critical" ? "urgent" : "warning",
      title: `Stop within ${numberFormat(Math.max(1, metrics.safeStopKm))} km`,
      detail: "That keeps a safety buffer below the low end of your estimated range, in case of traffic, hills or a closed station.",
    });
    if (isDiesel) {
      recommendations.push({
        id: "diesel-dry",
        tone: "urgent",
        title: "Don't let a diesel run dry",
        detail: "Running a diesel empty can draw air into the fuel system, and some engines then need bleeding before they restart.",
      });
    }
  } else {
    recommendations.push({
      id: "trip-limit",
      tone: "positive",
      title: `Trips up to ${numberFormat(metrics.safeStopKm)} km without stopping`,
      detail: "That's your estimated range minus a safety buffer. Fill up first for anything longer.",
    });
  }

  // Price timing.
  const adjustment = nextPriceAdjustment();
  const daysToAdjustment = Math.ceil((adjustment.getTime() - Date.now()) / 86_400_000);
  if (daysToAdjustment >= 0 && daysToAdjustment <= 7) {
    recommendations.push({
      id: "price-change",
      tone: "info",
      title: `Fuel prices change on ${adjustment.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}`,
      detail:
        "The Department of Mineral Resources and Energy announces the change a few days before. If it's an increase, filling up beforehand saves money; if it's a decrease, waiting helps.",
    });
  }

  // Efficiency, quantified for this car.
  if (profile.consumptionLPer100Km > 3) {
    const betterRange = (metrics.fuelLitres / (profile.consumptionLPer100Km - 1)) * 100;
    const extraKm = betterRange - metrics.rangeKm;
    if (extraKm >= 5) {
      recommendations.push({
        id: "efficiency",
        tone: "info",
        title: `Drive 1 L/100 km more efficiently: +${numberFormat(extraKm)} km`,
        detail:
          "Smooth acceleration, steady speeds (around 100–110 km/h on the highway) and correctly inflated tyres usually lower consumption.",
      });
    }
  }

  if (!profile.tankCapacityVerified) {
    recommendations.push({
      id: "verify-tank",
      tone: "info",
      title: "Confirm your tank size",
      detail: `We're using ${numberFormat(profile.tankCapacityLitres)} L as an estimate. Check your owner's manual so litres and range are exact.`,
    });
  }

  const budgets: BudgetOption[] = [];
  if (metrics.pricePerLitre && metrics.pricePerLitre > 0) {
    for (const amount of [100, 200, 500]) {
      const litres = Math.min(amount / metrics.pricePerLitre, metrics.refillLitres);
      if (litres <= 0) continue;
      const capped = litres < amount / metrics.pricePerLitre;
      budgets.push({
        amount,
        litres,
        km: (litres / profile.consumptionLPer100Km) * 100,
        label: capped ? "fills the tank" : moneyFormat(amount),
      });
      if (capped) break;
    }
  }

  return { level, headline, summary, budgets, recommendations };
}
