# Motion Editor

Next.js 전용 모션 CSV 편집기입니다. FastAPI나 Python 백엔드는 없습니다.

## 요구사항

- Node.js 20.9.0 이상
- npm

Python, FastAPI 등 별도 백엔드 서버는 필요하지 않습니다.

## 설치

### Ubuntu

Node.js와 npm 설치:

```bash
sudo apt update
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

버전 확인:

```bash
node -v
npm -v
```

프로젝트 패키지 설치:

```bash
cd /path/to/motion_editor
npm install
```

### Windows

아래 방법 중 하나로 Node.js LTS를 설치합니다.

PowerShell에서 winget 사용:

```powershell
winget install OpenJS.NodeJS.LTS
```

또는 `https://nodejs.org`에서 LTS 설치 파일을 내려받아 설치합니다.

설치 후 새 PowerShell 창을 열고 확인:

```powershell
node -v
npm -v
```

프로젝트 패키지 설치:

```powershell
cd C:\motion_editor
npm install
```

## 기능

- 각 행이 모터 축인 모션 CSV 파일 로드
- 인터랙티브 그래프에서 축·노드 편집
- 축 추가, 삭제, 자르기, 이름 변경, 복사·붙여넣기
- 노드 추가, 삭제, 이동, 드래그, 복사·붙여넣기
- 보간 모드로 부분 모션 세그먼트 생성
- 부분 세그먼트 선택 및 핸들 편집
- 팬, 줌, 맞춤, 포커스, 실행 취소·다시 실행
- 룰러 클릭/드래그로 플레이헤드 스크럽, 별도의 Playback Range 핸들·Frame Playback Range
- Shift 홀드로 시간축·값축 잠금 팬/줌, 데이터 범위 밖으로 시간 축 팬
- Frame Selection이 선택 키/세그먼트의 실제 프레임·값 범위에 맞춰 뷰를 조정
- K 홀드 + 드래그로 키 이동 없이 플레이헤드만 스크럽
- 편집한 모션 데이터를 CSV로 저장

### 파일 입출력 조합

| | 클라이언트에 저장 | 서버에 저장 |
|---|---|---|
| **클라이언트에서 열기** | Open Client → Save Client | Open Client → Save Server |
| **서버에서 열기** | Open Server → Save Client | Open Server → Save Server |

- **Open Client** — 브라우저가 실행 중인 PC의 로컬 파일을 엽니다 (파일 선택창).
- **Open Server** — 서버 PC의 `MOTION_DIR` 폴더에 있는 CSV 목록을 보여 주고, 선택한 파일을 불러옵니다.
- **Save Client** — 편집한 CSV를 브라우저 PC로 다운로드합니다.
- **Save Server** — 편집한 CSV를 서버의 `MOTION_DIR` 폴더에 씁니다. 서버에서 연 파일이면 같은 이름으로 덮어쓰고, 아니면 파일명 입력 창이 뜹니다.

### 서버 폴더 (MOTION_DIR)

`.env.example`을 `.env.local`로 복사한 뒤, 서버 PC에서 모션 CSV가 있는 폴더의 절대 경로를 `MOTION_DIR`에 설정합니다.

```bash
cp .env.example .env.local
# .env.local 편집
MOTION_DIR=/home/hexapod/motions
```

`MOTION_DIR`을 설정하지 않으면 프로젝트 루트의 `data/motions/`를 사용하며, 처음 접근 시 자동으로 만들어집니다. 해당 폴더의 `.csv`만 노출되며, 하위 폴더와 경로 탈출(`..`)은 차단됩니다.

## 실행

```bash
npm run dev
```

브라우저에서 `http://127.0.0.1:3000` 을 엽니다.

## 빌드

```bash
npm run build
```
