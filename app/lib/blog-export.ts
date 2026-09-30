export type ExportImage={src:string;name:string;alt:string};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const safeUrl=(s:string)=>{try{const u=new URL(s,location.origin);return u.protocol==='https:'||u.protocol==='http:'?u.href:'';}catch{return '';}};
/** Export the already-rendered document so legacy and structured content stay identical. */
export function buildBlogExport(main:HTMLElement,mode:'naver'|'tistory'){
  const clone=main.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('header,footer,button,script,style,svg,.back-to-toc,.document-jump,.reading-progress,[data-export-ignore]').forEach(n=>n.remove());
  const images:ExportImage[]=[];
  clone.querySelectorAll('img').forEach((img,i)=>{
    const src=safeUrl(img.getAttribute('src')||''),alt=img.alt||`본문 이미지 ${i+1}`,name=`${String(i+1).padStart(2,'0')}-${i===0?'대표이미지':'본문이미지'}`;
    if(!src)throw new Error(`${i+1}번 이미지 주소를 확인할 수 없습니다.`);
    images.push({src,name,alt});
    if(mode==='naver'){const p=document.createElement('p');p.textContent=`[사진 ${String(i+1).padStart(2,'0')} 삽입 · ${name} · ${alt}]`;img.replaceWith(p);}
    else img.setAttribute('src',src);
  });
  const allowed=new Set(['H1','H2','H3','P','BR','B','STRONG','I','EM','U','UL','OL','LI','BLOCKQUOTE','TABLE','THEAD','TBODY','TR','TH','TD','IMG','A']);
  const blocks=new Set(['DIV','SECTION','ARTICLE','MAIN','NAV','ASIDE','FIGURE','FIGCAPTION','DETAILS','SUMMARY','DL','DT','DD']);
  const style:Record<string,string>={H1:'font-size:24px;font-weight:700;line-height:1.5;margin:20px 0;',H2:'font-size:21px;font-weight:700;line-height:1.6;margin:28px 0 12px;',H3:'font-size:18px;font-weight:700;margin:20px 0 10px;',P:'margin:12px 0;line-height:1.9;',IMG:'display:block;max-width:100%;height:auto;margin:20px auto;',TABLE:'width:100%;border-collapse:collapse;margin:20px 0;',TH:'border:1px solid #d1d5db;padding:10px;background:#f3f4f6;text-align:left;',TD:'border:1px solid #d1d5db;padding:10px;',BLOCKQUOTE:'border-left:4px solid #7357ff;padding:12px 16px;margin:20px 0;background:#f5f3ff;'};
  function render(n:Node):string{
    if(n.nodeType===3)return escape(n.textContent||'');
    if(n.nodeType!==1)return '';
    const el=n as HTMLElement,tag=el.tagName,children=()=>Array.from(el.childNodes).map(render).join('');
    if(tag==='IMG')return `<img src="${escape(safeUrl(el.getAttribute('src')||''))}" alt="${escape(el.getAttribute('alt')||'')}" style="${style.IMG}">`;
    if(tag==='BR')return '<br>';
    if(tag==='A'){const href=el.getAttribute('href')||'';return href.startsWith('#')?`<p>${children()}</p>`:safeUrl(href)?`<a href="${escape(safeUrl(href))}">${children()}</a>`:children();}
    if(allowed.has(tag))return `<${tag.toLowerCase()}${style[tag]?` style="${style[tag]}"`:''}>${children()}</${tag.toLowerCase()}>`;
    if(blocks.has(tag))return `<div style="margin:12px 0;">${children()}</div>`;
    return children();
  }
  const html=`<div style="font-family:Arial,'맑은 고딕',sans-serif;font-size:16px;line-height:1.9;color:#222;max-width:800px;margin:0 auto;">${Array.from(clone.childNodes).map(render).join('')}</div>`;
  // Make plain-text clipboard fallback readable, including lists and tables.
  const textClone=clone.cloneNode(true) as HTMLElement;
  textClone.querySelectorAll('br').forEach(n=>n.replaceWith(document.createTextNode('\n')));
  textClone.querySelectorAll('li').forEach(n=>n.prepend('• '));
  textClone.querySelectorAll('th,td').forEach(n=>n.append('\t'));
  textClone.querySelectorAll('h1,h2,h3,p,div,section,article,nav,aside,figure,figcaption,details,summary,dt,dd,li,tr,blockquote').forEach(n=>n.append('\n\n'));
  return {html,text:(textClone.textContent||'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim(),images};
}
