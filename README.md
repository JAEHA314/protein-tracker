# Protein Tracker

무료로 사용할 수 있는 간단한 PWA 프로틴 트래커입니다.

## 현재 기능
- 하루 단백질 목표 설정
- 음식 이름 / 섭취량 / 단위 기록
- 100g당 단백질 기준 자동 계산
- 전체 단백질 직접 입력
- 오늘 섭취량 자동 합산
- 오늘 기록 삭제
- localStorage 저장
- PWA 설치 및 오프라인 캐시

## GitHub Pages 배포
1. GitHub에서 새 저장소를 만듭니다. 예: `protein-tracker`
2. 이 폴더의 파일을 저장소 최상단에 업로드합니다.
3. GitHub 저장소 → Settings → Pages
4. Build and deployment에서 `Deploy from a branch`
5. Branch를 `main`, 폴더를 `/(root)`로 선택 후 Save
6. 잠시 뒤 생성된 Pages 주소를 iPhone Safari로 엽니다.
7. Safari 공유 버튼 → `홈 화면에 추가`
8. 가능하면 `웹 앱으로 열기`가 켜진 상태로 추가합니다.

## 데이터
기록은 브라우저 localStorage에 저장됩니다.
Safari 데이터 삭제, 사이트 데이터 삭제, 기기 초기화 시 사라질 수 있으므로
중요한 장기 기록용이라면 이후 백업/내보내기 기능을 추가하는 것을 권장합니다.
