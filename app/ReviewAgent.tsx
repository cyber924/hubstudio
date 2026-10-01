"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, BookOpenText, Check, Image as ImageIcon, Loader2, Send, ShieldCheck, Sparkles } from "lucide-react";
import AgentVoice from "./AgentVoice";
import ContentBody from "./ContentBody";
import {agentExamples} from "./lib/agent-examples";
import type {AgentJob} from "./lib/agent-jobs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type Blog = { id: string; title: string; keyword: string; updatedAt: string; imageIds: string[]; imageTitles: string[]; content: { intro?: string; coverImageIndex?: number; sections?: { heading: string; body: string; imageIndex?: number }[] } };
type HubImage = { id: string; url: string; title: string; tags: string[] };
type Issue = { severity: "block" | "improve"; category: string; location: string; excerpt: string; reason: string; suggestion: string };
type Result = { reply: string; issues: Issue[]; imageRecommendations?: { sectionIndex: number; candidateIds: string[]; reason: string }[]; verdict: "pass" | "improve" | "hold"; reviewedAt: string; title: string };
type Turn = { id: string; role: "user" | "assistant"; kind: string; text: string; result?: Result; createdAt: string };
type AutoOutcome = { status: "applied" | "skipped" | "unverified"; heading?: string; before?: string; after?: string; reason?: string; updatedAt?: string; matchQuality?: "exact" | "approximate"; matchingMethod?: "visual" | "metadata" };

