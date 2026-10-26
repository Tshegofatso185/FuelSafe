import { destroyCurrentSession, isTrustedMutation } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return Response.json({ error: "Send the request as JSON." }, { status: 415 });
  }
  await destroyCurrentSession(request);
  return Response.json({ ok: true });
}
