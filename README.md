# whomadethis

친구들이 실제 방문한 음식점을 지도에 남기고 별점, 후기, 방문일, 사진을 함께 공유하는 웹앱입니다. 지도 탐색, 음식점별 누적 기록, 최근 Feed, 개인 방문 통계를 하나의 실시간 MVP로 제공합니다.

## 목표와 기술 스택

- React 19, Vite, TypeScript, React Router
- NAVER Maps JavaScript API v3
- NAVER API HUB Local Search와 Vercel-compatible server function
- Supabase Auth, Postgres, Row Level Security, Storage, Realtime
- SQL migration을 canonical source로 사용하는 database workflow

## 구조

```text
api/
  naver-geocode.ts         # Vercel Function entrypoint
  naver-geocode-core.ts    # address validation, upstream call, normalization
  naver-search.ts          # Vercel Function entrypoint
  naver-search-core.ts     # validation, upstream call, normalization
src/
  components/              # app shell, map/search, detail/review, Realtime UI
  hooks/                   # auth, Feed/MY data, Realtime, marker lifecycle
  lib/                     # NAVER Maps, Supabase, auth/profile/data calls
  pages/                   # login, signup, map, Feed, restaurant detail, MY
  types/                   # app-facing API and SDK types
supabase/
  config.toml              # local Supabase configuration
  migrations/              # canonical database schema history
  seed.sql                 # synthetic local seed template
```

브라우저는 NAVER API HUB와 Maps Geocoding API를 직접 호출하지 않습니다. `/api/naver-search`가 서버 전용 credential을 사용해 upstream을 호출하고 HTML 제거, 응답 검증, WGS84 좌표 정규화를 수행한 뒤 최소 application type만 반환합니다. `mapx`는 `longitude`, `mapy`는 `latitude`로 변환합니다. 검색 결과에 좌표가 없으면 사용자가 그 결과를 선택한 시점에만 `/api/naver-geocode`가 도로명 주소(없으면 지번 주소)를 WGS84 좌표로 변환합니다.

## 사용자 흐름

```text
회원가입/로그인 → nickname profile 확인 → 지도
              → NAVER 음식점 검색 → 후기 작성/수정 → marker/detail
              → Feed에서 친구의 최신 기록 확인
              → MY에서 내 통계와 방문 기록 확인
```

현재 MVP에서는 이메일 확인 없이 nickname, 이메일, 비밀번호, 비밀번호 확인만 입력하면 가입과 동시에 로그인됩니다. 이메일 확인이 필요해지면 Supabase Auth 설정과 가입 완료 UX를 함께 다시 활성화합니다. 사용자에게 profile이 없을 때만 nickname 설정 화면이 나타나며, MY에서 nickname 변경과 로그아웃을 할 수 있습니다. Session 확인이 끝나기 전에는 지도 route를 렌더링하지 않습니다.

`vercel.json`은 `/login`, `/signup`, `/feed`, `/my`, `/restaurants/:id` 직접 접근을 SPA entry로 rewrite합니다. `/api/naver-search`와 `/api/naver-geocode` function route는 rewrite 대상에 포함하지 않습니다.

## Routes

| 경로 | 역할 |
| --- | --- |
| `/` | NAVER Map, 음식점 검색, marker와 restaurant preview/sidebar |
| `/feed` | 모든 인증 사용자의 최근 방문 기록, 20개 단위 더 보기 |
| `/restaurants/:id` | 음식점 정보, 평균/리뷰 수, 사진과 방문 기록 CRUD |
| `/my` | 닉네임, 내 통계, 클릭해서 수정하는 내 최근 후기, 로그아웃 |
| `/login`, `/signup` | 이메일/비밀번호 Auth와 nickname 가입 |

## 로컬 설정

Node.js 20 이상과 npm이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

