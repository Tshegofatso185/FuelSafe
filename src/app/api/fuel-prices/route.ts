import type { FuelType, PricingRegion } from "@/db/schema";

export const dynamic = "force-dynamic";

const pricePerLitre: Record<PricingRegion, Partial<Record<FuelType, number>>> = {
  inland: {
    petrol_93: 20.19,
    petrol_95: 20.30,
    diesel_500ppm: 18.5383,
    diesel_50ppm: 18.6023,
  },
  coastal: {
    petrol_93: 19.36,
    petrol_95: 19.47,
  },
};

export async function GET() {
  const today = new Date();
  const publishedLabel = today.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return Response.json({
    effectiveDate: today.toISOString().slice(0, 10),
    publishedLabel,
    sourceName: "DMRE / CEF official price breakdown",
    sourceUrl:
      "https://www.dmre.gov.za/Portals/0/Resources/Fuel%20Prices%20Adjustments/Fuel%20Prices%20Per%20Zone/2026/March%202026/Breakdown-of-Prices.pdf",
    pricePerLitre,
    isLive: false,
    notes: {
      petrol: "Petrol reference prices are region-specific regulated maximums.",
      diesel:
        "Diesel figures are the Inland DMRE reference only; diesel pump prices vary by station. A coastal diesel quote is not published here.",
      freshness:
        "This is the latest official reference bundled with this simulator. Check the DMRE/CEF notice before filling up.",
    },
  });
}
