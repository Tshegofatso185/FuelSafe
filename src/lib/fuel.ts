export type FuelType = "petrol_93" | "petrol_95" | "diesel_500ppm" | "diesel_50ppm";
export type PricingRegion = "inland" | "coastal";

export type FuelProfile = {
  id: string;
  make: string;
  model: string;
  year: number;
  fuelType: FuelType;
  tankCapacityLitres: number;
  tankCapacityVerified: boolean;
  fuelPercent: number;
  consumptionLPer100Km: number;
  region: PricingRegion;
  locationLabel: string;
  updatedAt: string | null;
  saved: boolean;
};

export type PricePayload = {
  effectiveDate: string;
  publishedLabel: string;
  sourceName: string;
  sourceUrl: string;
  pricePerLitre: Record<PricingRegion, Partial<Record<FuelType, number>>>;
  isLive: boolean;
  notes: {
    petrol: string;
    diesel: string;
    freshness: string;
  };
};

export const FUEL_OPTIONS: { value: FuelType; label: string; shortLabel: string; hint: string }[] = [
  {
    value: "petrol_93",
    label: "Petrol 93 ULP",
    shortLabel: "93 ULP",
    hint: "Common inland (Gauteng, Free State, Limpopo, Mpumalanga, North West).",
  },
  {
    value: "petrol_95",
    label: "Petrol 95 ULP",
    shortLabel: "95 ULP",
    hint: "Required by most modern petrol engines. Standard at the coast.",
  },
  {
    value: "diesel_500ppm",
    label: "Diesel 500 ppm · 0.05% sulphur",
    shortLabel: "500 ppm",
    hint: "Widely available standard diesel for older engines.",
  },
  {
    value: "diesel_50ppm",
    label: "Diesel 50 ppm · 0.005% sulphur",
    shortLabel: "50 ppm",
    hint: "Low-sulphur diesel required by most modern diesel engines.",
  },
];

export const DEFAULT_PROFILE: FuelProfile = {
  id: "default",
  make: "Toyota",
  model: "Corolla Quest",
  year: 2022,
  fuelType: "petrol_95",
  tankCapacityLitres: 50,
  tankCapacityVerified: false,
  fuelPercent: 38,
  consumptionLPer100Km: 7.2,
  region: "inland",
  locationLabel: "Johannesburg, Gauteng",
  updatedAt: null,
  saved: false,
};

export function numberFormat(value: number, digits = 0) {
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function moneyFormat(value: number, digits = 0) {
  return `R ${numberFormat(value, digits)}`;
}

export function getFuelOption(value: FuelType) {
  return FUEL_OPTIONS.find((option) => option.value === value) ?? FUEL_OPTIONS[1];
}

export type FuelMetrics = {
  fuelLitres: number;
  rangeKm: number;
  rangeLow: number;
  rangeHigh: number;
  confidence: number;
  safeStopKm: number;
  refillLitres: number;
  pricePerLitre: number | null;
  refillCost: number | null;
};

export function computeFuelMetrics(profile: FuelProfile, pricePerLitre: number | null): FuelMetrics {
  const tank = Math.max(0, profile.tankCapacityLitres);
  const fuelPercent = Math.min(100, Math.max(0, profile.fuelPercent));
  const fuelLitres = (tank * fuelPercent) / 100;
  const consumption = Math.max(0.1, profile.consumptionLPer100Km);
  const rangeKm = (fuelLitres / consumption) * 100;
  // Low fuel readings are less accurate, so the uncertainty band widens near empty.
  const confidence = fuelPercent < 15 ? 0.18 : fuelPercent < 35 ? 0.15 : 0.12;

  return {
    fuelLitres,
    rangeKm,
    rangeLow: Math.max(0, rangeKm * (1 - confidence)),
    rangeHigh: rangeKm * (1 + confidence),
    confidence,
    safeStopKm: rangeKm * 0.76,
    refillLitres: Math.max(0, tank - fuelLitres),
    pricePerLitre,
    refillCost: pricePerLitre === null ? null : Math.max(0, tank - fuelLitres) * pricePerLitre,
  };
}

export function resolvePriceForProfile(prices: PricePayload | null, profile: FuelProfile): number | null {
  const listed = prices?.pricePerLitre[profile.region]?.[profile.fuelType];
  return typeof listed === "number" ? listed : null;
}
