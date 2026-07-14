# Motion Editor — Maya 스타일 그래프 편집 작업 지시서

| 항목 | 내용 |
|------|------|
| 대상 | `/home/hexapod/editor_ws` Motion Editor (`components/GraphEditor.tsx`) |
| 목표 | 모션 데이터 조작 · 그래프 뷰 조작 · 타임라인 · 값 편집을 Autodesk Maya Graph Editor 스타일에 맞춤 |
| 작성일 | 2026-07-14 |
| 참고 | Autodesk Maya Help 2026/2027 Graph Editor |

---

## 1. 목적과 범위

### 1.1 목적

애니메이터가 Maya Graph Editor에서 익숙한 **시간/값 축 조작, 키(노드) 편집, 타임라인 스크럽** 흐름을 이 CSV 모션 에디터에서도 동일하게 쓰도록 한다.

### 1.2 포함

- 타임라인 (플레이헤드, Playback Range, 룰러)
- 그래프 뷰 네비게이션 (팬/줌/Frame)
- 시간 축 이동·키 시간 이동
- Frame/Value 수치 편집
- 탄젠트/보간 프리셋, Snap/Scale, 클립보드 동작
- 툴바·단축키·마킹 메뉴 UX

### 1.3 제외 (이번 지시서 범위 밖)

| 제외 항목 | 이유 |
|-----------|------|
| Absolute / Stacked / Normalized 뷰 모드 | 카메라/표시 스케일 모드 — 요청에 따라 제외 |
| Infinity (Pre/Post Cycle 등) | 후순위 후보, 본 지시서 미포함 |
| Buffer Curve Snapshot | 후순위 후보 |
| Euler Filter / Quaternion | 모터 CSV(각도 deg)와 비해당 |
| 3D 뷰포트·리그·씬 연동 | 본 제품은 CSV 기반 |

---

## 2. 현재 상태 요약 (As-Is)

구현 위치: `components/GraphEditor.tsx`

| 영역 | 현재 동작 |
|------|-----------|
| 시간 창 | `visibleRange: { start, end }` |
| 값 창 | `yRange: { min, max }` (항상 deg) |
| 뷰 모드 | Absolute 단일 (축 겹침) |
| 시간 줌 | **룰러 휠만** (`handleWheel`) |
| 값 줌 | **플롯 휠만** (`handleYWheel`) |
| 팬 | **MMB = X·Y 동시** |
| Frame All | 데이터 전체 + Y 데이터 범위 |
| Frame Selection | 고정 ±100프레임 / ±50° 포커스 (선택 바운드 맞춤 아님) |
| 플레이헤드 | 마커 드래그; `clampFrameToVisibleRange`로 뷰 안에 강제 |
| 시간 클램프 | 데이터 있을 때 `clampRange` → `0 ~ maxFrame` |
| 키 시간 이동 | 제한적 (`shiftSelectedNodeToLeft` 등) |
| 보간 | Generated Segment 모드 (linear~spline, bezier…) + 핸들 |
| Frame/Value 툴바 | **readOnly** 표시 |

---

## 3. 목표 상태 요약 (To-Be, Maya 대응)

| Maya 개념 | 목표 동작 |
|-----------|-----------|
| Time Ruler + Current Time Marker | 룰러 클릭/드래그 스크럽, 뷰와 독립 가능 |
| Playback Range | `playbackRange`와 `visibleRange` 분리 |
| Alt+MMB 팬 / Alt 줌 | 커서 기준 줌, **Shift로 시간 또는 값 축만** |
| Frame All / Selection / Playback Range | 각각 데이터·선택 바운드·재생 구간에 맞춤 |
| K 스크럽 | 그래프 영역에서 플레이헤드만 이동 (키 드래그와 분리) |
| 키 시간 이동 | 수평 드래그, 다중 키는 값 고정·시간만 이동 |
| 탄젠트 타입 | Flat / Stepped / Linear / Spline(또는 Auto) 프리셋 |
| 수치 편집 | Frame·Value·In/Out 각도·가중치 직접 입력 |

---

## 4. 작업 단계 (권장 순서)

구현은 **Phase 1 → 5** 순서를 권장한다.  
앞 단계가 뒷 단계 UX의 전제이다.

