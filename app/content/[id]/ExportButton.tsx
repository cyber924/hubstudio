"use client";
import {useEffect,useState} from "react";
import {Download,Copy,Share2} from "lucide-react";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {buildBlogExport} from "../../lib/blog-export";
import {imageZip} from "../../lib/export-zip";
const KEY="hubstudio_session",FIREBASE_KEY="AIzaSyDEpFAsf1fI65xXklKYsukAWFYw5bzaHyc";
export default function ExportButton({ownerId}:{ownerId:string}){
  const [owner,setOwner]=useState(false),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[manual,setManual]=useState('');
  useEffect(()=>{let active=true;async function check(){
    try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(!s||s.localId!==ownerId)return;
      if(!s.expiresAt||s.expiresAt<Date.now()){
        if(!s.refreshToken)return;
        const r=await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_KEY}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:s.refreshToken})}),d:any=await r.json();if(!r.ok)return;
        s.idToken=d.id_token;s.localId=d.user_id;s.refreshToken=d.refresh_token;s.expiresAt=Date.now()+Number(d.expires_in)*1000-60000;localStorage.setItem(KEY,JSON.stringify(s));
      }
      const r=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:s.idToken})}),d:any=await r.json();
      if(active)setOwner(r.ok&&d.users?.[0]?.localId===ownerId);
    }catch{if(active)setOwner(false);}}
    check();return()=>{active=false;};
  },[ownerId]);
  if(!owner)return null;
  function content(mode:'naver'|'tistory'){const main=document.querySelector('main');if(!main)throw new Error('본문을 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.');return buildBlogExport(main,mode);}
  async function verifyImages(images:{src:string;name:string}[]){for(const image of images){const r=await fetch(image.src,{signal:AbortSignal.timeout(20000)});if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw new Error(`${image.name} 사진을 불러오지 못했습니다. 다시 시도해주세요.`);}}
  async function copy(mode:'naver'|'tistory'){
    setBusy(true);setMessage('');setManual('');
    try{const result=content(mode);
      if(mode==='tistory')await verifyImages(result.images);
      try{
        if(mode==='naver'&&typeof ClipboardItem!=='undefined'&&navigator.clipboard?.write){await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([result.html],{type:'text/html'}),'text/plain':new Blob([result.text],{type:'text/plain'})})]);}
        else await navigator.clipboard.writeText(mode==='tistory'?result.html:result.text);
        setMessage(mode==='naver'?'본문을 복사했습니다. 네이버에 붙여넣고 사진 삽입 위치에 다운로드한 이미지를 업로드하세요.':'HTML을 복사했습니다. 티스토리 HTML 모드에 붙여넣고 미리보기에서 사진을 확인하세요.');
      }catch{setManual(mode==='tistory'?result.html:result.text);setMessage('자동 복사를 사용할 수 없습니다. 아래 내용을 전체 선택해서 직접 복사하세요.');}
    }catch(e){setMessage(e instanceof Error?e.message:'복사하지 못했습니다. 다시 시도해주세요.');}finally{setBusy(false);}
  }
  async function download(){setBusy(true);setMessage('');setManual('');try{
    const {images}=content('tistory');if(!images.length){setMessage('이 콘텐츠에는 사용된 이미지가 없습니다.');return;}
    const files=[];
    for(const image of images){const r=await fetch(image.src,{signal:AbortSignal.timeout(20000)}),type=(r.headers.get('content-type')||'').split(';')[0];
      const extension:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif'};
      if(!r.ok||!extension[type])throw new Error(`${image.name} 사진 다운로드에 실패했습니다. ZIP을 만들지 않았습니다.`);
      files.push({name:`${image.name}.${extension[type]}`,bytes:new Uint8Array(await r.arrayBuffer())});
    }
    files.push({name:'사진삽입안내.txt',bytes:new TextEncoder().encode(images.map(x=>`${x.name}: ${x.alt}\n${x.src}`).join('\n\n'))});
    const data=imageZip(files),url=URL.createObjectURL(new Blob([data as BlobPart],{type:'application/zip'})),a=document.createElement('a');
    a.href=url;a.download=`${(document.querySelector('main h1')?.textContent||'콘텐츠').replace(/[\\/:*?"<>|]/g,'').slice(0,60)}-이미지.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage(`${images.length}개 이미지를 본문 순서대로 다운로드했습니다.`);
  }catch(e){setMessage(e instanceof Error?e.message:'이미지 다운로드에 실패했습니다.');}finally{setBusy(false);}}
  return <><button className="blog-export-trigger" onClick={()=>{setOpen(true);setMessage('');setManual('');}}><Share2 size={16}/>블로그로 내보내기</button>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="blog-export-dialog"><DialogHeader><DialogTitle>블로그로 내보내기</DialogTitle><DialogDescription>본문과 사진을 네이버·티스토리로 옮깁니다.</DialogDescription></DialogHeader>
    <div className="blog-export-options"><button disabled={busy} onClick={()=>copy('naver')}><Copy size={18}/><span><b>네이버용 본문 복사</b><small>붙여넣은 뒤 표시된 위치에 사진을 업로드하세요.</small></span></button><button disabled={busy} onClick={()=>copy('tistory')}><Copy size={18}/><span><b>티스토리용 HTML 복사</b><small>HTML 모드에 붙여넣으세요. 공개 이미지 주소가 포함됩니다.</small></span></button><button disabled={busy} onClick={download}><Download size={18}/><span><b>이미지 전체 다운로드</b><small>본문 순서대로 번호가 붙은 사진을 ZIP으로 받습니다.</small></span></button></div>
    <p className="blog-export-note">네이버 사진은 직접 업로드해야 안정적으로 표시됩니다. 티스토리는 스킨에 따라 간격과 글꼴이 달라질 수 있습니다.</p>
    <p role="status" aria-live="polite" className="blog-export-status">{busy?'처리 중입니다…':message}</p>
    {manual&&<textarea aria-label="직접 복사할 내용" readOnly value={manual} onFocus={e=>e.currentTarget.select()} rows={8}/>}</DialogContent></Dialog></>;
}
