# 산들 · Three.js 주택 맵

참고 사진의 어두운 벽돌, 밝은 타일로 마감한 2층 주택, 큰 창과 차양,
석재 하부 외벽, 중앙 계단, 검정 난간, 잔디 정원과 산 능선을 반영한 브라우저용 맵입니다.

## 실행

Node.js 22.12 이상 또는 24와 npm이 필요합니다.

```sh
cd /workspace/house
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
```

프로덕션 빌드는 `npm run build`, 빌드 결과 확인은 `npm run preview`입니다.
외부 API 키나 서버는 필요하지 않습니다. 폰트와 Three.js는 로컬 패키지에 포함됩니다.

## 조작

- 둘러보기: 마우스 드래그로 회전, 휠 또는 터치 핀치로 확대.
- 걸어보기: 탐험 시작 버튼으로 마우스 제어 허용. WASD / 방향키로 이동,
  Shift로 빠르게 이동하고 Esc로 종료. 주택 외부 충돌과 정원 경계가 적용됩니다.
- 환경 설정: 낮 / 오후 / 밤, 렌더러 노출, 실내 조명, 바람에 흔들리는 잔디.
- 처음 시점으로: 초기 카메라 위치로 복귀.

## 구현

`src/main.js`에 건축물, 조경, 조명, 재질 및 이동 제어가 있습니다.
벽돌·타일·석재·잔디 텍스처는 시드가 고정된 Canvas로 생성됩니다.
알베도와 범프 맵, 거칠기, 반사 환경 맵, 부드러운 그림자 및 ACES 톤 매핑을 사용합니다.
정적인 메시를 재질별로 묶고 잔디 55,000개를 인스턴싱해 그립니다.
DPR은 1.7까지 사용하며 시스템의 동작 줄이기 설정을 존중합니다.

사진을 참고한 절차적 모델이며 실제 건물의 정확한 치수나 실측 모델은 아닙니다.
현재 주택은 외부 탐험용입니다. 창의 실내 표현은 단순화되어 있고, 실내 진입은 지원하지 않습니다.
사진 실사 수준의 표현이 필요하면 실측 모델과 촬영한 PBR 텍스처로 교체할 수 있습니다.
모바일은 터치로 둘러보기를 지원하고, 걸어보기는 키보드와 포인터 잠금이 가능한 브라우저용입니다.

## 검증

개발 서버를 켠 상태에서 다음 명령으로 Chromium WebGL 스모크 검증을 실행합니다.

```sh
npm run test:smoke
```

시스템 Chromium(`/usr/bin/chromium`) 또는 `CHROMIUM_PATH`가 필요합니다.
렌더링, 시간대 전환, 노출, 조명·바람 제어, 걷기 이동 및 모바일 뷰를 확인합니다.
스크린샷은 저장소 외부 `/workspace/artifacts`에 저장됩니다.

## Cloudflare Workers 배포

`wrangler.jsonc`는 `house` Worker에서 `dist` 정적 파일을 제공하도록 설정되어 있습니다.
브라우저가 Three.js를 실행하므로 서버 측 WebGL이나 별도 Worker 코드는 필요하지 않습니다.

```sh
npm run deploy:check  # 빌드 및 업로드 없는 배포 패키지 검증
npm run deploy       # 빌드 후 실제 Workers 배포
```

실제 배포에는 Cloudflare 인증이 필요합니다. 로컬 PC에서는 `npx wrangler login`을 사용합니다.
자동화 환경에서는 환경 설정에 `CLOUDFLARE_API_TOKEN`을 비밀 값으로 저장하고
`CLOUDFLARE_ACCOUNT_ID`에 배포할 계정 ID를 설정합니다. API 토큰에는 해당 계정의
Workers Scripts Edit 권한이 필요합니다. 토큰을 코드나 Git에 넣지 마세요.
이 클라우드 환경에서는 `XDG_CONFIG_HOME=/workspace/.config`를 사용하고
`WRANGLER_LOG_PATH=/workspace/house/.wrangler/logs`로 로그를
쓰기 가능한 위치에 저장하고 `WRANGLER_SEND_METRICS=false`를 사용할 수 있습니다.

GitHub 연동으로 자동 배포하려면 Cloudflare Workers & Pages에서 저장소
`sjwow1111-oss/house`, 브랜치 `main`을 연결하고 빌드 명령은 `npm run build`,
배포 명령은 `npx wrangler deploy`로 설정합니다. 최초 배포 성공 후 출력되는
Workers URL에서 WebGL 화면과 정적 자산을 확인하세요.
