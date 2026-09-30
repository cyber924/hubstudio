# 허브 스튜디오 · GitHub → Vercel 배포

블로그·상세페이지·전자책·보고서 제작과 블로그 검수 서비스입니다. 기본 실행은 Next.js 16 App Router이며, Vercel의 Node.js Functions를 사용합니다. 로그인·이미지·발행 콘텐츠·새 검수 대화 기록은 기존 Firebase 프로젝트를 사용합니다.

## 배포 순서

1. 이 폴더의 **내용**을 GitHub 저장소 루트에 올립니다. `package.json`, `app/`, `vercel.json`이 같은 루트에 있어야 합니다. `node_modules`, `.next`, `dist`, `.env.local`은 업로드하지 않습니다.
2. Vercel에서 Add New → Project → 해당 GitHub 저장소를 Import 합니다.
3. Framework Preset은 **Next.js**, Node.js는 **22.x**를 선택합니다. 저장소 루트에 파일을 올렸으면 Root Directory는 기본값입니다. 폴더째 올렸으면 그 폴더를 Root Directory로 지정합니다.
4. Install Command: `npm ci`, Build Command: `npm run build`, Output Directory: **기본값 / 비워두기**. `dist`나 `out`을 지정하지 않습니다. 정적 export나 SPA rewrite는 사용하지 않습니다.
5. 환경 변수 `GEMINI_API_KEY`에 실제 Gemini API 키를 넣습니다. Production과 필요한 Preview 환경에 설정합니다. 서버 전용 키이므로 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.
6. `SITE_URL`에 최종 주소(예: `https://your-domain.co.kr`)를 입력합니다. 경로 없이 도메인만 입력합니다. 생략하면 Vercel 시스템의 `VERCEL_PROJECT_PRODUCTION_URL`을 사용합니다. 커스텀 도메인을 연결했다면 `SITE_URL` 설정 후 재배포합니다.
7. Deploy를 실행합니다. 이후 GitHub 기본 브랜치에 push하면 Vercel이 자동으로 빌드·배포합니다.

`vercel.json`이 프레임워크와 설치·빌드 명령을 지정합니다. 7개의 API 경로는 Node.js 런타임과 최대 300초 실행 설정을 사용합니다. 실제 실행 한도는 Vercel 프로젝트 설정·플랜의 영향을 받습니다. API 호출이 포함되므로 static export로 바꾸면 안 됩니다.

## Firebase 연결과 검수 대화

기존 Firebase 프로젝트 `studio-9240700230-1dd9a`를 그대로 사용하므로 이미지·발행 글을 다시 만들 필요가 없습니다. 기존 공개 조회 규칙과 본인 문서 쓰기 규칙을 유지합니다. 이메일/비밀번호 로그인 방식도 동일합니다. Firebase Authentication에서 새 배포 도메인을 승인된 도메인에 추가하고, 공개 Firebase API 키에 웹사이트 제한을 설정했다면 새 도메인을 포함합니다.

검수 대화는 `contentProjects` 컬렉션의 `recordType: reviewMessage` 문서에 한 메시지씩 저장됩니다. 본인 Firebase ID 토큰으로만 읽고 씁니다. 블로그 소유자를 먼저 확인한 뒤 대화에 접근하며, 고정 메시지 ID로 중복 저장을 방지합니다. 이미지 본문은 대화 기록에 중복 저장하지 않습니다. 조회는 최근 500개 메시지를 반환합니다.

`contentProjects`에 본인 문서 read/create/update/delete 규칙이 이미 있다면 추가 작업이 필요 없습니다. 권한 오류가 나면 `firebase-review.rules.snippet`을 참고해 해당 컬렉션의 규칙을 기존 전체 규칙에 병합합니다. **이 파일만으로 전체 규칙을 덮어쓰지 않습니다.**

기존 Cloudflare D1에 저장된 과거 검수 대화는 자동으로 복사되지 않습니다. 기존 서비스에 보존되며, Vercel에서는 새로 저장되는 Firebase 대화를 이어 사용합니다. 과거 대화까지 이전하려면 D1 데이터를 별도로 내보내 본인 소유 Firebase 문서로 변환해야 합니다. 발행 글과 이미지 DB에는 영향이 없습니다.

## 로컬 실행

```sh
npm ci
# .env.example을 .env.local로 복사한 후 서버 키를 설정
npm run dev
npm run typecheck
npm run build
npm start
```

모바일 메뉴는 760px 이하에서 서랍 형태로 표시됩니다. 배경 터치·닫기 버튼·Escape로 닫을 수 있고, 메뉴를 선택하면 자동으로 닫힙니다. 열린 동안 배경 스크롤과 포커스를 제한합니다. 제작 모드는 모바일에서 2열로 표시하고 입력 글자 크기는 16px로 유지합니다.

## 배포 후 확인

- 비로그인 공개 콘텐츠와 상세 URL(`/content/문서ID`) 직접 열기
- 로그인 → 이미지 목록 → 콘텐츠 생성 → 저장 → 공개 결과 확인
- 블로그 검수 → 자동 이미지 수정 → 완료 보고 → 새로고침 후 대화 복원
- `/robots.txt`, `/sitemap.xml`, 상세 페이지 canonical의 최종 도메인 확인
- 휴대폰에서 메뉴 열기·닫기, 제작 화면 입력, PDF 인쇄 확인

Gemini 실호출과 Firebase 본인 계정 쓰기는 환경 변수·로그인·DB 규칙 설정 후 최종 배포에서 확인해야 합니다. Vercel 계정이나 GitHub 저장소에 이 소스가 자동 업로드되는 것은 아닙니다.

## 기존 Sites 실행 유지

기존 Cloudflare 호스팅을 재사용할 경우에만 `npm run build:sites`, `npm run dev:sites`, `npm run start:sites`를 사용합니다. Vercel 배포는 위의 기본 명령만 사용합니다. Cloudflare 지원 파일들은 기본 Next.js 실행 경로에서 참조하지 않습니다.
