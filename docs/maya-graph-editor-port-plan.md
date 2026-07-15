# Maya Graph Editor 완전 이식 계획

Maya의 Graph Editor(모션 그래프 에디터) 기능과 사용성(UI/UX)을 이 프로젝트의 Motion CSV Editor에 이식하기 위한 작업 계획.
각 항목 완료 시 체크(`[x]`)하고 간단한 git 커밋을 남긴다.

## 현재 상태 (이미 구현됨 — maya-style-work-spec.md Phase 1~5)

- 팬(MMB), 줌(Wheel, Shift+Wheel 시간 전용), Shift+MMB 축 잠금 팬
- 룰러/K+드래그 플레이헤드 스크럽, Playback Range 핸들, Frame Playback Range
- 박스 선택, Ctrl+클릭 다중 선택, Frame Selection(F), Frame All(A)
- 키 수평 드래그(시간 이동), 방향키 Nudge, 우클릭 드래그 값 편집
- Frame/Value 직접 입력(절대값, `+=`/`-=` 상대 오프셋)
- 보간 세그먼트(Linear/EaseIn/EaseOut/EaseInOut/Spline/Flat/Stepped) + 탄젠트 핸들 편집
- 핸들 Break/Unify, Lock/Free Weight
- 노드 범위 복사/잘라내기/붙여넣기(Merge/Insert/Replace)
- Undo/Redo (Ctrl+Z / Ctrl+Shift+Z)

## 갭 분석 (Maya Graph Editor 대비 부족한 것)

| Maya 기능 | 현재 상태 | 계획 |
|---|---|---|
| Move Tool: 키를 시간+값 2D 자유 드래그 | 수평(시간)만 가능, 값은 우클릭 드래그로 분리 | M1 |
| Shift 드래그 축 제한(지배축 잠금) | 팬에만 있음, 키 드래그엔 없음 | M1 |
| Insert Key (S키, 커브 값 유지 삽입) | 툴바 버튼은 입력값 기준 삽입만 | M2 |
| 커브 위 더블클릭 키 삽입 | 없음 | M2 |
| Delete 키로 선택 키 삭제 | 버튼만 있음 | M2 |
| Scale Keys / Region Tool (선택 키 박스 스케일) | 없음 (spec에서 미구현으로 보류) | M3 |
| Pre/Post Infinity (Cycle/Oscillate/Linear/Constant) | 없음 | M4 |
| Buffer Curve (스냅샷 고스트 비교/스왑) | 없음 | M5 |
| Outliner 커브 표시/숨김(eye), Isolate | 축 리스트는 있으나 표시 토글 없음 | M6 |
| 값 스냅(정수 그리드) | 없음 (프레임은 정수 스냅 내재) | M7 |
| Retime Tool, Normalized/Stacked View, Dope Sheet | 없음 | 범위 외(후순위) |

데이터 모델 주의: 이 에디터는 프레임별 조밀(dense) 값 배열이 모델이므로 Maya의 희소 키+탄젠트 곡선 모델과 다르다.
따라서 "커브 값 유지 삽입"은 인접 키 선형 보간 값을, Infinity는 프리뷰 렌더 + 명시적 Bake로 이식한다.

## Phase M1 — 키 2D 자유 이동 (Move Tool 파리티)

- [x] M1-1. 키 LMB 드래그를 시간+값 동시 이동으로 확장 (기존 수평 전용 → Maya Move Tool 방식)
- [x] M1-2. 다중 선택 드래그 시 값도 함께 오프셋 (기존 "다중 선택 값 고정" 제품 결정을 Maya 파리티로 대체)
- [x] M1-3. Shift+드래그 = 지배축 잠금 (수평 우세 → 시간만, 수직 우세 → 값만; 팬 축 잠금과 동일 판정)
- [x] M1-4. 우클릭 값 드래그는 호환 유지, undo 1회 단위 유지

수용 기준: 키를 대각선으로 드래그하면 Frame/Value 모두 변경, Shift+수평 드래그 시 값 불변, Undo 1회로 원복.

## Phase M2 — 키 삽입/삭제 파리티

- [x] M2-1. `S` 키: 선택 축의 플레이헤드 위치에 커브 보간 값으로 키 삽입 (Maya Insert Key; 이미 키가 있으면 no-op)
- [x] M2-2. 플롯 더블클릭: 클릭 지점 프레임에 커브 보간 값으로 키 삽입 (생성 세그먼트 구간 안은 제외)
- [x] M2-3. `Delete`/`Backspace`: 선택 키 삭제 (기존 deleteSelectedNodes 재사용, 입력 필드 포커스 시 무시)

수용 기준: 키 사이 빈 프레임에서 S/더블클릭 → 폴리라인 모양 유지된 채 키 추가, Delete로 삭제, 모두 undo 가능.

## Phase M3 — Region Scale (Scale Keys Tool)

- [x] M3-1. 2개 이상 키 선택 시 선택 범위를 감싸는 Region 박스 오버레이 표시
- [x] M3-2. 좌/우 에지 핸들 드래그 = 시간 스케일 (반대쪽 에지가 피벗), 프레임 반올림·overwrite 정책은 기존 이동과 동일
- [x] M3-3. 상/하 에지 핸들 드래그 = 값 스케일 (반대쪽 에지가 피벗)
- [x] M3-4. 스케일 드래그는 실제 이동 발생 시에만 undo 스냅샷 1회 (moved 플래그 패턴)

