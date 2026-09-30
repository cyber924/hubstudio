import {firestoreDocuments,firestoreKey} from "./review-auth";

type StoredMessage={id:string;role:"user"|"assistant";kind:string;text:string;result?:unknown;createdAt:string};

/** Each message is a separate owner-only Firebase record; no platform-local DB. */
export async function loadReviewMessages(uid:string,articleId:string,token:string):Promise<StoredMessage[]> {
 const response=await fetch(`${firestoreDocuments}:runQuery?key=${firestoreKey}`,{
  method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
  body:JSON.stringify({structuredQuery:{from:[{collectionId:"contentProjects"}],where:{compositeFilter:{op:"AND",filters:[
   {fieldFilter:{field:{fieldPath:"ownerId"},op:"EQUAL",value:{stringValue:uid}}},
   {fieldFilter:{field:{fieldPath:"articleId"},op:"EQUAL",value:{stringValue:articleId}}},
   {fieldFilter:{field:{fieldPath:"recordType"},op:"EQUAL",value:{stringValue:"reviewMessage"}}}
  ]}}}})
 });
 if(!response.ok)throw new Error(`Review history read failed (${response.status})`);
 const rows:any[]=await response.json();
 return rows.filter(row=>row.document).map(row=>{const f=row.document.fields,s=(k:string)=>f[k]?.stringValue||"";return{id:s("messageId"),role:s("role") as StoredMessage["role"],kind:s("kind"),text:s("text"),createdAt:s("createdAt"),...(s("resultJson")?{result:JSON.parse(s("resultJson"))}:{})}}).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)).slice(-500);
}
export async function saveReviewMessage(uid:string,articleId:string,message:StoredMessage,token:string){
 const id=`review_${articleId}_${message.id}`;
 const data:Record<string,string>={ownerId:uid,articleId,recordType:"reviewMessage",messageId:message.id,role:message.role,kind:message.kind,text:message.text,createdAt:message.createdAt,...(message.result?{resultJson:JSON.stringify(message.result)}:{})};
 const fields=Object.fromEntries(Object.entries(data).map(([key,value])=>[key,{stringValue:value}]));
 const response=await fetch(`${firestoreDocuments}/contentProjects?documentId=${encodeURIComponent(id)}&key=${firestoreKey}`,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({fields})});
 // Retries use a stable document ID and cannot create duplicate messages.
 if(!response.ok&&response.status!==409)throw new Error(`Review history save failed (${response.status})`);
}