```
Phase 1  타임라인 / 상태 모델
Phase 2  그래프·시간축 네비게이션
Phase 3  값·수치 편집
Phase 4  모션 데이터 조작
Phase 5  UX 정리·단축키
```

---

## 5. Phase 1 — 타임라인 / 상태 모델

### W1. Playback Range와 visibleRange 분리

**ID:** `tl-playback-range`

**내용**

- 상태 추가: `playbackRange: { start, end }`
- 기존 `visibleRange`는 “보고 있는 구간”만 담당
- 재생/스크럽 기본 구간은 `playbackRange` 기준

**수용 기준**

- [x] 뷰를 확대해도 Playback Range는 유지된다
- [x] Frame Playback Range 시 `visibleRange`가 `playbackRange`에 맞춰진다
- [x] Undo 스냅샷(`EditorSnapshot`)에 `playbackRange` 포함

---

### W2. Time Ruler 스크럽 + Range 핸들

**ID:** `tl-ruler-scrub`

**내용**

- 룰러 **빈 영역** 클릭 → 플레이헤드 점프
- 플레이헤드 드래그 스크럽
- Playback Range 양끝 핸들로 시작/끝 조절

**수용 기준**

- [x] Maya처럼 룰러 아무 곳 클릭으로 현재 프레임 이동
- [x] Range 핸들 드래그로 start/end 변경, start ≤ end 유지
- [x] 시각적으로 Playback Range(어두운 구간)와 뷰 구간이 구분됨

**관련 보완 ID:** `time-ruler-click-jump`

---

### W3. playhead와 visibleRange 분리

**ID:** `time-playhead-decouple`

**내용**

- `clampFrameToVisibleRange`로 플레이헤드를 뷰 안에 가두지 않음
- 플레이헤드가 뷰 밖이면 마커는 숨기거나 가장자리 표시(제품 결정)
- 스크럽 중 자동으로 `visibleRange`를 끌어오지 않음 (옵션으로 “따라가기” 가능)

**수용 기준**

- [x] 플레이헤드가 화면 밖 프레임을 가리켜도 값이 깨지지 않음
- [x] 팬/줌만으로도 플레이헤드를 다시 보이게 할 수 있음

---

## 6. Phase 2 — 그래프·시간축 네비게이션

### W4. Maya식 팬/줌 제스처

**ID:** `gv-nav-gestures`, `time-zoom-graph`, `time-pan-axis-lock`

**내용**

| 동작 | 목표 |
|------|------|
| 팬 | MMB (또는 Alt+MMB). 기본 XY |
| 시간만 팬 | Shift + 수평 팬 |
| 값만 팬 | Shift + 수직 팬 |
| 시간 줌 | 그래프 영역에서도 가능 (룰러 전용 제거/확장), 커서 기준 |
| 값 줌 | 커서 기준 |
| 축 잠금 줌 | Shift(+방향)로 시간 또는 값만 줌 |

**수용 기준**

- [x] 플롯 위에서 시간 줌 가능
- [x] Shift로 시간축만 / 값축만 팬·줌 가능
- [x] 줌 중심이 포인터 위치

**구현 메모 (제품 결정)**

마우스 휠은 방향 정보가 없어(수직 delta만 존재) "Shift+방향"을 그대로 구현할 수 없음. 대신:
- 팬(MMB 드래그): Shift 홀드 중 드래그 총 이동량이 수평 우세면 시간만, 수직 우세면 값만 이동.
- 줌(휠): 룰러 휠 = 시간 전용(기존), 플롯 휠(모디파이어 없음) = 값 전용(기존), 플롯 휠 + Shift = 시간 전용(신규). 플롯 위에서 시간/값 줌 모두 도달 가능.

---

### W5. 데이터 범위 밖 시간 팬

**ID:** `time-pan-beyond-data`

**내용**

- `clampRange`의 `0 ~ maxFrame` 강제 완화
- 키(노드)가 없어도 시간축을 좌우로 더 볼 수 있음
- 하한 0 유지 여부는 제품 정책으로 결정 (권장: start ≥ 0, end는 상한 완화)

**수용 기준**

- [x] 마지막 키 이후 / 첫 키 이전 구간을 뷰로 탐색 가능
- [x] Frame All은 여전히 데이터(또는 Playback Range)에 맞춤

---

### W6. Frame All / Selection / Playback Range

**ID:** `gv-frame-ops`

**내용**

