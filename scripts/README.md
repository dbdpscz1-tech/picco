# 슬랙 KPI 리포트 자동화 (영업일 기준)

영업일(월~금) 오전 11시(KST)에 [통합 발주서(스탠리제외)] 시트의 데이터를 조회하여 슬랙으로 KPI 요약을 전송합니다.

## 기능

### 1. 전날 성과 (영업일 기준)
- 월요일: 지난 금요일 11:01 ~ 오늘(월) 11:00
- 화~금: 전날 11:01 ~ 오늘 11:00
- 주문건수, 판매건수 (D, P컬럼 기준)

### 2. 당월 현황
- 일별 추이 (최근 7일)
- 월간 누적 총합
- 일평균 주문/판매건수 (C, D, P컬럼 기준)

### 3. 월별 요약
- 2026년 월별 주문/판매량 리스트

### 4. 몰별 통계
- 이번 달 판매몰별 비중 (AA컬럼 기준, 스탠리 제외)

## 설정 방법

### 1. 환경 변수 설정

#### 로컬 개발 환경
`.env.local` 파일을 생성하고 다음을 추가하세요:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/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
DASHBOARD_URL=https://your-dashboard-url.com
```

#### 배포 환경 (Vercel 등)
배포 플랫폼의 환경 변수 설정에서 다음을 추가하세요:
- `SLACK_WEBHOOK_URL`: 슬랙 웹훅 URL
- `DASHBOARD_URL`: 대시보드 URL (슬랙 메시지의 대시보드 버튼 링크)

### 2. GitHub Actions Secrets 설정

GitHub 저장소에서 다음을 설정하세요:

1. 저장소 Settings > Secrets and variables > Actions로 이동
2. "New repository secret" 클릭
3. 다음 환경 변수들을 추가하세요:
   - `SLACK_WEBHOOK_URL`: 슬랙 웹훅 URL
   - `DASHBOARD_URL`: 대시보드 URL (슬랙 메시지의 대시보드 버튼 링크)
4. 각각 "Add secret" 클릭

### 3. 로컬 테스트

```bash
# 의존성 설치
npm install

# 스크립트 실행
npm run slack-report
```

### 4. 프론트엔드에서 수동 전송

대시보드 상단의 "📤 슬랙 리포트 수동 전송" 버튼을 클릭하면 현재 시점 기준 가장 최근의 유효한 영업일 데이터를 슬랙으로 즉시 전송할 수 있습니다.

- **월요일**: 금요일 11:01 ~ 월요일 11:00 데이터 (주말 포함)
- **화~금요일**: 전날 11:01 ~ 현재 11:00 데이터
- 수동 전송된 메시지에는 "※ 이 메시지는 수동 전송 버튼을 통해 발송되었습니다." 문구가 표시됩니다.
- 슬랙 메시지 하단에 "📊 대시보드 확인하기" 버튼이 표시되어 대시보드로 바로 이동할 수 있습니다.

## 스케줄링

GitHub Actions를 통해 영업일(월~금) 오전 11시(KST, UTC 02:00)에 자동 실행됩니다.

- 공휴일: GitHub Actions cron은 주말만 자동 제외하므로, 공휴일은 수동으로 확인이 필요합니다.
- 수동 실행: GitHub 저장소의 Actions 탭에서 "Daily KPI Report" 워크플로우 선택 후 "Run workflow" 클릭

## 데이터 소스

- 시트: [통합 발주서(스탠리제외)]
- 집계 기준: 영업일 기준 (월요일은 주말 포함)
- 필터: 스탠리 판매몰 제외
