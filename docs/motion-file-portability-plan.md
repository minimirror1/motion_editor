# 모션 파일 이동성(Portability) 계획 — 번들 + 프로젝트 전체 내보내기

| 항목 | 내용 |
|------|------|
| 배경 | 서버 공유 없이, (2) 로컬 설치 폴더를 다른 PC로 통째 이동 / (3) Save Client·Open Client로 파일을 내려받아 다른 PC로 전달하는 방식이 주 사용 패턴 |
| 문제 | CSV와 `*.csv.meta.json`(생성 세그먼트·베지어 핸들·Infinity·축 이름, M9 참고)이 별도 파일이라 이동 중 하나를 빠뜨려도 에러 없이 조용히 핸들 정보만 사라짐 |
| 방향 | 사용자 선택: **번들(zip) 저장/열기 추가 + 프로젝트 폴더 전체 내보내기/가져오기 추가**. 기존 csv+meta 개별 저장/열기(M9)와 서버 공유 흐름은 그대로 유지(하위 호환) |
| 참고 | [[editor-ws-workflow]] 워크플로 관례를 따름. 관련: docs/maya-graph-editor-port-plan.md M8(Weighted Tangent)·M9(meta 영속화) |

---

## 설계 요약

- **번들 파일**: `<이름>.zip` 하나에 `motion.csv` + `motion.csv.meta.json` 두 엔트리를 담는다. 엔트리 이름은 고정(canonical)이라 바깥 zip 파일명이 뭐든 상관없이 안정적으로 파싱된다. meta 엔트리는 세그먼트가 없어도 항상 포함(추후 "정말 없음" vs "유실"을 구분하기 위함).
- **역할 분리 (Save Client 버튼 정리)**:
  - **Save Bundle** (신규, 클라이언트 기본 권장 경로): 위 zip 하나만 다운로드 → 다른 PC로 파일 하나만 옮기면 편집 상태까지 보존.
  - **Export CSV** (기존 "Save Client"를 이 이름으로 정리): 순수 CSV만 다운로드, meta 자동 동봉 없음 — 로봇 등 외부 소비자에게 넘길 때 전용.
  - 즉 M9-2에서 Save Client가 자동으로 meta를 같이 내려받던 동작은 제거하고, 그 역할을 Save Bundle이 전담한다. (의도 명확화: "무언가 자동으로 같이 떨어진다"는 암묵적 동작 → 사용자가 명시적으로 "번들"과 "CSV만" 중 선택)
- **Open Client**: 기존 파일 입력(csv+json 다중 선택)에 **.zip도 허용**. 선택 목록에 `.zip`이 있으면 그걸 우선 압축 해제해서 사용, 없으면 기존 csv(+meta.json) 다중 선택 로직으로 폴백. 버튼/메뉴 추가 없이 하나의 Open Client로 통합.
- **프로젝트 전체 내보내기/가져오기** (서버 전용, 시나리오 2 대상): `data/motions/`(MOTION_DIR) 전체를 zip 하나로 묶어 내려받고, 다른 PC의 서버에 그 zip을 업로드하면 전체 라이브러리(csv+meta 쌍 전부)가 그대로 복원된다. "Open from Server" 브라우저 다이얼로그에 버튼 추가.
- **의존성**: 클라이언트(브라우저)·서버(Node) 양쪽에서 zip 생성/해제가 필요하므로 순수 JS 구현인 `jszip`을 추가(클라/서버 겸용, 새 의존성 1개로 해결).
- **보안**: 프로젝트 zip 가져오기는 서버 파일시스템에 쓰기 때문에 zip 엔트리 이름을 `assertCsvName`(`.csv`/`.csv.meta.json`만 허용, `..`/경로 구분자 차단) + `resolveSafeMotionPath`로 반드시 검증한 뒤 저장 (zip slip / path traversal 방지). 이미 M9에서 구축한 검증 유틸을 재사용.

---

## Phase M10 — 번들 저장/열기 (시나리오 3 대상)

- [x] M10-1. `jszip` 의존성 추가
- [x] M10-2. 번들 직렬화/파싱 헬퍼: `serializeMotionBundle(axes, generatedSegments, axisInfinity)` → zip Blob,
  `parseMotionBundle(zipFile)` → `{ csvText, metaText }` (기존 `serializeMotionCsv`/`serializeMotionMeta`/`parseMotionMeta` 재사용, 새 파싱 로직 최소화)
- [x] M10-3. 툴바: "Save Client" → **Export CSV**로 개명 + meta 자동 동봉 제거(M9-2 동작 되돌림), **Save Bundle** 버튼 신규 추가
- [x] M10-4. Open Client: file input에 `.zip` accept 추가, `handleFileChange`에서 zip 우선 처리 분기 추가 (csv+json 다중 선택 폴백은 유지)

수용 기준: Bezier 세그먼트+핸들 수정 → Save Bundle로 zip 하나 다운로드 → (같은 브라우저에서) Open Client로 그 zip 하나만 선택 →
세그먼트/핸들이 그대로 복원되어 편집 계속 가능. Export CSV는 meta 없이 CSV만 받아지는 것도 확인.

## Phase M11 — 프로젝트 폴더 전체 내보내기/가져오기 (시나리오 2 대상)

- [x] M11-1. 서버 API `GET /api/motions/export`: MOTION_DIR 내 모든 `*.csv`+`*.csv.meta.json`을 zip으로 묶어 스트리밍 응답
- [x] M11-2. 서버 API `POST /api/motions/import`: 업로드된 zip의 각 엔트리를 `assertCsvName`+`resolveSafeMotionPath`로 검증 후 MOTION_DIR에 기록 (동일 파일명은 덮어씀), 결과로 추가/덮어쓴 파일 목록 반환
- [x] M11-3. UI: "Open from Server" 다이얼로그 하단에 **Export Library** / **Import Library** 버튼 추가, 가져오기 결과(추가 N개·덮어씀 M개) 문구 표시

수용 기준: PC A에서 여러 모션(핸들 포함) 저장 후 Export Library로 zip 다운로드 → PC B(별도 로컬 설치)에서 Import Library로 그 zip 업로드 →
서버 파일 목록에 모든 csv가 나타나고 Open Server로 열면 핸들도 전부 복원.

## 작업 규칙 (기존과 동일)

- 각 항목 구현 → `npx next build` 타입체크 → Playwright 실브라우저 검증(zip 다운로드/업로드 포함) → 문서 체크 → git 커밋
- `next-env.d.ts`는 build가 덮어쓰므로 커밋 전 `git checkout -- next-env.d.ts`
- 커밋 메시지는 한국어, `M10-1:` 형식의 항목 ID 프리픽스
