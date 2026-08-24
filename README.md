# whomadethis

친구들이 함께 방문한 음식점을 전국 지도에 기록하고 사진, 별점, 리뷰를 누적해 공유하는 웹앱입니다. 현재 milestone은 완성 서비스가 아니라 음식점 저장과 리뷰 기능을 안전하게 이어서 만들 수 있는 개발 기반을 제공합니다.

## 목표와 기술 스택

- React 19, Vite, TypeScript, React Router
- NAVER Maps JavaScript API v3
- NAVER API HUB Local Search와 Vercel-compatible server function
- Supabase Auth, Postgres, Row Level Security, Storage를 위한 client/CLI 기반
- SQL migration을 canonical source로 사용하는 database workflow

## 구조

```text
api/
  naver-search.ts          # Vercel Function entrypoint
  naver-search-core.ts     # validation, upstream call, normalization
src/
  components/              # map and restaurant search UI
  lib/                     # NAVER Maps loader, Supabase client
  pages/                   # router pages
  types/                   # app-facing API and SDK types
supabase/
  config.toml              # local Supabase configuration
  migrations/              # canonical database schema history
  seed.sql                 # synthetic local seed template
```

브라우저는 NAVER API HUB를 직접 호출하지 않습니다. `/api/naver-search`가 서버 전용 credential을 사용해 upstream을 호출하고 HTML 제거, 응답 검증, WGS84 좌표 정규화를 수행한 뒤 최소 application type만 반환합니다. `mapx`는 `longitude`, `mapy`는 `latitude`로 변환합니다.

## 로컬 설정

Node.js 20 이상과 npm이 필요합니다.

```bash
npm install
cp .env.example .env.local
npm run dev
```

이미 실제 값이 있는 `.env.local`을 placeholder로 덮어쓰지 마세요. `npm run dev`는 Vite UI와 안전한 Node-side `/api/naver-search` middleware를 함께 실행합니다. middleware와 production Vercel Function은 동일한 `naver-search-core.ts`를 사용합니다. `NAVER_API_HUB_CLIENT_SECRET`은 Vite의 Node 설정 프로세스에서만 읽고 `import.meta.env` 또는 browser bundle로 전달하지 않습니다.

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
| `NAVER_API_HUB_CLIENT_ID` | server only | Local Search API 인증 |
| `NAVER_API_HUB_CLIENT_SECRET` | server only | Local Search API 인증 |
| `VITE_SUPABASE_URL` | browser | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | RLS로 보호되는 publishable key |

NAVER Maps credential과 NAVER API HUB credential은 별개입니다. 지도 SDK는 browser-visible Client ID를 사용하지만 API HUB Client Secret은 항상 server proxy에만 둡니다. NAVER API HUB 변수에는 절대 `VITE_` prefix를 붙이지 않습니다.

`VITE_` 변수는 browser bundle에 포함될 수 있습니다. 따라서 Supabase browser client에는 URL과 publishable key만 사용하고 `service_role`, `sb_secret`, database password, access token을 넣지 않습니다. `.env.local`과 `.env.*`는 Git에서 제외하며 `.env.example`만 빈 template으로 commit합니다.

## NAVER 구현 상태

- SDK를 한 번만 비동기 로드하는 helper와 서울권 초기 viewport
- Client ID 누락, load timeout/failure, `window.naver` 초기화 실패 UI
- idle/loading/success/empty/error를 처리하는 음식점 검색 UI
- 결과 클릭 시 유효한 WGS84 좌표로 지도 이동
- `GET /api/naver-search?q=<query>`의 method, 공백, 100자 제한 검증
- 8초 upstream timeout, NAVER 4xx/5xx 및 비정상 JSON/shape의 안전한 오류 처리
- raw upstream 오류와 credential을 반환하지 않는 normalized response

공식 규격: [NAVER API HUB Local Search](https://api.ncloud-docs.com/docs/naver-api-hub-search-local), [NAVER Maps JavaScript API](https://navermaps.github.io/maps.js.en/docs/tutorial-2-Getting-Started.html)

## Supabase client와 database

`src/lib/supabase.ts`는 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_PUBLISHABLE_KEY`로 browser client를 지연 생성합니다. 설정이 빠진 상태에서 client를 요청하면 원인을 설명하는 오류를 던집니다. secret/service role key는 지원하지 않습니다.

초기 migration은 다음을 만듭니다.

- `profiles`: `auth.users`와 1:1인 nickname/avatar profile
- `restaurants`: NAVER 기반 위치와 생성자, normalized `name|address` source key
- `reviews`: 여러 번의 방문을 허용하는 0.5~5.0, 0.5 단위 rating review
- `review_photos`: Storage object path와 순서만 저장하는 metadata
- 필요한 recent review/photo lookup index와 `updated_at` trigger

Restaurant 삭제는 review가 있을 때 `restrict`하여 실수로 review가 함께 지워지지 않게 합니다. Review 삭제 시에만 photo metadata가 cascade됩니다. NAVER Local Search에는 안정적인 place ID 필드가 없으므로 존재하지 않는 ID를 만들지 않고, source + 공백/대소문자를 정규화한 음식점명과 도로명(없으면 지번) 주소 조합으로 단순 중복을 막습니다. fuzzy matching은 하지 않습니다.

### RLS

네 테이블 모두 RLS를 명시적으로 활성화하고 anonymous table 권한을 회수합니다.

- 인증 사용자는 profile/restaurant/review/photo를 조회할 수 있습니다.
- Profile은 본인만 생성·수정합니다.
- Restaurant은 인증 사용자만 본인 `created_by`로 생성하며 수정/삭제 policy는 아직 없습니다.
- Review는 `user_id = auth.uid()`인 작성자만 생성·수정·삭제합니다.
- Photo metadata는 연결된 review 작성자만 생성·삭제합니다.

현재 policy는 “인증된 모든 사용자” 범위입니다. 다음 단계에서 `members`, `groups`, `invitations`를 도입해 친구 멤버만 접근하도록 좁혀야 합니다.

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

## Storage 계획

향후 private `review-images` bucket을 사용합니다.

```text
사용자 이미지 → browser resize/compression → Supabase Storage
             → review_photos에 storage_path 저장
```

Bucket과 Storage RLS policy는 upload 기능 milestone에서 migration으로 추가합니다. 이미지 binary는 PostgreSQL column에 저장하지 않습니다.

## 현재 범위와 다음 milestone

현재 지도 표시, 지역 검색과 지도 이동, Supabase client, CLI 설정, 초기 schema/RLS migration까지 구현되어 있습니다. 아직 Supabase Auth UI, 음식점 DB 저장/marker, restaurant detail, review CRUD, 사진 resize/upload, 친구 membership, Vercel project/deployment는 구현하지 않았습니다.

권장 순서:

1. NAVER 검색 결과 선택 → `restaurants` insert
2. DB restaurant marker와 detail
3. Review CRUD
4. Private photo upload
5. Supabase Auth
6. Friend/member access
7. Vercel project 생성과 production deploy
