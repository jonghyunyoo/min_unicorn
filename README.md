# 무지개 유니콘 숲 — glTF 3D 웹게임 v4

6살 어린이를 위한 3D 탐험·수집 게임입니다. GitHub Pages에서 바로 실행되며 진행 상황은 브라우저 localStorage에 자동 저장됩니다.

## v4 핵심 변경
- Three.js GLTFLoader 도입
- 플레이어 마법사를 **애니메이션 glTF 캐릭터**로 교체
- Idle / Walk / Run 애니메이션 자동 전환
- 유니콘은 **애니메이션 Horse GLB**를 기반으로 흰 몸, 붉은 갈기/꼬리, 금 장식, 금빛 뿔, 붉고 금빛인 대형 날개를 런타임에서 추가
- 유니콘 날개 움직임 + 원본 GLB 애니메이션 재생
- 풀, 꽃, 바위, 먼 산과 구름을 추가해 숲 밀도 개선
- 폭포를 커스텀 물 셰이더로 교체하고 물안개 효과 추가
- 기존 자동 저장/이어하기와 게임 진행 규칙 유지
- GLB/GLTF 로딩 실패 시 기존 절차적 모델이 폴백으로 남도록 구성

## 조작
- 모바일/iPad: 왼쪽 조이스틱 이동, 오른쪽 화면 스와이프로 시점 변경
- PC: WASD 또는 방향키 이동, 마우스 드래그로 시점 변경
- 걷기/뛰기 버튼으로 속도 선택

## 3D 모델 출처
- Wizard: Quaternius RPG Character Pack (CC0). 런타임 로딩은 `naufaldi/echoes-below`에 기록된 CC0 glTF 미러를 사용합니다.
- Horse: Quaternius Ultimate Animated Animal Pack (CC0). 런타임 로딩은 `BibliothecaDAO/eternum`에 기록된 CC0 GLB 변환본을 사용합니다.
- 유니콘의 붉은/금빛 날개, 뿔, 갈기, 꼬리, 장식은 이 게임에서 Three.js로 추가 생성합니다.

## 저장
기존 `ruf_save_v1` localStorage 키를 유지합니다. 같은 브라우저와 같은 GitHub Pages 주소에서는 기존 진행 상황을 이어서 사용할 수 있습니다.

## 네트워크
Three.js와 GLB/GLTF 모델은 CDN에서 불러오기 때문에 첫 실행에는 인터넷 연결이 필요합니다. 모델 로딩이 실패해도 게임은 기본 절차적 캐릭터로 계속 실행됩니다.