export default function ReviewAgent({ blogs, images, selectedId, tokenFetch, onEdit, onApplied, userId }: {
  userId: string;
  blogs: Blog[];
  images: HubImage[];
  selectedId: string;
  tokenFetch: (url: string, init: RequestInit) => Promise<Response>;
  onEdit: (id: string) => void;
  onApplied: () => Promise<void>;
}) {
  const [id, setId] = useState(selectedId);
  const [page,setPage]=useState(1),[query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[listOpen,setListOpen]=useState(false),[exampleGroup,setExampleGroup]=useState('새 글 만들기');
  const [newThread,setNewThread]=useState(''),[job,setJob]=useState<AgentJob|null>(null),[jobs,setJobs]=useState<AgentJob[]>([]),[publish,setPublish]=useState(false),[preview,setPreview]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null),requestId=useRef<string>(''),requestKey=useRef<string>(''),finished=useRef<string>('');
  const fetchRef=useRef(tokenFetch),appliedRef=useRef(onApplied);fetchRef.current=tokenFetch;appliedRef.current=onApplied;
  const threadId=job?.threadId||id||newThread;
  const completedIds=new Set(jobs.filter(x=>x.status==='done'&&x.plan?.action!=='reply').map(x=>x.projectId));
  const filtered=blogs.filter(x=>(!query||`${x.title} ${x.keyword}`.toLowerCase().includes(query.toLowerCase()))&&(filter==='all'||(filter==='done'?completedIds.has(x.id):!completedIds.has(x.id))));
  const pageCount=Math.max(1,Math.ceil(filtered.length/5)),shown=filtered.slice((page-1)*5,page*5);
  useEffect(()=>setPage(1),[query,filter]);
  useEffect(()=>setPage(p=>Math.min(p,pageCount)),[pageCount]);
  useEffect(()=>{if(!selectedId)return;const n=filtered.findIndex(x=>x.id===selectedId);if(n>=0)setPage(Math.floor(n/5)+1);},[selectedId]);
  useEffect(()=>{let active=true;let saved=localStorage.getItem(`hub_agent_thread_${userId}`);if(!saved){saved=`agent_session_${crypto.randomUUID()}`;localStorage.setItem(`hub_agent_thread_${userId}`,saved);}setNewThread(saved);
   fetchRef.current('/api/blog-agent/jobs',{method:'GET'}).then(async r=>{const d:any=await r.json();if(!r.ok)throw new Error(d.error);if(!active)return;setJobs(d.jobs||[]);const running=(d.jobs||[]).find((x:AgentJob)=>['queued','running','paused','failed'].includes(x.status));if(running){setJob(running);setPublish(running.publish);setId(running.projectId||'');setNewThread(running.threadId);setBusy(['queued','running'].includes(running.status));}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};
  },[userId]);
  useEffect(()=>{if(!job||!['queued','running'].includes(job.status))return;let active=true;let timer:ReturnType<typeof setTimeout>;const jobId=job.id;
   async function poll(){try{const r=await fetchRef.current(`/api/blog-agent/jobs?id=${jobId}`,{method:'GET'}),d:any=await r.json();if(!r.ok)throw new Error(d.error);if(!active)return;const next=d.job as AgentJob;setJob(next);setProgress(next.stageLabel);setJobs(old=>[next,...old.filter(x=>x.id!==next.id)]);
    if(next.status==='done'){setBusy(false);setProgress('');setResult(next.result||null);if(finished.current!==jobId){finished.current=jobId;await appliedRef.current();const h=await fetchRef.current(`/api/review-blog/history?projectId=${encodeURIComponent(next.threadId)}`,{method:'GET'});const hd:any=await h.json();if(!h.ok)throw new Error(hd.error);if(active)setTurns(hd.messages||[]);}return;}
    if(['paused','failed'].includes(next.status)){setBusy(false);setProgress('');if(next.error)setError(next.error);return;}
    if(['queued','running'].includes(next.status)&&Date.now()-Date.parse(next.updatedAt)>340000){setBusy(false);setError('서버 작업이 중단된 것으로 보입니다. 이어하기로 저장된 단계부터 다시 진행하세요.');return;}
   }catch(e){if(active){setError(e instanceof Error?e.message:'작업 조회 실패');setBusy(false);}return;}if(active)timer=setTimeout(poll,6000);}
   timer=setTimeout(poll,1200);return()=>{active=false;clearTimeout(timer);};
  },[job?.id,job?.status]);
  async function send(message=input,automatic=false,operation?:'publish'|'undo'){
   const text=message.trim();if(!text||busy||loadingHistory||!threadId)return;if(!id&&/선택한 글|선택한 이 글/.test(text)){setError('대상 블로그를 먼저 선택해주세요.');return;}
   const key=JSON.stringify({text,id,threadId,publish,operation,source:operation?job?.id:''});if(requestKey.current!==key){requestKey.current=key;requestId.current=crypto.randomUUID();}
   setBusy(true);setError('');setProgress('작업 시작 중…');
   try{const r=await tokenFetch('/api/blog-agent/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:requestId.current,threadId,projectId:id,message:text,publish,operation,sourceJob:job?.status==='done'?job.id:undefined,imageLibrary:images.map(({id,title,tags})=>({id,title,tags}))})}),d:any=await r.json();if(!r.ok)throw new Error(d.error);setJob(d.job);setJobs(old=>[d.job,...old.filter(x=>x.id!==d.job.id)]);setInput('');setTurns(old=>[...old,{id:d.job.id,role:'user',kind:'request',text,createdAt:d.job.createdAt}]);if(d.job.status==='done'){setBusy(false);setTurns(old=>[...old,{id:`${d.job.id}-final`,role:'assistant',kind:'final',text:d.job.reply,createdAt:d.job.updatedAt}]);}requestKey.current='';
   }catch(e){setBusy(false);setError(e instanceof Error?e.message:'작업 시작 실패');setProgress('');}
  }
  async function resume(){if(!job||busy)return;setBusy(true);setError('');try{const r=await tokenFetch('/api/blog-agent/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resume:job.id,publish:!id?publish:undefined})}),d:any=await r.json();if(!r.ok)throw new Error(d.error);setJob({...d.job,status:'queued'});}catch(e){setBusy(false);setError(e instanceof Error?e.message:'이어하기 실패');}}
  function newBlog(){if(busy)return;const next=`agent_session_${crypto.randomUUID()}`;localStorage.setItem(`hub_agent_thread_${userId}`,next);setNewThread(next);setId('');setJob(null);setTurns([]);setResult(null);setInput('');setListOpen(false);setError('');}
  function pickExample(example:typeof agentExamples[number]){if(busy)return;if(!example.needsBlog&&(id||job))newBlog();setInput(example.text);setError(example.needsBlog&&!id?'왼쪽 목록에서 대상 글을 선택한 뒤 전송해주세요.':'');inputRef.current?.focus();}
  async function openJob(next:AgentJob){if(busy)return;setJob(next);setPublish(next.publish);setId(blogs.some(b=>b.id===next.projectId)?next.projectId:'');setNewThread(next.threadId);setResult(next.result||null);setPreview(false);}

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
    if (!threadId) return;
    let cancelled = false;
    setLoadingHistory(true); setTurns([]); setResult(null); setError("");
    tokenFetch(`/api/review-blog/history?projectId=${encodeURIComponent(threadId)}`, { method: "GET" })
      .then(async response => {
        const data = await response.json().catch(() => null) as { messages?: Turn[]; error?: string } | null;
        if (!response.ok) throw new Error(data?.error || "이전 대화를 불러오지 못했습니다.");
        if (!cancelled) {
          const messages = data?.messages ?? [];
          setTurns(messages);
          setResult([...messages].reverse().find(message => message.result)?.result ?? null);
        }
      }).catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "이전 대화를 불러오지 못했습니다."); })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  // The selected article controls when its history is restored; tokenFetch uses the active login session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);
  const selected = blogs.find(x => x.id === id);

  function choose(next: string) {
    if (busy || applying) return;
    setJob(null); setListOpen(false); setId(next); setTurns([]); setResult(null); setError(""); setInput(""); setImageEditor(false); setChosenImageId("");
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
    <div className="review-intro"><div><span>EDITORIAL REVIEW</span><h2>블로그 제작·관리 에이전트</h2><p>대화와 음성으로 새 글을 만들고, 기존 글의 본문·사진을 검수하고 수정합니다. 작업과 대화는 저장됩니다.</p></div><div className="review-capability"><ShieldCheck/><span>한 번에 글 한 건을 처리하고<br/>저장 확인 후 결과를 보고합니다.</span></div></div>
    <div className="review-start"><div><strong>{selected ? `선택된 글: ${selected.title}` : "새 블로그를 요청하거나 기존 글을 선택해주세요"}</strong><small>기획 → 생성·검수 → 수정 → 저장 확인 → 완료 보고. 서버 작업은 화면을 나가도 실행 제한 시간 안에서 이어집니다.</small></div><button type="button" disabled={!selected || busy || applying || loadingHistory} onClick={() => void send("선택한 이 글을 전체 검수하고, 어울리지 않는 사진은 실제 사진이 어울리지 않으면 이미지 허브에서 가장 가까운 사진으로 자동 교체해줘. 유사한 사진이면 솔직히 그렇게 보고하고 저장 결과를 확인해줘.", true)}><Sparkles/> {busy ? "자동 검수 진행 중..." : "선택한 글 검수·이미지 자동 수정"}</button></div>
    <div className="review-layout">
      <button type="button" className="agent-list-toggle" onClick={()=>setListOpen(!listOpen)} aria-expanded={listOpen}>글 선택 · {selected?.title||'새 블로그'} <span>{listOpen?'접기':'열기'}</span></button>
      <aside className={`review-list ${listOpen?'agent-list-open':''}`}><div className="review-list-heading"><BookOpenText/><b>내 블로그</b><small>{blogs.length}개</small></div>
       <button type="button" className="agent-new" disabled={busy} onClick={newBlog}>＋ 새 블로그 만들기</button>
       <input className="agent-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="제목·키워드 검색" aria-label="블로그 검색"/>
       <select className="agent-search" value={filter} onChange={e=>setFilter(e.target.value)} aria-label="검수 상태 필터"><option value="all">전체 글</option><option value="pending">에이전트 완료 기록 없음</option><option value="done">에이전트 작업 완료</option></select>
       {shown.map(blog=><button key={blog.id} disabled={busy||applying} className={`review-select ${id===blog.id?'active':''}`} onClick={()=>choose(blog.id)}><strong title={blog.title}>{blog.title}</strong><small>{blog.keyword||'키워드 없음'} · {blog.updatedAt?new Date(blog.updatedAt).toLocaleDateString('ko-KR'):''}</small><span className="agent-list-status">{completedIds.has(blog.id)?'작업 완료':'검수 가능'}</span></button>)}
       {!shown.length&&<p className="review-empty-list">조건에 맞는 글이 없습니다. 새 블로그를 요청할 수 있습니다.</p>}
       <nav className="agent-pagination" aria-label="블로그 목록 페이지"><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>이전</button><span>{page} / {pageCount}</span><button type="button" disabled={page>=pageCount} onClick={()=>setPage(p=>p+1)}>다음</button></nav>
      </aside>
      <div className="review-chat"><div className="review-chat-head"><Sparkles/><div><b>{selected?.title || "새 블로그 만들기"}</b><small>대화형 제작 · 검수 · 수정</small></div>{result && <span className={`review-verdict ${result.verdict}`}>{result.verdict === "hold" ? "확인 필요" : result.verdict === "improve" ? "수정 권장" : "검수 통과"}</span>}</div>
        <div className="review-thread" ref={threadRef}><div className="review-bubble assistant">원하는 작업을 말씀해주세요. 아래 예시를 누르면 명령이 입력됩니다. 새 글은 기본적으로 초안으로 저장하고, 선택한 공개 글의 수정 요청은 해당 글에 반영합니다.</div>{loadingHistory && <div className="review-bubble assistant"><Loader2 className="spin"/> 이전 대화를 불러오는 중입니다...</div>}{turns.map(turn => <div key={turn.id} className={`review-bubble ${turn.role} ${turn.kind === "final" ? "final" : ""}`}>{turn.text}</div>)}{busy && <div className="review-bubble assistant"><Loader2 className="spin"/> {progress}</div>}{error && <div className="review-error"><AlertCircle/>{error}</div>}</div>
        <div className="agent-examples"><div className="agent-example-tabs" aria-label="예시 명령 종류">{['새 글 만들기','검수','본문 수정','사진 교체','저장·발행'].map(group=><button type="button" key={group} disabled={busy} aria-pressed={group===exampleGroup} onClick={()=>setExampleGroup(group)}>{group}</button>)}</div>
         <div className="agent-example-options">{agentExamples.filter(x=>x.group===exampleGroup).map(example=><button type="button" disabled={busy} key={example.title} onClick={()=>pickExample(example)} title={example.text}>{example.title}</button>)}{exampleGroup==='저장·발행'&&<><button type="button" disabled={busy||!!id} onClick={()=>{setPublish(false);setInput('이미지 허브의 파크골프 사진으로 초보자용 블로그를 만들고 검수 후 초안으로 저장해줘.');}}>초안으로 만들기</button><button type="button" disabled={busy||!!id} onClick={()=>{setPublish(true);setInput('이미지 허브의 파크골프 사진으로 블로그를 만들고 검수 후 공개 발행해줘.');}}>생성 후 공개 발행</button><p>완료된 초안은 아래 ‘미리보기’에서 확인하고 ‘이 원고 발행’으로 공개할 수 있습니다. 새 글 작성 시 자동 발행 옵션도 선택할 수 있습니다.</p></>}</div></div>
        {job&&<div className="agent-job-status" role="status"><b>{job.stageLabel}</b><span>{Math.min(job.stage+1,6)} / 6 단계</span>{job.status==='done'&&job.content&&<button type="button" onClick={()=>setPreview(true)}>원고 미리보기·비교</button>}{job.status==='done'&&!job.projectId&&job.content&&<button type="button" disabled={busy} onClick={()=>void send('이 초안을 공개 발행하고 저장 결과를 확인해줘.',false,'publish')}>이 원고 발행</button>}{job.status==='done'&&job.projectId&&job.snapshot===undefined&&<a href={`/content/${job.projectId}`} target="_blank" rel="noreferrer">공개 글 보기</a>}{job.status==='done'&&job.projectId&&(job as any).canUndo&&<button type="button" disabled={busy} onClick={()=>void send('이 작업 직전 원고와 사진으로 되돌려줘.',false,'undo')}>수정 전으로 되돌리기</button>}{(['failed','paused'].includes(job.status)||(!busy&&['queued','running'].includes(job.status)))&&<button type="button" onClick={()=>void resume()}>이어하기</button>}</div>}
        {!id&&<label className="agent-publish-option"><input type="checkbox" checked={publish} disabled={busy} onChange={e=>setPublish(e.target.checked)}/>생성·검수 후 자동 공개 발행 <small>선택하지 않으면 초안으로 저장</small></label>}
        <form className="review-compose" onSubmit={event=>{event.preventDefault();void send();}}><input ref={inputRef} value={input} maxLength={2000} onChange={event=>setInput(event.target.value)} disabled={busy||loadingHistory} placeholder={selected?'예: 이 글을 친근한 문체로 수정하고 저장해줘':'예: 이미지 허브의 파크골프 사진으로 초보자용 블로그 만들어줘'} aria-label="블로그 에이전트 명령"/><button disabled={!input.trim()||busy||loadingHistory||!threadId} aria-label="명령 보내기">{busy?<Loader2 className="spin"/>:<Send/>}</button></form>
        <AgentVoice disabled={busy||loadingHistory} tokenFetch={tokenFetch} onText={text=>{setInput(text);inputRef.current?.focus();}}/>
      </div>
    </div>
    {jobs.length>0&&<details className="agent-history"><summary>작업 기록 · {jobs.length}건</summary><div>{jobs.slice(0,10).map(next=><button type="button" key={next.id} disabled={busy} onClick={()=>void openJob(next)}><b>{next.content?.title||next.message.slice(0,45)}</b><small>{next.stageLabel} · {new Date(next.createdAt).toLocaleString('ko-KR')}</small></button>)}</div></details>}
    <Dialog open={preview} onOpenChange={setPreview}><DialogContent className="agent-preview-dialog"><DialogTitle>원고 미리보기 · 변경 내용</DialogTitle>{job?.content&&<><p>{job.changes?.join(' / ')||'원고의 검수 결과를 확인해주세요.'}</p><h2>{job.content.title}</h2><p>{job.content.intro}</p>{images.find(x=>x.id===job.imageIds[0])&&<img src={images.find(x=>x.id===job.imageIds[0])?.url} alt="대표 이미지"/>}{job.content.sections?.map((section:any,index:number)=><section key={index}><h3>{section.heading}</h3><ContentBody body={section.body} blocks={section.blocks}/>{images.find(x=>x.id===job.imageIds[section.imageIndex])&&<img src={images.find(x=>x.id===job.imageIds[section.imageIndex])?.url} alt={section.caption||section.heading}/>}</section>)}<p>{job.content.closing}</p><details><summary>수정 전후 원고 비교</summary><div className="agent-compare"><div><b>수정 전</b><pre>{(job as any).beforeText||'신규 생성 또는 원본이 없는 작업입니다.'}</pre></div><div><b>작업 후</b><pre>{[job.content.title,job.content.intro,...(job.content.sections||[]).map((x:any)=>`${x.heading}\n${x.body}`),job.content.closing].join('\n\n')}</pre></div></div></details></>}</DialogContent></Dialog>
    {result && <section className="review-report"><div className="review-report-head"><div><span>REVIEW RESULT</span><h3>검수 결과 <small>{result.issues.length}건</small></h3></div><div className="review-report-actions">{sections.length > 0 && <button type="button" onClick={() => openImageEditor()}><ImageIcon/> 이미지 바꾸기</button>}<button type="button" onClick={() => onEdit(id)}>원고 수정하기 <ArrowRight/></button></div></div><p className="review-boundary">글에 적힌 사실의 진위와 실제 이미지 파일의 표시 상태는 이 검수만으로 확정할 수 없습니다. 확인이 필요한 항목은 원문과 외부 근거를 직접 대조하세요.</p>{result.issues.length ? <div className="review-issues">{result.issues.map((issue, i) => <article key={`${issue.location}-${i}`} className={issue.severity}><div><span>{issue.severity === "block" ? "우선 확인" : "수정 권장"}</span><b>{issue.category} · {issue.location}</b></div>{issue.excerpt && <blockquote>{issue.excerpt}</blockquote>}<p>{issue.reason}</p><small><Check/> {issue.suggestion}</small>{issue.category.includes("이미지") && sections.length > 0 && <button type="button" className="review-fix-image" onClick={() => openImageEditor(issue)}>이미지 허브에서 바꾸기 <ArrowRight/></button>}</article>)}</div> : <div className="review-no-issues"><Check/> 이번 검수에서 구조나 표현 문제를 찾지 못했습니다.</div>}</section>}
    <Dialog open={!!selected && imageEditor} onOpenChange={open => { if (!applying) setImageEditor(open); }}><DialogContent className="review-image-dialog" showCloseButton={!applying}>{selected && <div className="review-image-editor"><div className="review-report-head"><div><span>IMAGE HUB</span><DialogTitle>본문 이미지 교체</DialogTitle></div></div><label className="review-section-select">교체할 본문 섹션<select value={sectionIndex} onChange={event => { setSectionIndex(Number(event.target.value)); setChosenImageId(""); setImageError(""); }}>{sections.map((section, index) => <option value={index} key={index}>{index + 1}. {section.heading}</option>)}</select></label><p className="review-current-image">현재 이미지: {selected.imageTitles[oldIndex] || "이미지 없음"} · 이미지 허브의 {images.length}개 중 선택</p>{recommendation?.reason && <p className="review-recommendation"><Sparkles/> 에이전트 추천: {recommendation.reason}</p>}{images.length ? <div className="review-image-grid">{sortedImages.map(image => <button type="button" key={image.id} className={`review-image-option ${chosenImageId === image.id ? "selected" : ""}`} aria-pressed={chosenImageId === image.id} onClick={() => setChosenImageId(image.id)}><img src={image.url} alt={image.title}/><strong>{image.title}</strong>{recommendation?.candidateIds.includes(image.id) && <span>추천</span>}</button>)}</div> : <p className="review-image-empty">이미지 허브에서 공개 이미지를 불러오지 못했습니다. 이미지 공개 설정을 확인한 뒤 새로고침해주세요.</p>}{willReplaceSlot && <p className="review-impact"><AlertCircle/> 선택된 이미지가 이미 6장이라 현재 이미지 자리를 교체합니다.{affectsCover ? " 대표 이미지도 함께 바뀝니다." : ""}{affectedSections ? ` 다른 본문 ${affectedSections}곳도 함께 바뀝니다.` : ""}</p>}{imageError && <p className="review-error"><AlertCircle/>{imageError}</p>}<div className="review-image-actions"><a href={`/content/${selected.id}`} target="_blank" rel="noreferrer">현재 공개 글 보기</a><button type="button" disabled={!chosenImageId || applying} onClick={applyImage}>{applying ? <Loader2 className="spin"/> : <Check/>} {applying ? "공개 글 수정 중..." : "이 이미지로 변경·저장"}</button></div></div>}</DialogContent></Dialog>
  </section>;
}
