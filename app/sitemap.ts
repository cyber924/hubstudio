import type {MetadataRoute} from 'next';
import {getPublicContents} from './lib/public-content';
import {siteOrigin} from './lib/site-origin';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 const base=siteOrigin(),posts=await getPublicContents();
 return [{url:base,changeFrequency:'daily',priority:1},...posts.map((p:any)=>({url:`${base}/content/${p.id}`,...(p.updatedAt||p.publishedAt?{lastModified:new Date(p.updatedAt||p.publishedAt)}:{}),changeFrequency:'weekly' as const,priority:.8}))];
}