| 명령 | 동작 |
|------|------|
| Frame All | 로드된 모션(또는 전체 축) 시간·값 바운드 + 패딩 |
| Frame Selection | **선택 노드/세그먼트 AABB**에 맞춤 (현재 ±100f/±50° 고정 포커스 대체) |
| Frame Playback Range | `visibleRange` ← `playbackRange` (Y는 유지 또는 데이터 기준 — 결정) |

**수용 기준**

- [x] Frame Selection이 선택 키 min/max frame·value에 실제로 맞춤
- [x] 선택 없으면 Frame Selection 비활성 또는 Frame All과 동일 동작(명시)

---

### W7. 그래프 뷰 K 스크럽

**ID:** `time-k-scrub`

**내용**

- K 누른 채 그래프 드래그 → 플레이헤드만 이동
- 키/곡선 드래그와 충돌하지 않음 (Maya: 뷰에서 실수 방지용 잠금 해제)

**수용 기준**

- [x] K+드래그 시 노드 위치가 변하지 않음
- [x] 플레이헤드만 갱신

---

## 7. Phase 3 — 값·수치 편집

### W8. Frame / Value 직접 편집

**ID:** `val-numeric-edit`

**내용**

- 툴바 Frame / Value 입력을 readOnly → editable
- 절대값 입력 + 오프셋 입력(예: `+=2`, `-=0.5`) 지원 권장
- 다중 선택 시 Value 일괄 적용 정책 명시 (모두 동일 값 / 상대 오프셋)

**수용 기준**

- [x] 선택 키의 frame·value를 숫자로 변경 가능
- [x] Undo에 포함
- [x] 프레임 충돌 시 덮어쓰기/거부 정책이 문서화·구현됨

**구현 메모 (제품 결정)**

- Frame/Value 입력은 타이핑 중이 아니라 **blur 또는 Enter 시 1회 커밋**한다 (키 입력마다 커밋하면 Undo 스택이 오염됨).
- Value: 순수 숫자 = **절대값**(다중 선택 시 선택된 모든 키에 동일하게 적용), `+=N`/`-=N` = **상대 오프셋**(단일·다중 선택 모두 각 키에 개별 적용, 상대 간격 유지).
- Frame: 단일 키 선택에서만 편집 가능(다중 선택·생성 세그먼트 선택 시 비활성). 이미 값이 있는 프레임으로 이동하면 **덮어쓰기**(대상 프레임 값 교체, 원래 프레임은 빈 값이 됨) 정책을 채택.
- 값이 실제로 바뀌지 않는 커밋(같은 값으로 blur 등)은 Undo 스냅샷을 남기지 않는다.

---

## 8. Phase 4 — 모션 데이터 조작

### W9. 탄젠트·보간 프리셋

**ID:** `data-tangent-presets`

**내용**

기존 Generated Segment 모드와 병행 또는 키 단위 프리셋으로:

| 프리셋 | 기대 곡선 |
|--------|-----------|
| Flat | 기울기 0, 오버슈트 억제 |
| Stepped | 다음 키까지 값 유지 후 점프 |
| Linear | 키 사이 직선 |
| Spline / Auto | 부드러운 연결 |

**수용 기준**

- [ ] 선택 키 또는 선택 구간에 프리셋 적용
- [ ] 기존 bezier/spline 세그먼트와 충돌 시 변환 규칙 명시

---

### W10. Break / Unify · Lock / Free

**ID:** `data-break-unify`

**내용**

- Break: In/Out 핸들 독립
- Unify: 다시 대칭/동일 각도
- Weighted 핸들 길이 Lock / Free

**수용 기준**

- [ ] Break 후 In만 움직여도 Out 불변
- [ ] Unify 후 상대 관계 복원

---

### W11. Snap / Scale / 키 시간 이동

**ID:** `data-key-ops`, `time-key-horizontal-drag`, `time-marker-to-keys-nudge`

**내용**

- Snap Keys: 정수 프레임(또는 격자)에 스냅
- Scale Keys: 선택 구간 시간·값 스케일
- 키 **수평 드래그**로 시간 이동
- 다중 키: **값 고정, 시간만** 이동
- 선택 키로 Time Marker 이동
- 프레임 nudge (←/→ 또는 Shift+단축)

**수용 기준**

