export const runtime = "nodejs";
export const maxDuration = 300;

import { authorizeReview } from "../../../lib/review-auth";
import { loadReviewMessages, saveReviewMessage } from "../../../lib/review-store";

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("projectId") ?? "";
    const auth = await authorizeReview(request, id);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    return Response.json({ messages: await loadReviewMessages(auth.uid, id, auth.token) });
  } catch { return Response.json({ error: "대화 기록을 불러오지 못했습니다." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { projectId?: string; message?: { id?: string; role?: string; kind?: string; text?: string; result?: unknown; createdAt?: string } };
    const id = input.projectId ?? "", message = input.message;
    const auth = await authorizeReview(request, id);
    if ("error" in auth) return Response.json({ error: auth.error }, { status: auth.status });
    if (!message || !/^[A-Za-z0-9-]{20,64}$/.test(message.id ?? "") || !["user", "assistant"].includes(message.role ?? "") ||
      !["request", "review", "progress", "change", "final", "reply"].includes(message.kind ?? "") || typeof message.text !== "string" || message.text.length > 8000)
      return Response.json({ error: "저장할 대화 형식을 확인해주세요." }, { status: 400 });
    const record = { id: message.id!, role: message.role as "user" | "assistant", kind: message.kind!, text: message.text,
      result: message.kind === "review" ? message.result : undefined, createdAt: new Date().toISOString() };
    await saveReviewMessage(auth.uid, id, record, auth.token);
    return Response.json({ message: record });
  } catch { return Response.json({ error: "대화 기록을 저장하지 못했습니다." }, { status: 503 }); }
}
