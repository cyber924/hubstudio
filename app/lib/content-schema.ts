import {documentBlocks,blocksToText} from './content-blocks';
export function contentSchema(p:any,site:string){
 const c=p.content,url=`${site}/content/${encodeURIComponent(p.id)}`,rows=c.sections||c.chapters||c.reportSections||[];
 const text=[c.intro,c.executiveSummary,...rows.map((r:any)=>[r.heading||r.title,r.summary,blocksToText(documentBlocks(r.body,r.blocks))].filter(Boolean).join('\n')),c.closing].filter(Boolean).join('\n\n');
 const type=p.type==='ebook'?'Book':p.type==='report'?'Report':p.type==='product'?'CreativeWork':p.sourceType==='article'?'Article':p.sourceType==='sns'?'SocialMediaPosting':'BlogPosting';
 return {'@context':'https://schema.org','@type':type,'@id':url+'#content',url,name:p.title,headline:p.title,description:String(c.description||c.intro||p.title).slice(0,320),inLanguage:'ko-KR',mainEntityOfPage:{'@type':'WebPage','@id':url},author:{'@type':'Organization',name:'허브스튜디오 편집실',url:site},publisher:{'@type':'Organization',name:'허브스튜디오',url:site},...(p.publishedAt?{datePublished:p.publishedAt}:{}),...(p.updatedAt?{dateModified:p.updatedAt}:{}),...(p.imageUrls.length?{image:p.imageUrls.map((x:string)=>site+x)}:{}),...(type==='Book'?{bookFormat:'https://schema.org/EBook',hasPart:rows.map((r:any)=>({'@type':'Chapter',name:r.title}))}:{...(type!=='CreativeWork'?{articleBody:text}:{text})})};
}
