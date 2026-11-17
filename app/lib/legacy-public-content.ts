/**
 * Compatibility pointers for seven archived HubStudio6 publications.
 * These originals were verified on https://hubstudio6.vercel.app on 2026-11-18.
 * The incomplete Firestore imports are kept untouched; only public display
 * and navigation are repaired without fabricating text or image references.
 */
const SOURCE = "https://hubstudio6.vercel.app";
const legacy: Record<string, { path: string; cover: string; description: string }> = {
  "hub6-post-00000008": {
    path: "/blog/08",
    cover: "/api/media/hub/vizbot_f8d201c94e2a38f52043a06284fbd5834450557f6d309d3ad7bf4fa1126e6ed2",
    description: "바쁜 일상에서 벗어나 사랑하는 사람과 떠나는 감성 오션뷰 기차 여행. 차창 밖으로 펼쳐지는 푸른 바다와 기차역 주변의 호젓한 산책로를 걸으며 잊지 못할 주말의 추억을 만들어보세요.",
  },
  "hub6-post-00000007": {
    path: "/sns/07",
    cover: "/api/media/hub/7iLRc6oD_1790047395985",
    description: "연말정산이 낯선 사회초년생과 직장인을 위한 기초 가이드. 홈택스 간소화 서비스와 제출 항목을 정리합니다.",
  },
  "hub6-post-00000006": {
    path: "/report/06",
    cover: "/api/media/hub/7iLRc6oD_1791768274413",
    description: "1인 가구의 증가로 변화하는 소포장 식품과 간편식 시장을 분석하고 유통 방향을 제안합니다.",
  },
  "hub6-post-00000005": {
    path: "/article/05",
    cover: "/api/media/hub/7iLRc6oD_1790405033478",
    description: "스마트폰으로 인한 디지털 피로를 줄이는 디지털 미니멀리즘과 홈화면 정리 실천 가이드.",
  },
  "hub6-post-00000004": {
    path: "/blog/04",
    cover: "/api/media/hub/vizbot_25399a703b2f6fc89897cf5d4be8f080fe6bb1d313f0b5d5bf49288bb0ece6ab",
    description: "쉼과 회복을 테마로 한 2박 3일 힐링 여행 일정과 실용적인 준비 팁.",
  },
  "hub6-post-00000002": {
    path: "/article/02",
    cover: "/api/media/hub/7iLRc6oD_1790639331749",
    description: "디카페인 커피의 카페인 함량과 추출 방식, 관련 기준을 설명합니다.",
  },
  "hub6-post-00000001": {
    path: "/blog/01",
    cover: "/api/media/hub/7iLRc6oD_1790057732669",
    description: "감성적인 인테리어와 향긋한 커피를 찾아 떠나는 여유로운 카페 탐방기.",
  },
};

export function legacyHub6Content(id: string) {
  const entry = legacy[id];
  if (!entry) return null;
  return {
    sourceUrl: SOURCE + entry.path,
    coverUrl: SOURCE + entry.cover,
    description: entry.description,
  };
}
