export const runtime = "nodejs";
export const maxDuration = 300;

const projectId = "studio-9240700230-1dd9a";
const firebaseKey = "AIzaSyDEpFAsf1fI65xXklKYsukAWFYw5bzaHyc";
const documents = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

function stringField(fields: Record<string, any>, key: string): string {
  return fields[key]?.stringValue ?? "";
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return Response.json({ error: "로그인 후 수정할 수 있습니다." }, { status: 401 });
    const input = await request.json() as { projectId?: string; imageId?: string; sectionIndex?: number; expectedUpdatedAt?: string; preserveOtherSections?: boolean };
    const articleId = input.projectId ?? "", imageId = input.imageId ?? "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(articleId) || !/^[A-Za-z0-9_-]{1,128}$/.test(imageId) || !Number.isInteger(input.sectionIndex))
      return Response.json({ error: "글, 섹션, 이미지를 다시 선택해주세요." }, { status: 400 });

    const identityResponse = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }),
    });
    const identity = await identityResponse.json() as any;
    const uid = identity?.users?.[0]?.localId;
    if (!identityResponse.ok || !uid) return Response.json({ error: "로그인이 만료되었습니다." }, { status: 401 });

    const docResponse = await fetch(`${documents}/publishedContents/${articleId}?key=${firebaseKey}`, { cache: "no-store" });
    if (!docResponse.ok) return Response.json({ error: "글을 찾지 못했습니다." }, { status: 404 });
    const doc = await docResponse.json() as any, fields = doc.fields ?? {};
    if (stringField(fields, "ownerId") !== uid || stringField(fields, "type") !== "blog")
      return Response.json({ error: "본인의 블로그 글만 수정할 수 있습니다." }, { status: 403 });
    if (input.expectedUpdatedAt && input.expectedUpdatedAt !== stringField(fields, "updatedAt"))
      return Response.json({ error: "다른 곳에서 글이 수정됐습니다. 새로고침 후 다시 선택해주세요." }, { status: 409 });

    let content: any;
    try { content = JSON.parse(stringField(fields, "contentJson")); } catch { return Response.json({ error: "본문 형식을 확인할 수 없습니다." }, { status: 422 }); }
    const sectionIndex = input.sectionIndex!;
    if (!Array.isArray(content.sections) || sectionIndex < 0 || sectionIndex >= content.sections.length)
      return Response.json({ error: "본문 섹션을 찾지 못했습니다." }, { status: 400 });

    const imageResponse = await fetch(`${documents}/images/${imageId}?key=${firebaseKey}`, { cache: "no-store" });
    if (!imageResponse.ok) return Response.json({ error: "이미지 허브에서 해당 이미지를 찾지 못했습니다." }, { status: 404 });
    const imageDoc = await imageResponse.json() as any, imageFields = imageDoc.fields ?? {};
    if (stringField(imageFields, "visibility") === "private" && stringField(imageFields, "ownerId") !== uid)
      return Response.json({ error: "접근할 수 없는 이미지입니다." }, { status: 403 });
    if (!stringField(imageFields, "dataUrl") && !stringField(imageFields, "imageUrl") && !stringField(imageFields, "url"))
      return Response.json({ error: "표시할 수 있는 이미지 주소가 없습니다." }, { status: 422 });

    const imageIds: string[] = (fields.imageIds?.arrayValue?.values ?? []).map((v: any) => v.stringValue).filter(Boolean);
    const imageTitles: string[] = (fields.imageTitles?.arrayValue?.values ?? []).map((v: any) => v.stringValue ?? "");
    const oldIndex = Number.isInteger(content.sections[sectionIndex].imageIndex) ? content.sections[sectionIndex].imageIndex : sectionIndex + 1;
    let newIndex = imageIds.indexOf(imageId);
    let replacedShared = false;
    if (newIndex < 0 && (imageIds.length < 6 || input.preserveOtherSections === true)) {
      newIndex = imageIds.length;
      imageIds.push(imageId);
      imageTitles.push(stringField(imageFields, "title") || stringField(imageFields, "prompt") || "이미지 허브 이미지");
    } else if (newIndex < 0) {
      if (!Number.isInteger(oldIndex) || oldIndex < 0 || oldIndex >= imageIds.length)
        return Response.json({ error: "교체할 기존 이미지 위치를 찾지 못했습니다." }, { status: 409 });
      newIndex = oldIndex;
      replacedShared = true;
      imageIds[newIndex] = imageId;
      imageTitles[newIndex] = stringField(imageFields, "title") || stringField(imageFields, "prompt") || "이미지 허브 이미지";
    }
    content.sections[sectionIndex] = { ...content.sections[sectionIndex], imageIndex: newIndex };
    const now = new Date().toISOString();
    const params = new URLSearchParams({ key: firebaseKey, "currentDocument.updateTime": doc.updateTime });
    for (const path of ["imageIds", "imageTitles", "contentJson", "updatedAt"]) params.append("updateMask.fieldPaths", path);
    const patch = await fetch(`${documents}/publishedContents/${articleId}?${params}`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: {
        imageIds: { arrayValue: { values: imageIds.map(id => ({ stringValue: id })) } },
        imageTitles: { arrayValue: { values: imageTitles.map(title => ({ stringValue: title })) } },
        contentJson: { stringValue: JSON.stringify(content) }, updatedAt: { stringValue: now },
      } }),
    });
    if (!patch.ok) {
      const details = await patch.json().catch(() => null) as any;
      return Response.json({ error: patch.status === 400 || patch.status === 412 ? "글이 변경됐습니다. 새로고침 후 다시 시도해주세요." : details?.error?.message ?? "이미지 수정에 실패했습니다." }, { status: patch.status === 400 || patch.status === 412 ? 409 : patch.status });
    }
    return Response.json({ title: stringField(imageFields, "title") || stringField(imageFields, "prompt") || "새 이미지", sectionIndex, imageIndex: newIndex, replacedShared, updatedAt: now });
  } catch {
    return Response.json({ error: "이미지 변경 중 문제가 발생했습니다. 다시 시도해주세요." }, { status: 500 });
  }
}
