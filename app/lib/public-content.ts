import {cache} from 'react';
import {decodePublicContent} from './public-content-model';
const DB='https://firestore.googleapis.com/v1/projects/studio-9240700230-1dd9a/databases/(default)/documents',KEY='AIzaSyDEpFAsf1fI65xXklKYsukAWFYw5bzaHyc';
export const getPublicContents=cache(async()=>{
 const documents:any[]=[];let cursor:string|undefined;
 do {
  const query:any={from:[{collectionId:'publishedContents'}],where:{fieldFilter:{field:{fieldPath:'visibility'},op:'EQUAL',value:{stringValue:'public'}}},orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:100};
  if(cursor)query.startAt={values:[{referenceValue:cursor}],before:false};
  const r=await fetch(`${DB}:runQuery?key=${KEY}`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:query}),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(`공개 콘텐츠 조회 실패 (${r.status})`);
  const rows:any=await r.json();const batch=rows.filter((x:any)=>x.document).map((x:any)=>x.document);documents.push(...batch);cursor=batch.length===100?batch.at(-1).name:undefined;
 }while(cursor);
 return documents.map(doc=>decodePublicContent(doc)).filter(Boolean).sort((a:any,b:any)=>(b.publishedAt||b.updatedAt).localeCompare(a.publishedAt||a.updatedAt));
});
export const getPublicContent=cache(async(id:string)=>{
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))return null;
 const r=await fetch(`${DB}/publishedContents/${encodeURIComponent(id)}?key=${KEY}`,{cache:'no-store',signal:AbortSignal.timeout(20000)});
 if([403,404].includes(r.status))return null;
 if(!r.ok)throw new Error(`공개 원고 조회 실패 (${r.status})`);
 return decodePublicContent(await r.json());
});
