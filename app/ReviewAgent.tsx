"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, BookOpenText, Check, Image as ImageIcon, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Blog = { id: string; title: string; keyword: string; updatedAt: string; imageIds: string[]; imageTitles: string[]; content: { intro?: string; coverImageIndex?: number; sections?: { heading: string; body: string; imageIndex?: number }[] } };
type HubImage = { id: string; url: string; title: string; tags: string[] };
type Issue = { severity: "block" | "improve"; category: string; location: string; excerpt: string; reason: string; suggestion: string };
type Result = { reply: string; issues: Issue[]; imageRecommendations?: { sectionIndex: number; candidateIds: string[]; reason: string }[]; verdict: "pass" | "improve" | "hold"; reviewedAt: string; title: string };
type Turn = { id: string; role: "user" | "assistant"; kind: string; text: string; result?: Result; createdAt: string };
type AutoOutcome = { status: "applied" | "skipped" | "unverified"; heading?: string; before?: string; after?: string; reason?: string; updatedAt?: string; matchQuality?: "exact" | "approximate"; matchingMethod?: "visual" | "metadata" };

export default function ReviewAgent({ blogs, images, selectedId, tokenFetch, onEdit, onApplied }: {
  blogs: Blog[];
  images: HubImage[];
  selectedId: string;
  tokenFetch: (url: string, init: RequestInit) => Promise<Response>;
  onEdit: (id: string) => void;
  onApplied: () => Promise<void>;
}) {
  const [id, setId] = useState(selectedId);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imageEditor, setImageEditor] = useState(false);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [chosenImageId, setChosenImageId] = useState("");
  const [applying, setApplying] = useState(false);
  const [imageError, setImageError] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [progress, setProgress] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight; }, [turns, progress, error]);
  useEffect(() => { if (selectedId) setId(selectedId); }, [selectedId]);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadingHistory(true); setTurns([]); setResult(null); setError("");
    tokenFetch(`/api/review-blog/history?projectId=${encodeURIComponent(id)}`, { method: "GET" })
      .then(async response => {
        const data = await response.json().catch(() => null) as { messages?: Turn[]; error?: string } | null;
        if (!response.ok) throw new Error(data?.error || "이전 대화를 불러오지 못했습니다.");
        if (!cancelled) {
          const messages = data?.messages ?? [];
          setTurns(messages);
          setResult([...messages].reverse().find(message => message.kind === "review")?.result ?? null);
        }
      }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "이전 대화를 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  // The selected article controls when its history is restored; tokenFetch uses the active login session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const selected = blogs.find(x => x.id === id);

  function choose(next: string) {
    if (busy || applying) return;
    setId(next); setTurns([]); setResult(null); setError(""); setInput(""); setImageEditor(false); setChosenImageId("");
  }

  async function persist(articleId: string, role: Turn["role"], kind: string, text: string, result?: Result) {
    const draft = { id: crypto.randomUUID(), role, kind, text, result };
    const response = await tokenFetch("/api/review-blog/history", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: articleId, message: draft }) });
    const data = await response.json().catch(() => null) as { message?: Turn; error?: string } | null;
    if (!response.ok || !data?.message) throw new Error(data?.error || "대화 기록을 저장하지 못했습니다.");
    setTurns(previous => [...previous, data.message!]);
    return data.message;
  }

  async function review(articleId: string, message: string, history: Turn[], autoApply: boolean) {
    const response = await tokenFetch("/api/review-blog", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: articleId, message, autoApply, history: history.slice(-6).map(({ role, text }) => ({ role, text })),
        imageLibrary: images.map(({ id, title, tags }) => ({ id, title, tags })) }),
    });
    const data = await response.json().catch(() => null) as (Result & { error?: string }) | null;
    if (!response.ok) throw new Error(data?.error || `검수 서버가 응답하지 않았습니다 (${response.status}). 잠시 후 다시 시도해주세요.`);
    if (!data || !Array.isArray(data.issues)) throw new Error("검수 서버의 답변을 읽지 못했습니다. 다시 시도해주세요.");
    await persist(articleId, "assistant", "review", data.reply, data);
    setResult(data);
    return data;
  }

  async function send(message = input, automatic = false) {
    const text = message.trim();
    if (!selected || !text || busy || loadingHistory) return;
    const articleId = selected.id;
    const autoApply = automatic || (/자동/.test(text) && /이미지|사진/.test(text) && /교체|수정|바꿔/.test(text));
    setBusy(true); setError(""); setProgress(autoApply ? "선택한 글을 검수하고 있습니다..." : "글을 읽고 검수 중입니다...");
    const history = turns;
    let started = false, reported = false;
    try {
      await persist(articleId, "user", "request", text);
      started = true;
      setInput("");
      const data = await review(articleId, text, history, autoApply);
      if (!autoApply) return;
      const recommendations = data.imageRecommendations ?? [];
      const unique = [...new Map(recommendations.map(item => [item.sectionIndex, item])).values()];
      const changes: AutoOutcome[] = [], skipped: string[] = [];
      let updatedAt = selected.updatedAt;
      await persist(articleId, "assistant", "progress", unique.length ? `실제 사진에서 부조화를 확인한 ${unique.length}개 섹션에 가장 가까운 사진을 찾겠습니다.` : "검수는 끝났습니다. 실제 사진에서 교체가 필요한 섹션을 찾지 못했습니다.");
      for (const [index, recommendation] of unique.entries()) {
        setProgress(`사진 검토와 저장 확인 중... ${index + 1}/${unique.length}`);
        const heading = selected.content.sections?.[recommendation.sectionIndex]?.heading || `본문 섹션 ${recommendation.sectionIndex + 1}`;
        try {
          const response = await tokenFetch("/api/review-blog/auto-image", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: articleId, sectionIndex: recommendation.sectionIndex,
              candidateIds: images.map(image => image.id), expectedUpdatedAt: updatedAt, autoAuthorized: true }) });
          const outcome = await response.json().catch(() => null) as (AutoOutcome & { error?: string }) | null;
          if (!response.ok || !outcome) throw new Error(outcome?.error || `사진 검토에 실패했습니다 (${response.status}).`);
          if (outcome.status === "applied") {
            updatedAt = outcome.updatedAt || updatedAt;
            changes.push(outcome);
            await persist(articleId, "assistant", "change", `「${heading}」 사진을 「${outcome.before}」에서 「${outcome.after}」(으)로 ${outcome.matchQuality === "approximate" ? "유사 이미지로 " : ""}교체하고 저장된 글에서 확인했습니다.${outcome.matchingMethod === "metadata" ? ` 시각 비교는 완료되지 않았습니다. ${outcome.reason || "제목·태그를 기준으로 선택했습니다."}` : ""}`);
          } else {
            skipped.push(`「${heading}」: ${outcome.reason || "확인 필요"}`);
            await persist(articleId, "assistant", "progress", `「${heading}」 자동 교체 보류: ${outcome.reason || "확인 필요"}`);
            if (outcome.status === "unverified" || /다른 곳에서 수정/.test(outcome.reason || "")) break;
          }
        } catch (cause) {
          const reason = cause instanceof Error ? cause.message : "사진 처리 오류";
          skipped.push(`「${heading}」: ${reason}`);
          await persist(articleId, "assistant", "progress", `「${heading}」 자동 교체 보류: ${reason}`);
        }
      }
      if (changes.length) await onApplied();
      const summary = `「${data.title}」 한 건의 검수와 이미지 자동 수정을 마쳤습니다.\n\n` +
        (changes.length ? `교체 완료 ${changes.length}건:\n${changes.map(item => `• ${item.heading}: ${item.before} → ${item.after} (${item.matchingMethod === "metadata" ? `시각 비교 미완료, 제목·태그 기준 유사 이미지로 교체${item.reason?.includes("관련성을 확인하지 못했습니다") ? ", 관련성 확인 불가" : ""}` : item.matchQuality === "approximate" ? "유사한 이미지로 교체" : "본문과 적합한 이미지로 교체"})`).join("\n")}\n\n` : "자동 교체 완료 항목은 없습니다.\n\n") +
        (skipped.length ? `교체 보류 ${skipped.length}건:\n${skipped.map(item => `• ${item}`).join("\n")}\n\n` : "") +
        `그 밖의 검수 권장사항 ${data.issues.filter(issue => !issue.category.includes("이미지")).length}건은 위 검수 결과에서 확인할 수 있습니다. ${changes.length ? "공개 글의 저장 결과를 다시 확인했습니다." : "원문은 변경하지 않았습니다."}`;
      await persist(articleId, "assistant", "final", summary);
      reported = true;
      setResult(data);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "다시 시도해주세요.";
      if (autoApply && started && !reported) {
        try { await persist(articleId, "assistant", "final", `「${selected.title}」 자동 검수를 끝까지 완료하지 못했습니다. ${reason} 이미 바뀐 사진이 있을 수 있으니 공개 글을 확인한 뒤 다시 요청해주세요.`); }
        catch { setError(reason); }
      } else setError(reason);
    } finally { setBusy(false); setProgress(""); }
  }

  const sections = selected?.content?.sections ?? [];
  const recommendation = result?.imageRecommendations?.find(x => x.sectionIndex === sectionIndex);
  const sortedImages = [...images].sort((a, b) => Number(recommendation?.candidateIds.includes(b.id) ?? false) - Number(recommendation?.candidateIds.includes(a.id) ?? false));
  const oldIndex = Number.isInteger(sections[sectionIndex]?.imageIndex) ? sections[sectionIndex].imageIndex! : sectionIndex + 1;
  const isAlreadySelected = selected?.imageIds.includes(chosenImageId) ?? false;
  const willReplaceSlot = !!chosenImageId && !isAlreadySelected && (selected?.imageIds.length ?? 0) >= 6;
  const affectedSections = willReplaceSlot ? sections.filter((section, index) => index !== sectionIndex && (section.imageIndex ?? index + 1) === oldIndex).length : 0;
  const affectsCover = willReplaceSlot && oldIndex === (selected?.content.coverImageIndex ?? 0);

  function openImageEditor(issue?: Issue) {
    const sectionNumber = issue?.location.match(/(?:본문\s*)?섹션\s*(\d+)|본문\s*(\d+)/)?.slice(1).find(Boolean);
    const namedIndex = sections.findIndex(section => section.heading && issue?.location.includes(section.heading));
    const requestedIndex = sectionNumber ? Number(sectionNumber) - 1 : namedIndex;
    const recommendedIndex = result?.imageRecommendations?.[0]?.sectionIndex ?? 0;
    setSectionIndex(requestedIndex >= 0 && requestedIndex < sections.length ? requestedIndex : recommendedIndex);
    setChosenImageId(""); setImageError(""); setImageEditor(true);
  }

  async function applyImage() {
    if (!selected || !chosenImageId || applying) return;
    setApplying(true); setImageError("");
    try {
      const response = await tokenFetch("/api/review-blog/replace-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selected.id, sectionIndex, imageId: chosenImageId, expectedUpdatedAt: selected.updatedAt }),
      });
      const data = await response.json().catch(() => null) as { error?: string; title?: string } | null;
      if (!response.ok) throw new Error(data?.error || `이미지 변경에 실패했습니다 (${response.status}).`);
      if (!data) throw new Error("변경 결과를 읽지 못했습니다. 공개 글을 확인해주세요.");
      await onApplied();
      setImageEditor(false); setChosenImageId(""); setResult(null);
      await persist(selected.id, "assistant", "change", `「${sections[sectionIndex].heading}」 섹션 이미지를 「${data.title}」(으)로 변경하고 공개 글에 저장했습니다. 공개 페이지에서 결과를 확인할 수 있습니다.`);
    } catch (cause) { setImageError(cause instanceof Error ? cause.message : "다시 시도해주세요."); }
    finally { setApplying(false); }
  }

  return <section className="review-page">
    <div className="review-intro"><div><span>EDITORIAL REVIEW</span><h2>블로그 검수 에이전트</h2><p>선택한 글 한 건을 검수하고 어울리지 않는 사진은 직접 확인해 자동 교체합니다. 결과와 대화는 저장됩니다.</p></div><div className="review-capability"><ShieldCheck/><span>자동 수정은 선택한 글 1건만<br/>진행하고 결과를 보고합니다.</span></div></div>
    <div className="review-start"><div><strong>{selected ? `선택된 글: ${selected.title}` : "먼저 왼쪽에서 블로그를 선택해주세요"}</strong><small>글 한 건 검수 → 사진 확인·자동 교체 → 저장 확인 → 채팅 보고. 완료될 때까지 이 화면을 열어두세요.</small></div><button type="button" disabled={!selected || busy || applying || loadingHistory} onClick={() => void send("선택한 이 글을 전체 검수하고, 어울리지 않는 사진은 실제 사진이 어울리지 않으면 이미지 허브에서 가장 가까운 사진으로 자동 교체해줘. 유사한 사진이면 솔직히 그렇게 보고하고 저장 결과를 확인해줘.", true)}><Sparkles/> {busy ? "자동 검수 진행 중..." : "선택한 글 검수·이미지 자동 수정"}</button></div>
    <div className="review-layout">
      <aside className="review-list"><div className="review-list-heading"><BookOpenText/><b>검수할 글</b><small>{blogs.length}개</small></div>{blogs.length ? blogs.map(blog => <button key={blog.id} disabled={busy || applying} className={`review-select ${id === blog.id ? "active" : ""}`} onClick={() => choose(blog.id)}><strong>{blog.title}</strong><small>{blog.keyword || "키워드 없음"} · {blog.updatedAt ? new Date(blog.updatedAt).toLocaleDateString("ko-KR") : "발행됨"}</small></button>) : <p className="review-empty-list">검수할 블로그가 없습니다. 로그인한 계정의 공개 블로그가 여기에 표시됩니다.</p>}</aside>
      <div className="review-chat"><div className="review-chat-head"><Sparkles/><div><b>{selected?.title || "글을 선택해주세요"}</b><small>대화형 콘텐츠 검수</small></div>{result && <span className={`review-verdict ${result.verdict}`}>{result.verdict === "hold" ? "확인 필요" : result.verdict === "improve" ? "수정 권장" : "검수 통과"}</span>}</div>
        <div className="review-thread" ref={threadRef}><div className="review-bubble assistant">안녕하세요. 선택한 글 한 건을 검수하고, 어울리지 않는 사진은 가장 가까운 사진으로 바꾸고 유사한 교체 여부까지 보고하겠습니다.</div>{loadingHistory && <div className="review-bubble assistant"><Loader2 className="spin"/> 이전 대화를 불러오는 중입니다...</div>}{turns.map(turn => <div key={turn.id} className={`review-bubble ${turn.role} ${turn.kind === "final" ? "final" : ""}`}>{turn.text}</div>)}{busy && <div className="review-bubble assistant"><Loader2 className="spin"/> {progress}</div>}{error && <div className="review-error"><AlertCircle/>{error}</div>}</div>
        {selected && turns.length === 0 && !loadingHistory && <div className="review-suggestions"><button onClick={() => send("이 글을 전체 검수해줘. 발행된 글에서 우선 수정할 문제부터 알려줘.")} disabled={busy}>검수만 하기</button><button onClick={() => send("확인되지 않은 사실 주장이나 과장된 표현을 중심으로 검수해줘.")} disabled={busy}>사실·표현 확인</button></div>}
        <form className="review-compose" onSubmit={event => { event.preventDefault(); void send(); }}><input value={input} onChange={event => setInput(event.target.value)} disabled={!selected || busy || loadingHistory} placeholder={selected ? "예: 지난번에 바꾼 사진 다시 검토해줘" : "먼저 글을 선택해주세요"} aria-label="검수 에이전트에게 질문"/><button disabled={!selected || !input.trim() || busy || loadingHistory} aria-label="질문 보내기">{busy ? <Loader2 className="spin"/> : <Send/>}</button></form>
      </div>
    </div>
    {result && <section className="review-report"><div className="review-report-head"><div><span>REVIEW RESULT</span><h3>검수 결과 <small>{result.issues.length}건</small></h3></div><div className="review-report-actions">{sections.length > 0 && <button type="button" onClick={() => openImageEditor()}><ImageIcon/> 이미지 바꾸기</button>}<button type="button" onClick={() => onEdit(id)}>원고 수정하기 <ArrowRight/></button></div></div><p className="review-boundary">글에 적힌 사실의 진위와 실제 이미지 파일의 표시 상태는 이 검수만으로 확정할 수 없습니다. 확인이 필요한 항목은 원문과 외부 근거를 직접 대조하세요.</p>{result.issues.length ? <div className="review-issues">{result.issues.map((issue, i) => <article key={`${issue.location}-${i}`} className={issue.severity}><div><span>{issue.severity === "block" ? "우선 확인" : "수정 권장"}</span><b>{issue.category} · {issue.location}</b></div>{issue.excerpt && <blockquote>{issue.excerpt}</blockquote>}<p>{issue.reason}</p><small><Check/> {issue.suggestion}</small>{issue.category.includes("이미지") && sections.length > 0 && <button type="button" className="review-fix-image" onClick={() => openImageEditor(issue)}>이미지 허브에서 바꾸기 <ArrowRight/></button>}</article>)}</div> : <div className="review-no-issues"><Check/> 이번 검수에서 구조나 표현 문제를 찾지 못했습니다.</div>}</section>}
    <Dialog open={!!selected && imageEditor} onOpenChange={open => { if (!applying) setImageEditor(open); }}><DialogContent className="review-image-dialog" showCloseButton={!applying}>{selected && <div className="review-image-editor"><div className="review-report-head"><div><span>IMAGE HUB</span><DialogTitle>본문 이미지 교체</DialogTitle></div></div><label className="review-section-select">교체할 본문 섹션<select value={sectionIndex} onChange={event => { setSectionIndex(Number(event.target.value)); setChosenImageId(""); setImageError(""); }}>{sections.map((section, index) => <option value={index} key={index}>{index + 1}. {section.heading}</option>)}</select></label><p className="review-current-image">현재 이미지: {selected.imageTitles[oldIndex] || "이미지 없음"} · 이미지 허브의 {images.length}개 중 선택</p>{recommendation?.reason && <p className="review-recommendation"><Sparkles/> 에이전트 추천: {recommendation.reason}</p>}{images.length ? <div className="review-image-grid">{sortedImages.map(image => <button type="button" key={image.id} className={`review-image-option ${chosenImageId === image.id ? "selected" : ""}`} aria-pressed={chosenImageId === image.id} onClick={() => setChosenImageId(image.id)}><img src={image.url} alt={image.title}/><strong>{image.title}</strong>{recommendation?.candidateIds.includes(image.id) && <span>추천</span>}</button>)}</div> : <p className="review-image-empty">이미지 허브에서 공개 이미지를 불러오지 못했습니다. 이미지 공개 설정을 확인한 뒤 새로고침해주세요.</p>}{willReplaceSlot && <p className="review-impact"><AlertCircle/> 선택된 이미지가 이미 6장이라 현재 이미지 자리를 교체합니다.{affectsCover ? " 대표 이미지도 함께 바뀝니다." : ""}{affectedSections ? ` 다른 본문 ${affectedSections}곳도 함께 바뀝니다.` : ""}</p>}{imageError && <p className="review-error"><AlertCircle/>{imageError}</p>}<div className="review-image-actions"><a href={`/content/${selected.id}`} target="_blank" rel="noreferrer">현재 공개 글 보기</a><button type="button" disabled={!chosenImageId || applying} onClick={applyImage}>{applying ? <Loader2 className="spin"/> : <Check/>} {applying ? "공개 글 수정 중..." : "이 이미지로 변경·저장"}</button></div></div>}</DialogContent></Dialog>
  </section>;
}
