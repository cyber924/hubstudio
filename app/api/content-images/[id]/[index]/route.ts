import {firestoreDocuments, firestoreKey, documentField} from "../../../../lib/review-auth";
export const runtime = "nodejs";
export async function GET(_request: Request, {params}: {params: Promise<{id:string;index:string}>}) {
  const {id,index}=await params;
  if (!/^[\w-]{1,128}$/.test(id)||!/^\d{1,3}$/.test(index)) return new Response("Not found",{status:404});
  try {
    const articleResponse=await fetch(`${firestoreDocuments}/publishedContents/${id}?key=${firestoreKey}`,{cache:"no-store"});
    if(!articleResponse.ok)return new Response("Not found",{status:404});
    const article:any=await articleResponse.json(),fields=article.fields||{};
    if(documentField(fields,"visibility")!=="public")return new Response("Not found",{status:404});
    const imageId=fields.imageIds?.arrayValue?.values?.[Number(index)]?.stringValue;
    if(!imageId)return new Response("Not found",{status:404});
    const imageResponse=await fetch(`${firestoreDocuments}/images/${encodeURIComponent(imageId)}?key=${firestoreKey}`,{cache:"no-store"});
    if(!imageResponse.ok)return new Response("Image unavailable",{status:404});
    const image:any=await imageResponse.json(),f=image.fields||{};
    const src=documentField(f,"dataUrl")||documentField(f,"imageUrl")||documentField(f,"url");
    const match=/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(src);
    if(match){
      if(match[2].length>14_000_000)return new Response("Image too large",{status:413});
      const bytes=Buffer.from(match[2],"base64");
      return new Response(bytes,{headers:{"Content-Type":match[1],"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    if(/^https:\/\//.test(src))return Response.redirect(src,302);
    return new Response("Image unavailable",{status:404});
  }catch{return new Response("Image temporarily unavailable",{status:502});}
}
