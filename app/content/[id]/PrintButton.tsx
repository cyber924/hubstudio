"use client";
import {Printer} from "lucide-react";
export default function PrintButton(){return <button className="ebook-print" title="인쇄 창에서 PDF로 저장을 선택하세요" onClick={()=>window.print()}><Printer/> PDF 다운로드</button>}
