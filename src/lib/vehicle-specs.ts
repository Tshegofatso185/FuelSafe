import type { FuelType } from "@/lib/fuel";

export type VehicleSpec = {
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  tankCapacityLitres: number;
  consumptionLPer100Km: number;
  suggestedFuelType: FuelType;
  bodyStyle: string;
};

// Typical published figures for the South African market. Tank sizes are
// manufacturer-quoted for the model range, so they are always surfaced as
// "estimated" until the driver confirms them from the owner's manual.
export const VEHICLE_SPECS: VehicleSpec[] = [
  { make: "Toyota", model: "Corolla Quest 1.8", yearFrom: 2014, yearTo: 2026, tankCapacityLitres: 50, consumptionLPer100Km: 7.4, suggestedFuelType: "petrol_95", bodyStyle: "Sedan" },
  { make: "Toyota", model: "Corolla 1.8 Hybrid", yearFrom: 2019, yearTo: 2026, tankCapacityLitres: 43, consumptionLPer100Km: 4.6, suggestedFuelType: "petrol_95", bodyStyle: "Sedan" },
  { make: "Toyota", model: "Hilux 2.4 GD-6", yearFrom: 2016, yearTo: 2026, tankCapacityLitres: 80, consumptionLPer100Km: 8.5, suggestedFuelType: "diesel_50ppm", bodyStyle: "Double cab" },
  { make: "Toyota", model: "Hilux 2.8 GD-6", yearFrom: 2016, yearTo: 2026, tankCapacityLitres: 80, consumptionLPer100Km: 9.4, suggestedFuelType: "diesel_50ppm", bodyStyle: "Double cab" },
  { make: "Toyota", model: "Fortuner 2.8 GD-6", yearFrom: 2016, yearTo: 2026, tankCapacityLitres: 80, consumptionLPer100Km: 9.0, suggestedFuelType: "diesel_50ppm", bodyStyle: "SUV" },
  { make: "Toyota", model: "RAV4 2.0", yearFrom: 2013, yearTo: 2026, tankCapacityLitres: 55, consumptionLPer100Km: 7.0, suggestedFuelType: "petrol_95", bodyStyle: "SUV" },
  { make: "Toyota", model: "Starlet 1.5", yearFrom: 2020, yearTo: 2026, tankCapacityLitres: 37, consumptionLPer100Km: 5.8, suggestedFuelType: "petrol_95", bodyStyle: "Hatch" },
  { make: "Toyota", model: "Urban Cruiser 1.5", yearFrom: 2020, yearTo: 2026, tankCapacityLitres: 48, consumptionLPer100Km: 6.4, suggestedFuelType: "petrol_95", bodyStyle: "SUV" },
  { make: "Toyota", model: "Etios 1.5", yearFrom: 2013, yearTo: 2021, tankCapacityLitres: 45, consumptionLPer100Km: 6.5, suggestedFuelType: "petrol_93", bodyStyle: "Hatch" },
  { make: "Toyota", model: "Land Cruiser 79 4.5 D", yearFrom: 2012, yearTo: 2026, tankCapacityLitres: 130, consumptionLPer100Km: 13.5, suggestedFuelType: "diesel_50ppm", bodyStyle: "Bakkie" },
  { make: "Toyota", model: "Quantum / Sesfikile 2.8", yearFrom: 2013, yearTo: 2026, tankCapacityLitres: 80, consumptionLPer100Km: 10.5, suggestedFuelType: "diesel_50ppm", bodyStyle: "Minibus" },
  { make: "Volkswagen", model: "Polo Vivo 1.4", yearFrom: 2010, yearTo: 2026, tankCapacityLitres: 45, consumptionLPer100Km: 6.2, suggestedFuelType: "petrol_93", bodyStyle: "Hatch" },
  { make: "Volkswagen", model: "Polo 1.0 TSI", yearFrom: 2018, yearTo: 2026, tankCapacityLitres: 40, consumptionLPer100Km: 5.4, suggestedFuelType: "petrol_95", bodyStyle: "Hatch" },
  { make: "Volkswagen", model: "T-Cross 1.0 TSI", yearFrom: 2019, yearTo: 2026, tankCapacityLitres: 40, consumptionLPer100Km: 5.7, suggestedFuelType: "petrol_95", bodyStyle: "SUV" },
  { make: "Volkswagen", model: "Golf 1.4 TSI", yearFrom: 2013, yearTo: 2020, tankCapacityLitres: 50, consumptionLPer100Km: 6.4, suggestedFuelType: "petrol_95", bodyStyle: "Hatch" },
  { make: "Ford", model: "Ranger 2.0 SiT", yearFrom: 2022, yearTo: 2026, tankCapacityLitres: 80, consumptionLPer100Km: 9.4, suggestedFuelType: "diesel_50ppm", bodyStyle: "Double cab" },
  { make: "Ford", model: "Ranger 2.2 TDCi", yearFrom: 2012, yearTo: 2021, tankCapacityLitres: 80, consumptionLPer100Km: 9.6, suggestedFuelType: "diesel_500ppm", bodyStyle: "Double cab" },
  { make: "Ford", model: "EcoSport 1.0 EcoBoost", yearFrom: 2013, yearTo: 2022, tankCapacityLitres: 52, consumptionLPer100Km: 6.6, suggestedFuelType: "petrol_95", bodyStyle: "SUV" },
  { make: "Ford", model: "Fiesta 1.0 EcoBoost", yearFrom: 2013, yearTo: 2019, tankCapacityLitres: 45, consumptionLPer100Km: 5.9, suggestedFuelType: "petrol_95", bodyStyle: "Hatch" },
  { make: "Hyundai", model: "i20 1.4", yearFrom: 2015, yearTo: 2026, tankCapacityLitres: 45, consumptionLPer100Km: 6.4, suggestedFuelType: "petrol_93", bodyStyle: "Hatch" },
  { make: "Hyundai", model: "Grand i10 1.0", yearFrom: 2020, yearTo: 2026, tankCapacityLitres: 36, consumptionLPer100Km: 5.9, suggestedFuelType: "petrol_95", bodyStyle: "Hatch" },
  { make: "Hyundai", model: "Creta 1.5", yearFrom: 2020, yearTo: 2026, tankCapacityLitres: 50, consumptionLPer100Km: 6.8, suggestedFuelType: "petrol_95", bodyStyle: "SUV" },
  { make: "Kia", model: "Picanto 1.0", yearFrom: 2017, yearTo: 2026, tankCapacityLitres: 35, consumptionLPer100Km: 5.4, suggestedFuelType: "petrol_93", bodyStyle: "Hatch" },
  { make: "Kia", model: "Seltos 1.6", yearFrom: 2020, yearTo: 2026, tankCapacityLitres: 50, consumptionLPer100Km: 7.2, suggestedFuelType: "petrol_95", bodyStyle: "SUV" },
  { make: "Nissan", model: "NP200 1.6", yearFrom: 2012, yearTo: 2024, tankCapacityLitres: 50, consumptionLPer100Km: 8.2, suggestedFuelType: "petrol_93", bodyStyle: "Bakkie" },
  { make: "Nissan", model: "Magnite 1.0", yearFrom: 2021, yearTo: 2026, tankCapacityLitres: 50, consumptionLPer100Km: 6.5, suggestedFuelType: "petrol_95", bodyStyle: "SUV" },
  { make: "Suzuki", model: "Swift 1.2", yearFrom: 2018, yearTo: 2026, tankCapacityLitres: 37, consumptionLPer100Km: 5.1, suggestedFuelType: "petrol_95", bodyStyle: "Hatch" },
  { make: "Suzuki", model: "S-Presso 1.0", yearFrom: 2020, yearTo: 2026, tankCapacityLitres: 27, consumptionLPer100Km: 5.4, suggestedFuelType: "petrol_95", bodyStyle: "Hatch" },
  { make: "Suzuki", model: "Baleno 1.5", yearFrom: 2022, yearTo: 2026, tankCapacityLitres: 37, consumptionLPer100Km: 5.5, suggestedFuelType: "petrol_95", bodyStyle: "Hatch" },
  { make: "Honda", model: "Ballade 1.5", yearFrom: 2014, yearTo: 2026, tankCapacityLitres: 47, consumptionLPer100Km: 6.0, suggestedFuelType: "petrol_95", bodyStyle: "Sedan" },
  { make: "Renault", model: "Kwid 1.0", yearFrom: 2017, yearTo: 2026, tankCapacityLitres: 28, consumptionLPer100Km: 5.2, suggestedFuelType: "petrol_95", bodyStyle: "Hatch" },
  { make: "Renault", model: "Triber 1.0", yearFrom: 2020, yearTo: 2026, tankCapacityLitres: 40, consumptionLPer100Km: 6.0, suggestedFuelType: "petrol_95", bodyStyle: "MPV" },
  { make: "Isuzu", model: "D-Max 250", yearFrom: 2018, yearTo: 2026, tankCapacityLitres: 76, consumptionLPer100Km: 9.2, suggestedFuelType: "diesel_50ppm", bodyStyle: "Double cab" },
  { make: "Mazda", model: "CX-5 2.0", yearFrom: 2013, yearTo: 2026, tankCapacityLitres: 56, consumptionLPer100Km: 7.8, suggestedFuelType: "petrol_95", bodyStyle: "SUV" },
  { make: "BMW", model: "318i", yearFrom: 2015, yearTo: 2026, tankCapacityLitres: 60, consumptionLPer100Km: 6.8, suggestedFuelType: "petrol_95", bodyStyle: "Sedan" },
  { make: "Mercedes-Benz", model: "C180", yearFrom: 2014, yearTo: 2026, tankCapacityLitres: 66, consumptionLPer100Km: 7.0, suggestedFuelType: "petrol_95", bodyStyle: "Sedan" },
  { make: "Audi", model: "A3 1.4 TFSI", yearFrom: 2013, yearTo: 2020, tankCapacityLitres: 50, consumptionLPer100Km: 5.8, suggestedFuelType: "petrol_95", bodyStyle: "Hatch" },
  { make: "Chery", model: "Tiggo 4 Pro 1.5", yearFrom: 2021, yearTo: 2026, tankCapacityLitres: 51, consumptionLPer100Km: 7.0, suggestedFuelType: "petrol_95", bodyStyle: "SUV" },
  { make: "Haval", model: "Jolion 1.5", yearFrom: 2021, yearTo: 2026, tankCapacityLitres: 55, consumptionLPer100Km: 7.5, suggestedFuelType: "petrol_95", bodyStyle: "SUV" },
  { make: "GWM", model: "P-Series 2.0 TD", yearFrom: 2021, yearTo: 2026, tankCapacityLitres: 78, consumptionLPer100Km: 9.8, suggestedFuelType: "diesel_50ppm", bodyStyle: "Double cab" },
];