수용 기준: 3키 선택 → 우측 에지 드래그로 시간 간격 확대/축소, 상단 에지로 값 스케일, Undo 1회 원복.
축소로 두 키가 같은 프레임에 겹치면 뒤 키가 남는다(overwrite, 기존 이동 정책과 동일)를 문서화.

## Phase M4 — Pre/Post Infinity

- [x] M4-1. 축별 pre/post infinity 모드 상태 (constant 기본 / cycle / oscillate / linear) + EditorSnapshot 포함
- [x] M4-2. 선택 축의 데이터 범위 밖 뷰포트 구간에 점선 프리뷰 커브 렌더
- [x] M4-3. KEY 패널에 Pre ∞ / Post ∞ 선택 UI
- [x] M4-4. "Bake ∞" 버튼: Playback Range 구간에 infinity 평가값을 실제 데이터로 베이크 (CSV 저장은 조밀 데이터이므로 베이크 필수임을 UI에 노출)

수용 기준: cycle 선택 시 데이터 끝 이후 점선 반복 커브 표시, Bake 후 실선 전환 + CSV에 포함, undo 가능.

## Phase M5 — Buffer Curve

- [x] M5-1. 선택 축 버퍼 스냅샷 저장 버튼 (현재 커브를 회색 고스트로 저장)
- [x] M5-2. 고스트 표시 토글, Swap(버퍼 ↔ 현재 커브) 버튼, undo 가능

## Phase M6 — 커브 표시/숨김 (Outliner 파리티)

- [x] M6-1. 축 리스트 카드에 eye 토글: 숨긴 축은 플롯에서 제외 (선택 상태와 독립)
- [x] M6-2. Isolate: 선택 축만 표시 토글

## Phase M7 — 마무리

- [x] M7-1. 값 스냅 토글 (드래그 중 값을 정수로 스냅, 자석 아이콘)
- [x] M7-2. README 단축키/기능 표 갱신 + 이 문서 최종 상태 갱신

## Phase M8 — Weighted Tangent (핸들 길이 → 곡선 반영)

버그: 탄젠트 핸들 각도는 곡선에 반영되지만 길이는 사실상 무시됨.
원인 (1) `computeHandleCurveValue`가 값 차원만의 1D 베지어라 컨트롤 포인트의 시간 위치가 구간 1/3·2/3에 고정 —
핸들 길이의 시간 성분이 수식에 안 들어감. (2) 계산 시 길이를 `frameSpan * 0.48`로 클램프해 그 이상은 완전 무시.

- [x] M8-1. GraphEditor: 컨트롤 포인트를 (시간, 값) 2D로 확장 — P1=(t0+len, v0+rise), P2=(t1−len, v1−rise),
  프레임별 x(t)=frame 역산(단조 이분탐색) 후 y(t) 평가. 길이 클램프를 0.48×span → 1.0×span(x 단조 유지 한계)으로 완화
- [x] M8-2. MotionEditor: 동일 로직 적용 (중복 구현 동기화)

수용 기준: 핸들 각도 고정 상태에서 길이만 늘이면 해당 방향으로 커브가 더 오래 눌리는(weighted) 형태로 변형,
핸들 끝을 수평으로 끌어도 곡선이 변함(기존엔 불변), 기본 핸들(≈gap/3)의 기존 커브 모양은 거의 동일 유지.

## Phase M9 — 핸들(생성 세그먼트) 데이터 영속화

버그: CSV에는 베이크된 값만 저장되어 다시 불러오면 generatedSegments(베지어 핸들 각도/길이 포함)가 사라져 핸들 편집 불가.
방식: CSV는 외부(로봇) 소비자 호환을 위해 순수 숫자 유지, `<파일명>.csv.meta.json` 사이드카에
`{version, generatedSegments, axisInfinity, axisNames}` 저장. 서버 목록 API는 `.csv`만 노출하므로 meta는 자동 숨김.

- [x] M9-1. 서버 저장/열기: 저장 시 CSV PUT 후 meta PUT, 열기 시 meta GET(404 무시) → 검증 후 세그먼트/핸들 복원.
  파일 API가 `.csv.meta.json` 이름을 허용하도록 `assertCsvName` 확장
- [x] M9-2. 클라이언트 저장/열기: 저장 시 meta JSON 함께 다운로드, 열기 file input을 다중 선택(.csv+.json)으로
  확장해 같이 선택하면 핸들 복원

수용 기준: Bezier 세그먼트 만들고 핸들 수정 → 서버 저장 → 다시 열기 → 세그먼트 카드/핸들이 그대로 복원되어
편집 계속 가능. meta 없는 기존 CSV는 종전과 동일하게 열림.

## 작업 규칙

- 각 항목 구현 → `npx next build` 타입체크 → Playwright로 실제 브라우저 검증 → 문서 체크 → git 커밋
- `next-env.d.ts`는 build가 덮어쓰므로 커밋 전 `git checkout -- next-env.d.ts`
- 커밋 메시지는 한국어, `M1-1:` 형식의 항목 ID 프리픽스