이미 실제 값이 있는 `.env.local`을 placeholder로 덮어쓰지 마세요. `npm run dev`는 Vite UI와 안전한 Node-side `/api/naver-search`, `/api/naver-geocode` middleware를 함께 실행합니다. middleware와 production Vercel Function은 각각 동일한 core module을 사용합니다. `NAVER_API_HUB_CLIENT_SECRET`과 `NAVER_MAP_CLIENT_SECRET`은 Vite의 Node 설정 프로세스에서만 읽고 `import.meta.env` 또는 browser bundle로 전달하지 않습니다.

### npm commands

```bash
npm run dev        # UI + local search API
npm run lint       # ESLint
npm run typecheck  # TypeScript project check
npm run build      # typecheck + production Vite build
npm run preview    # built frontend preview (Vercel API는 포함하지 않음)
```

## 환경변수와 secret 관리

| 변수 | 위치 | 용도 |
| --- | --- | --- |
| `VITE_NAVER_MAP_CLIENT_ID` | browser | NAVER Maps Dynamic Map SDK |
| `NAVER_MAP_CLIENT_ID` | server only | Maps Geocoding API 인증 |
| `NAVER_MAP_CLIENT_SECRET` | server only | Maps Geocoding API 인증 |
| `NAVER_API_HUB_CLIENT_ID` | server only | Local Search API 인증 |
| `NAVER_API_HUB_CLIENT_SECRET` | server only | Local Search API 인증 |
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | RLS로 보호되는 publishable key |

NAVER Maps credential과 NAVER API HUB credential은 별개입니다. 지도 SDK는 browser-visible Client ID를 사용하지만 Geocoding과 API HUB Client Secret은 항상 server proxy에만 둡니다. server-only 변수에는 절대 `VITE_` prefix를 붙이지 않습니다.

`VITE_` 변수는 browser bundle에 포함될 수 있습니다. 따라서 Supabase browser client에는 URL과 publishable key만 사용하고 `service_role`, `sb_secret`, database password, access token을 넣지 않습니다. `.env.local`과 `.env.*`는 Git에서 제외하며 `.env.example`만 빈 template으로 commit합니다.

## NAVER 구현 상태

- SDK를 한 번만 비동기 로드하는 helper와 서울권 초기 viewport
- Client ID 누락, load timeout/failure, `window.naver` 초기화 실패 UI
- idle/loading/success/empty/error를 처리하는 음식점 검색 UI
- 결과의 `후기 남기기` 선택은 DB를 변경하지 않고 후기 작성 UI만 표시
- 좌표가 없는 결과를 선택할 때만 도로명 주소 우선 lazy Geocoding
- `GET /api/naver-search?q=<query>`의 method, 공백, 100자 제한 검증
- `GET /api/naver-geocode?address=<address>`의 method, 공백, 300자 제한 검증
- 8초 upstream timeout, NAVER 4xx/5xx 및 비정상 JSON/shape의 안전한 오류 처리
- raw upstream 오류와 credential을 반환하지 않는 normalized response
- 저장된 Supabase restaurant와 review aggregate를 한 번에 조회해 NAVER Map marker 표시
- marker click/tap으로 공유 restaurant detail과 방문 기록 목록 표시
- 지도 탭 시 열려 있던 검색 결과와 검색어를 정리해 지도 interaction 복원
- 브라우저 위치 권한을 사용해 현재 위치 marker 표시와 지도 이동, 거부/timeout 안내
- NAVER 기본 zoom control은 표시하지 않고 desktop wheel/trackpad와 mobile pinch/touch의 native 지도 gesture를 유지
- `ResizeObserver` 기반 map resize 처리