export const OTHER_VEHICLE = "Other / not listed";

// Starting points for a car we don't have on file, so a manually named vehicle
// still gets a sensible tank size and consumption the driver can adjust.
export type BodyStyleDefault = {
  id: string;
  label: string;
  example: string;
  tankCapacityLitres: number;
  consumptionLPer100Km: number;
  suggestedFuelType: FuelType;
};

export const BODY_STYLE_DEFAULTS: BodyStyleDefault[] = [
  { id: "hatch", label: "Small hatch", example: "Polo Vivo, Swift, i10", tankCapacityLitres: 40, consumptionLPer100Km: 6.0, suggestedFuelType: "petrol_95" },
  { id: "sedan", label: "Sedan", example: "Corolla, Ballade, City", tankCapacityLitres: 50, consumptionLPer100Km: 7.0, suggestedFuelType: "petrol_95" },
  { id: "suv", label: "SUV / crossover", example: "Creta, Tucson, X-Trail", tankCapacityLitres: 55, consumptionLPer100Km: 8.0, suggestedFuelType: "petrol_95" },
  { id: "bakkie", label: "Bakkie / double cab", example: "Hilux, Ranger, D-Max", tankCapacityLitres: 80, consumptionLPer100Km: 9.5, suggestedFuelType: "diesel_50ppm" },
  { id: "minibus", label: "Minibus / MPV", example: "Quantum, Staria, Triber", tankCapacityLitres: 70, consumptionLPer100Km: 10.0, suggestedFuelType: "diesel_50ppm" },
];

