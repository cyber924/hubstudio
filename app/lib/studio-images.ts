export const firebaseProject = "studio-9240700230-1dd9a";
export const firebaseKey = "AIzaSyDEpFAsf1fI65xXklKYsukAWFYw5bzaHyc";
export const documents = `https://firestore.googleapis.com/v1/projects/${firebaseProject}/databases/(default)/documents`;

export type StudioImage = { id: string; title: string; tags: string[]; inline: { mimeType: string; data: string } | null };

export async function studioIdentity(request: Request): Promise<string | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!token) return null;
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseKey}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
  });
  if (!response.ok) return null;
  return (await response.json() as any)?.users?.[0]?.localId ?? null;
}

export async function studioImages(ids: string[], uid: string): Promise<StudioImage[]> {
  const unique = [...new Set(ids)].filter(id => /^[A-Za-z0-9_-]{1,128}$/.test(id)).slice(0, 6);
  const found = await Promise.all(unique.map(async id => {
    try {
      const response = await fetch(`${documents}/images/${encodeURIComponent(id)}?key=${firebaseKey}`, { cache: "no-store" });
      if (!response.ok) return null;
      const f = ((await response.json()) as any).fields ?? {};
      const get = (key: string) => String(f[key]?.stringValue ?? "");
      if (get("visibility") === "private" && get("ownerId") !== uid) return null;
      const url = get("dataUrl") || get("imageUrl") || get("url");
      if (!url) return null;
      const match = url.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
      return { id, title: (get("title") || get("prompt") || "이미지").slice(0, 120),
        tags: (f.tags?.arrayValue?.values ?? []).map((v: any) => String(v.stringValue ?? "")).slice(0, 8),
        inline: match && match[2].length < 1400000 ? { mimeType: match[1], data: match[2] } : null };
    } catch { return null; }
  }));
  return found.filter(Boolean) as StudioImage[];
}

export function imageParts(images: StudioImage[]) {
  return images.flatMap((image, index) => image.inline ? [{ text: `선택 사진 ${index + 1}, ID ${image.id}, 제목 ${image.title}` }, { inlineData: image.inline }] : []);
}
