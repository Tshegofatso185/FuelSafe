import { listMakes, listModels, listYears, lookupVehicleSpec, VEHICLE_SPECS } from "@/lib/vehicle-specs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const make = url.searchParams.get("make");
  const model = url.searchParams.get("model");
  const year = Number(url.searchParams.get("year"));

  // Spec lookup mode: resolve tank capacity, consumption and fuel grade.
  if (make && model && Number.isInteger(year) && year > 1950) {
    const match = lookupVehicleSpec(make, model, year);
    return Response.json({
      match,
      catalogueSize: VEHICLE_SPECS.length,
      disclaimer:
        "Typical published figures for the South African market. Confirm tank capacity against your owner's manual.",
    });
  }

  // Catalogue mode: populate the questionnaire selects.
  return Response.json({
    makes: listMakes(),
    modelsByMake: Object.fromEntries(listMakes().map((entry) => [entry, listModels(entry)])),
    years: listYears(),
    catalogueSize: VEHICLE_SPECS.length,
    disclaimer:
      "Typical published figures for the South African market. Confirm tank capacity against your owner's manual.",
  });
}