export const CURRENT_YEAR = new Date().getFullYear();

export function listMakes(): string[] {
  return Array.from(new Set(VEHICLE_SPECS.map((spec) => spec.make))).sort((a, b) => a.localeCompare(b));
}

export function listModels(make: string): string[] {
  return VEHICLE_SPECS.filter((spec) => spec.make === make)
    .map((spec) => spec.model)
    .sort((a, b) => a.localeCompare(b));
}

export function listYears(): number[] {
  const years: number[] = [];
  for (let year = CURRENT_YEAR; year >= 1990; year -= 1) years.push(year);
  return years;
}

export type VehicleSpecMatch = {
  make: string;
  model: string;
  bodyStyle: string;
  yearFrom: number;
  yearTo: number;
  tankCapacityLitres: number;
  consumptionLPer100Km: number;
  suggestedFuelType: FuelType;
  verified: false;
};

export function lookupVehicleSpec(make: string, model: string, year: number): VehicleSpecMatch | null {
  if (!make || !model || make === OTHER_VEHICLE) return null;
  const candidate = VEHICLE_SPECS.find(
    (spec) => spec.make === make && spec.model === model && year >= spec.yearFrom && year <= spec.yearTo,
  );
  if (candidate) {
    return { ...candidate, verified: false };
  }
  // The model range exists but this model year is outside our recorded span.
  const fallback = VEHICLE_SPECS.find((spec) => spec.make === make && spec.model === model);
  return fallback ? { ...fallback, verified: false } : null;
}
