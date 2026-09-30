import type { Metadata } from "next"; import "./globals.css";
export const metadata:Metadata={title:"허브스튜디오 | 전문 이미지로 완성하는 고품질 콘텐츠",description:"전문 이미지를 활용해 블로그, 상세페이지, 전자책, 보고서를 빠르고 편리하게 제작·편집·발행하는 콘텐츠 워크스페이스입니다.",keywords:["콘텐츠 제작","이미지 콘텐츠","블로그 제작","상세페이지 제작","전자책 제작","보고서 제작"],icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"}};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="ko"><body>{children}</body></html>}
