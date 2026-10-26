import { cronAuthorization, runJob } from "@/lib/jobs";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function GET(
  request: Request,
  { params }: { params: Promise<{ job: string }> },
) {
  const { job } = await params;
  const status = cronAuthorization(job, request.headers.get("authorization"));
  if (status !== 200) return new Response(null, { status });
  await runJob(job);
  return Response.json({ ok: true });
}
