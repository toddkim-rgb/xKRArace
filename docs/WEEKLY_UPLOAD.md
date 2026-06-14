# 주간 PDF 업로드 가이드

매주 토·일 경주 출마표 PDF를 시스템에 올리는 절차입니다.
**추가(누적) 방식**이라 지난 주 데이터와 직접 입력한 실제 결과는 그대로 보존됩니다.

---

## 한눈에

```
PDF 내려받기  →  pdfs/날짜/ 폴더에 넣기  →  python parser/ingest.py pdfs/날짜  →  끝
```

---

## 0. 최초 1회만 준비 (REST 모드를 쓸 때)

`parser/ingest.py`가 DB에 바로 쓰려면 service_role 키가 필요합니다.

1. `parser/.env.example` 를 `parser/.env` 로 복사
2. Supabase Dashboard → **Settings → API → `service_role`** 키 복사
3. `parser/.env` 의 `SUPABASE_SERVICE_ROLE_KEY=` 뒤에 붙여넣기 (이 파일은 git에 안 올라감)

> 키를 쓰기 싫으면 0단계를 건너뛰고 아래 **방법 B(--sql)** 를 쓰면 됩니다.

---

## 1. PDF 내려받기 & 폴더 정리

- KRA에서 그 주 **토요일·일요일 각 경주 PDF**를 내려받습니다 (하루 10~12개).
- **경기일별 폴더**에 넣습니다 (폴더가 없으면 새로 만드세요):

  ```
  pdfs/2026-06-20/   ← 토요일 PDF 전부
  pdfs/2026-06-21/   ← 일요일 PDF 전부
  ```

- ⚠️ **파일명 규칙**: `s_run_hr_YYMMDD_NN.pdf`
  - 예) `s_run_hr_260620_01.pdf` = 6월 20일 **1경주**
  - 예) `s_run_hr_260620_11.pdf` = 6월 20일 **11경주**
  - 내려받은 파일명이 다르면 이 형식으로 바꿔 주세요.
  - (매번 이름 바꾸기가 번거로우면, PDF 내용에서 날짜·경주번호를 자동 인식하도록 바꿀 수 있습니다 — 요청만 주세요)

---

## 2. 적재 (아래 중 하나)

### 방법 A — 한 방 (REST, 0단계 키 필요)
```
python parser/ingest.py pdfs/2026-06-20
python parser/ingest.py pdfs/2026-06-21
```
→ Supabase에 바로 반영됩니다. 사이트 새로고침이면 끝.

### 방법 B — 키 없이 (SQL 생성 → SQL Editor)
```
python parser/ingest.py pdfs/2026-06-20 --sql
```
→ `supabase/ingest_2026-06-20.sql` 파일이 생깁니다.
→ Supabase Dashboard → **SQL Editor** 에 그 내용을 붙여넣고 **Run**.

### (선택) 미리보기 — DB 미반영, 파싱·예측 결과만 확인
```
python parser/ingest.py pdfs/2026-06-20 --dry-run
```

---

## 3. 확인

- https://xhrrace.vercel.app 새로고침
- 새 경주가 **"예정·진행"** 탭에 나타납니다.
- 예측(◎○▲ 우승확률)과 당일 조건 보정은 **자동 생성**됩니다.

---

## 4. 경기 후 — 실제 결과 입력

1. 경주 상세 페이지 열기
2. **"예측 우승 확률 비교"** 카드 우측 **"결과 입력"** 버튼
3. 각 마번의 **착순** 입력 → **저장**

→ 결과를 넣으면 그 경주는 홈 **"완료"** 탭으로 이동하고, 🏁1착·◎적중 표시와
   `/stats` 적중률 집계에 반영됩니다. (결과는 추가 적재해도 안 지워집니다)

---

## ⚠️ 주의사항

| 하지 말 것 | 대신 |
|---|---|
| `supabase/setup.sql` 실행 | ❌ 전체 삭제 후 재생성 → **지난 주가 사라짐** |
| `parser/gen_sql.py` 사용 | ❌ 위와 동일(legacy) |
| | ✅ 적재는 **항상 `parser/ingest.py`** |

- 같은 경주를 실수로 다시 적재해도 **그 경주만 갱신**되고 중복이 생기지 않습니다.
- `race_id = YYMMDD-경주번호` 라서 주마다 자연히 겹치지 않습니다.

---

## 요약 치트시트

```bash
# 1) PDF를 pdfs/2026-06-20/ 에 s_run_hr_260620_NN.pdf 형식으로 넣고
# 2) 적재
python parser/ingest.py pdfs/2026-06-20            # REST(키 필요)
python parser/ingest.py pdfs/2026-06-20 --sql      # 키 없이 SQL 생성
python parser/ingest.py pdfs/2026-06-20 --dry-run  # 미리보기
# 3) 사이트 확인 → 경기 후 결과 입력
```
