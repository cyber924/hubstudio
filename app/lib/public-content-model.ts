/** Read compatibility only: never changes the original Firestore document. */
export function publicKeyword(value: unknown, fallback = ""): string {
 const text=typeof value==='string'?value.trim():'';
 if(text.length>200||text.includes('초안 생성 요청 처리 완료'))return fallback.trim().slice(0,80);
 return text.slice(0,80);
}
export function normalizeContent(input:any,imageIds:string[]=[]):any {
 const c=input&&typeof input==='object'&&!Array.isArray(input)?{...input}:{};
 const rows=(items:any)=>Array.isArray(items)?items.map((row:any)=>{
  const s={...row};
  if(typeof s.body!=='string')s.body=Array.isArray(s.paragraphs)?s.paragraphs.filter((v:any)=>typeof v==='string').join('\n\n'):typeof s.content==='string'?s.content:'';
  if(typeof s.imageId==='string')s.imageIndex=imageIds.indexOf(s.imageId);
  return s;
 }):[];
 for(const key of ['sections','chapters','reportSections'])if(c[key])c[key]=rows(c[key]);
 c.closing=typeof c.closing==='string'?c.closing:typeof c.summary==='string'?c.summary:'';
 c.tags=Array.isArray(c.tags)?c.tags.filter((v:any)=>typeof v==='string'):[];
 return c;
}
export function decodePublicContent(doc:any,now=Date.now()):any|null {
 const f=doc?.fields||{},s=(k:string)=>f[k]?.stringValue||f[k]?.timestampValue||'',a=(k:string)=>(f[k]?.arrayValue?.values||[]).map((x:any)=>x.stringValue).filter(Boolean);
 if(s('visibility')!=='public'||s('type')==='shorts'||['draft','deleted','archived'].includes(s('status')))return null;
 const release=s('publishAt')||s('publishedAt');if(release&&(!Number.isFinite(Date.parse(release))||Date.parse(release)>now))return null;
 let raw:any;try{raw=JSON.parse(s('contentJson')||'{}');}catch{throw new Error('공개 원고 JSON을 확인해주세요: '+doc.name?.split('/').pop());}
 const id=doc.name?.split('/').pop();if(!id)throw new Error('공개 문서 ID가 없습니다.');
 let imageIds=a('imageIds');if(!imageIds.length)imageIds=[...new Set((raw.sections||[]).map((r:any)=>r.imageId).filter((x:any)=>typeof x==='string'))] as string[];
 const content=normalizeContent(raw,imageIds),title=s('title')||content.title||'제목 없는 콘텐츠';
 const sourceType=s('type')||'blog',type=['blog','product','ebook','report'].includes(sourceType)?sourceType:'blog';
 return {id,ownerId:s('ownerId'),type,sourceType,title,keyword:publicKeyword(s('keyword'),title),tone:s('tone'),status:'published',imageIds,imageTitles:a('imageTitles'),imageUrls:imageIds.map((_:string,i:number)=>`/api/content-images/${encodeURIComponent(id)}/${i}`),content,createdAt:s('createdAt'),updatedAt:s('updatedAt')||release,publishedAt:release};
}
