const firebaseProject = "studio-9240700230-1dd9a";
const firebaseKey = "AIzaSyDEpFAsf1fI65xXklKYsukAWFYw5bzaHyc";
export const firestoreDocuments = `https://firestore.googleapis.com/v1/projects/${firebaseProject}/databases/(default)/documents`;
export const firestoreKey = firebaseKey;

export function documentField(fields: Record<string, any>, name: string): string {
  return fields[name]?.stringValue ?? "";
}

export async function authorizeReview(request: Request, articleId: string) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(articleId)) return { error: "검수할 글을 선택해주세요.", status: 400 } as const;
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return { error: "로그인 후 이용할 수 있습니다.", status: 401 } as const;
  const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
  });
  const identity = await identityResponse.json() as any;
  const uid = identity?.users?.[0]?.localId;
  if (!identityResponse.ok || !uid) return { error: "로그인이 만료되었습니다. 다시 로그인해주세요.", status: 401 } as const;
  const articleResponse = await fetch(`${firestoreDocuments}/publishedContents/${encodeURIComponent(articleId)}?key=${firebaseKey}`, { cache: "no-store" });
  if (!articleResponse.ok) return { error: "글을 찾을 수 없습니다.", status: 404 } as const;
  const article = await articleResponse.json() as any;
  const fields = article.fields ?? {};
  if (documentField(fields, "ownerId") !== uid || documentField(fields, "type") !== "blog")
    return { error: "본인의 블로그 글만 이용할 수 있습니다.", status: 403 } as const;
  return { uid: uid as string, token, article, fields };
}
