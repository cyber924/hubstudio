import type {Metadata} from 'next';
import HomeClient from './HomeClient';
import {getPublicContents} from './lib/public-content';
import {siteOrigin} from './lib/site-origin';
export const dynamic='force-dynamic';
export const metadata:Metadata={alternates:{canonical:siteOrigin()},openGraph:{type:'website',url:siteOrigin(),title:'허브스튜디오 | 전문 이미지로 완성하는 고품질 콘텐츠'}};
export default async function Home(){
 const posts=await getPublicContents();
 const schema={'@context':'https://schema.org','@type':'CollectionPage',name:'허브스튜디오 공개 콘텐츠',url:siteOrigin(),mainEntity:{'@type':'ItemList',itemListElement:posts.map((p:any,i:number)=>({'@type':'ListItem',position:i+1,url:`${siteOrigin()}/content/${p.id}`,name:p.title}))}};
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/><HomeClient initialPublished={posts}/></>;
}
