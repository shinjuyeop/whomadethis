# whomadethis

친구들과 함께 방문한 음식점을 전국 지도에 등록하고 사진, 별점, 후기를 공유하기 위한 웹앱입니다. 현재 저장소는 이후 음식점 등록, 지도 마커, 리뷰, 사진, 인증 기능을 안정적으로 확장하기 위한 초기 개발 기반입니다.

## 기술 스택

- React, Vite, TypeScript
- NAVER Maps JavaScript API
- NAVER API HUB 지역 검색 API
- Supabase
- Vercel
- GitHub

## 로컬 실행

Node.js와 npm이 설치된 환경에서 다음 명령을 실행합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

기본 검증 명령은 다음과 같습니다.

```bash
npm run lint
npm run build
npm run preview
```

Vite 개발 서버만 실행하면 `/api` Vercel 함수가 제공되지 않습니다. 지역 검색까지 로컬에서 함께 확인하려면 Vercel CLI 환경에서 `vercel dev`를 사용하거나 배포 환경에서 확인하세요.

## 환경변수

`.env.example`을 `.env.local`로 복사한 뒤 발급받은 값을 직접 설정합니다. 값이 없는 상태에서도 프론트엔드는 설정 안내를 표시하며 종료되지 않습니다.

| 변수 | 실행 위치 | 용도 |
| --- | --- | --- |
| `VITE_NAVER_MAP_CLIENT_ID` | 브라우저 | NAVER Maps JavaScript API |
| `NAVER_API_HUB_CLIENT_ID` | 서버 전용 | NAVER API HUB 지역 검색 인증 |
| `NAVER_API_HUB_CLIENT_SECRET` | 서버 전용 | NAVER API HUB 지역 검색 인증 |
| `VITE_SUPABASE_URL` | 브라우저 | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 브라우저 | Supabase publishable key |

NAVER Maps와 NAVER API HUB는 서로 다른 서비스의 인증정보를 사용합니다. 지도 Client ID를 API HUB 검색 인증에 재사용하지 마세요. API HUB Client ID와 Client Secret에는 `VITE_` 접두사를 붙이지 않으며, `api/naver-search.ts` 서버 함수에서만 읽습니다.

`VITE_`로 시작하는 값은 브라우저 번들에 포함될 수 있습니다. Supabase에는 publishable key만 사용하며 `service_role` 또는 secret key를 이 프로젝트에 넣지 마세요.

> `.env.local`, 실제 API 키, Client Secret 등 인증정보는 절대 Git에 커밋하지 마세요. 환경변수 파일은 `.gitignore`에서 제외되며 `.env.example`에는 변수 이름만 유지합니다.

## 현재 구현 상태

- 서울시청을 중심으로 시작하는 재사용 가능한 NAVER 지도 로더와 화면 컴포넌트
- 설정 누락 및 지도 로딩 실패를 안내하는 안전한 fallback UI
- `GET /api/naver-search?q=검색어` 형식의 Vercel 지역 검색 proxy
- NAVER API HUB 인증정보를 서버 환경변수로만 전달하는 구조
- 지연 생성 방식의 Supabase 브라우저 client 모듈
- 음식점 검색 입력, 검색 결과 골격, 개발 설정 상태 UI
- React Router 기본 라우팅 및 반응형 초기 레이아웃

DB 스키마, RLS 정책, 로그인, 음식점 저장, 사진 업로드, 리뷰, 지도 마커는 다음 단계에서 구현합니다.