공식 규격: [NAVER API HUB Local Search](https://api.ncloud-docs.com/docs/naver-api-hub-search-local), [NAVER Maps Geocoding](https://api.ncloud-docs.com/docs/application-maps-geocoding), [NAVER Maps JavaScript API](https://navermaps.github.io/maps.js.en/docs/tutorial-2-Getting-Started.html)

## Supabase client와 database

`src/lib/supabase.ts`는 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`로 browser client를 지연 생성합니다. 설정이 빠진 상태에서 client를 요청하면 원인을 설명하는 오류를 던집니다. secret/service role key는 지원하지 않습니다.

초기 migration은 다음을 만듭니다.

- `profiles`: `auth.users`와 1:1인 nickname/avatar profile
- `restaurants`: NAVER 기반 위치와 생성자, normalized `name|address` source key
- `reviews`: 사용자와 음식점당 하나인 0.5~5.0, 0.1 단위 rating review
- `review_photos`: Storage object path와 순서만 저장하는 metadata
- 필요한 recent review/photo lookup index와 `updated_at` trigger

Restaurant 삭제는 review가 있을 때 `restrict`하여 실수로 review가 함께 지워지지 않게 합니다. Review 삭제 시에만 photo metadata가 cascade됩니다. NAVER Local Search에는 안정적인 place ID 필드가 없으므로 존재하지 않는 ID를 만들지 않고, source + 공백/대소문자를 정규화한 음식점명과 도로명(없으면 지번) 주소 조합으로 단순 중복을 막습니다. fuzzy matching은 하지 않습니다.

검색 결과 선택 자체는 DB를 변경하지 않습니다. 사용자가 후기를 제출할 때 `create_visit_review` security-invoker RPC가 기존 `find_or_create_restaurant`를 호출하고 review를 같은 transaction에서 생성하거나 갱신합니다. `(source, source_key)`와 `(user_id, restaurant_id)` unique constraint를 함께 사용하므로 음식점은 중복 생성되지 않고, 같은 사용자가 같은 장소를 다시 저장하면 기존 후기 하나를 덮어씁니다. Service role은 사용하지 않습니다.

`list_restaurants_with_review_stats`는 restaurant 목록, 평균 평점, 리뷰 수, 대표 사진 경로를 한 번에 반환해 marker별 N+1 조회를 피합니다. `list_restaurant_reviews`는 작성자 nickname과 사진 metadata를 함께 반환합니다. `list_recent_reviews`와 `list_my_reviews`는 profile, restaurant, photo를 관계 조회한 뒤 `created_at DESC`로 20개씩 반환합니다. `get_my_review_stats`는 distinct 음식점, review, photo, 평균 별점을 정확히 집계합니다. 평균 평점은 리뷰가 없을 때 `null`로 유지합니다.

## Feed, MY, Realtime

- Feed는 사진이 없는 기록을 compact text로, 사진이 있는 기록을 가로 사진 영역으로 표시합니다.
- MY는 다녀온 곳, 방문 기록, 사진, 평균 별점과 본인의 최근 기록을 한 화면에 표시하며 최근 기록을 누르면 바로 수정할 수 있습니다.
- 인증 세션당 `RealtimeProvider` 채널 하나가 `restaurants`, `reviews`, `review_photos`, `profiles` 변경을 구독합니다.
- 짧은 시간에 연속된 이벤트를 하나로 묶고, 화면 데이터는 ID 기준 페이지 결과로 교체/병합합니다.
- review 변경 시 클라이언트 delta 계산 대신 aggregate RPC를 재조회해 Map, Detail, Feed, MY 값을 일치시킵니다.
- channel은 shell unmount 시 명시적으로 제거해 중복 subscription과 remount leak을 방지합니다.

### RLS

네 테이블 모두 RLS를 명시적으로 활성화하고 anonymous table 권한을 회수합니다.

- 인증 사용자는 profile/restaurant/review/photo를 조회할 수 있습니다.
- Profile은 본인만 생성·수정합니다.
- Restaurant은 인증 사용자만 본인 `created_by`로 생성하며 수정/삭제 policy는 아직 없습니다.
- Review는 `user_id = auth.uid()`인 작성자만 생성·수정·삭제합니다.
- Photo metadata는 연결된 review 작성자만 생성·삭제합니다.
- private `review-images` object는 인증 사용자가 읽고, 연결된 본인 review 경로에만 생성·삭제합니다.

현재 MVP policy는 별도 승인 없이 “인증된 모든 사용자”가 서비스를 사용하는 범위입니다. 관리자 승인, allowlist, invitation workflow는 사용하지 않습니다.

## Responsive application shell

- Mobile `< 768px`: 전체 지도, 상단 floating search, compact restaurant preview, 상세 route/review sheet, safe area를 확보한 하단 `지도/피드/MY` navigation
- Tablet/Desktop `>= 768px`: 350px sidebar와 나머지 지도 영역
- Wide desktop `>= 1200px`: 390px sidebar와 확장된 지도 영역

Desktop 지도는 350~390px sidebar와 남은 지도 공간을 사용합니다. Feed와 MY는 ultra-wide에서도 읽기 좋은 최대 폭을 유지합니다. Search 결과는 모바일 지도 일부만 덮는 scroll 영역으로 제한하고, 작성 중 닫기에는 확인 절차를 둡니다.

## SQL migration workflow

Database schema changes should be committed as SQL migrations. Dashboard에서만 schema를 바꾸지 않습니다.

```bash
npx supabase migration new <name>
# 생성된 supabase/migrations/*.sql 작성
npx supabase db push --dry-run
npx supabase db push
```

Supabase CLI는 dev dependency로 고정되어 항상 `npx supabase ...`로 실행합니다. 새 remote라면 `npx supabase login`, `npx supabase link --project-ref <ref>` 순서로 연결합니다. 기존 remote schema가 canonical baseline이라면 먼저 `npx supabase db pull`로 migration을 가져오고, 예상치 못한 drift는 local stack에서 `npx supabase db diff -f <name>`으로 검토합니다. Remote reset은 데이터를 지우는 destructive operation이므로 명시적 확인 없이는 사용하지 않습니다.

공식 workflow: [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [Local development workflow](https://supabase.com/docs/guides/local-development/cli-workflows)

`supabase/seed.sql`은 현재 의도적으로 비어 있습니다. 실제 사용자나 개인 방문 데이터는 seed에 넣지 않습니다.

## Review 사진 Storage

private `review-images` bucket을 사용합니다.

```text
사용자 이미지 → browser resize/compression → Supabase Storage
             → review_photos에 storage_path/sort_order 저장
             → 만료 1시간 signed URL로 표시
```

사진은 review당 최대 5장입니다. 파일 선택은 `image/*`와 모바일 HEIC/HEIF 입력을 열어 두고, 브라우저가 실제로 해석할 수 있는 사진을 긴 변 최대 1440px, WebP quality 0.78로 변환한 뒤 `<user_id>/<review_id>/<uuid>.webp`에 저장합니다. 선택 즉시 thumbnail을 표시하며 브라우저가 읽을 수 없는 형식만 문맥 오류로 안내합니다. 이미지 binary는 PostgreSQL column에 저장하지 않습니다.

사진 업로드는 핵심 후기와 분리해 순차 처리합니다. 새 후기의 사진 묶음 중 하나라도 실패하면 그 묶음에서 이미 올라간 object와 metadata를 되돌리고 편집창에 재시도 가능한 오류를 표시합니다. Feed/MY/detail은 사진별 signed URL을 경로 기준으로 연결하며 Storage signing이 일시적으로 실패해도 후기 text는 계속 표시합니다. Review 삭제 시 Storage object를 먼저 삭제한 뒤 photo metadata와 review를 삭제해 실제 object가 남지 않게 합니다.

## Production과 향후 선택 기능

Production: [https://whomadethis-xi.vercel.app](https://whomadethis-xi.vercel.app)

현재 Auth/session, NAVER 검색/Geocoding, 지도 marker, transaction 기반 방문 기록, 공유 detail, review/photo CRUD, Feed pagination, MY 통계/기록, Realtime, responsive app shell까지 구현되어 있습니다. 다음 항목은 MVP 이후의 선택 기능입니다.

1. 사진 순서 재정렬과 앱 내부 확대 viewer
2. Storage cleanup 보강을 위한 서버 재시도 작업
3. 사용자 수 증가 시 Broadcast 기반 Realtime 확장