- [ ] 드래그로 키가 다른 프레임으로 이동, 값 유지 옵션 동작
- [ ] Scale 후 상대 간격 비율 유지
- [ ] Nudge 1프레임 단위

---

### W12. Cut / Copy / Paste Maya식

**ID:** `data-clipboard`

**내용**

Paste 모드:

- **Merge** — 겹치는 프레임 병합
- **Insert** — 이후 키 시간 밀기
- **Replace** — 구간 치환

**수용 기준**

- [ ] 세 모드가 UI에서 선택 가능하거나 기본 모드 + 옵션
- [ ] 축·노드·세그먼트 기존 클립보드와 동작이 일관됨

---

## 9. Phase 5 — UX 정리

### W13. 툴바·단축·마킹 메뉴

**ID:** `ux-marking-stats`

**내용**

- In/Out 각도·가중치 툴바 **편집 가능**
- 우클릭/마킹 메뉴: 탄젠트 프리셋, Cut/Copy/Paste, Frame 명령
- 단축키표 README 또는 UI 도움말에 반영

**권장 단축 (Maya 대응, 브라우저 환경에 맞게 조정)**

| 동작 | 제안 |
|------|------|
| 팬 | MMB / Alt+MMB |
| 줌 | Wheel / Alt+드래그 |
| 축 잠금 | Shift |
| 그래프 스크럽 | K+드래그 |
| Frame Selection | F |
| Frame All | A 또는 Shift+A |
| Undo / Redo | Ctrl+Z / Ctrl+Shift+Z |

**수용 기준**

- [ ] 핵심 조작이 버튼 없이 단축으로 가능
- [ ] 툴바 수치가 편집·반영됨

---

## 10. 구현 공통 규칙

1. **단일 진입점** — 뷰/타임라인/키 조작 로직은 `GraphEditor.tsx`(또는 추후 분리 시 `lib/graphView.ts` 등)에 응집. 무분별한 파일 확산 금지.
2. **Undo** — 데이터·playbackRange·선택 상태를 바꾸는 모든 편집은 `pushUndoSnapshot` 경로.
3. **단위** — 시간 = 프레임 인덱스, 값 = deg. 룰러 표시(`formatFrameTime`)는 초/프레임 혼동 없도록 라벨 명시.
4. **성능** — 줌/팬은 렌더마다 전체 CSV를 재파싱하지 않음. 기존 plot 변환(`toPlotPoints` 등) 재사용.
5. **회귀** — CSV Open/Save Client·Server, 세그먼트 생성, 기존 핸들 드래그가 Phase 이후에도 동작해야 함.
6. **문서** — Phase 완료 시 `README.md` 기능 목록·조작법 갱신.

---

## 11. 작업 체크리스트 (전체 ID)

### Phase 1 — 타임라인
- [x] `tl-playback-range`
- [x] `tl-ruler-scrub`
- [x] `time-ruler-click-jump`
- [x] `time-playhead-decouple`

### Phase 2 — 네비게이션
- [x] `gv-nav-gestures`
- [x] `time-zoom-graph`
- [x] `time-pan-axis-lock`
- [x] `time-pan-beyond-data`
- [x] `gv-frame-ops`
- [x] `time-k-scrub`

### Phase 3 — 값
- [x] `val-numeric-edit`

### Phase 4 — 모션 데이터
- [ ] `data-tangent-presets`
- [ ] `data-break-unify`
- [ ] `data-key-ops`
- [ ] `time-key-horizontal-drag`
- [ ] `time-marker-to-keys-nudge`
- [ ] `data-clipboard`

### Phase 5 — UX
- [ ] `ux-marking-stats`

---

## 12. 후순위 (본 지시서 미포함, 필요 시 별도)

- Infinity (Constant / Cycle / Cycle with Offset / Oscillate)
- Buffer Curve Snapshot / Swap
- Stacked / Normalized View
- Lattice Deformer Keys

---

## 13. 착수 방법

1. Phase 1부터 구현 (상태 모델이 먼저).
2. 한 Phase 끝날 때마다 수동 스모크: 로드 → 팬/줌 → 스크럽 → 키 편집 → 저장.
3. 다음 Phase 시작 전 이 문서 체크리스트에 완료 표시.

**첫 착수 티켓:** `W1` (`tl-playback-range`) + `W3` (`time-playhead-decouple`)를 함께 설계하면 이후 네비게이션 작업이 단순해진다.
