# 🎨 Figma to Code 변환 Best Practices

> **목적**: Figma 디자인을 효율적으로 코드로 변환하기 위한 준비 및 실행 가이드  
> **대상**: Flutter, Next.js (React) 프로젝트  
> **작성일**: 2025-08-13

---

## 📋 사전 준비 체크리스트

### **1. Figma 디자인 시스템 정리**

#### 필수 요소
```yaml
Design Tokens:
  ✅ Colors: 일관된 네이밍 (primary, secondary, error 등)
  ✅ Typography: 텍스트 스타일 정의 (h1, body, caption)
  ✅ Spacing: 8px 그리드 시스템
  ✅ Border Radius: 표준값 설정 (4px, 8px, 16px)
  ✅ Shadows: 레벨별 정의 (elevation-1, elevation-2)

Components:
  ✅ 기본 컴포넌트화 (Button, Input, Card)
  ✅ Variants 활용 (size, state, type)
  ✅ Auto Layout 적용
  ✅ 일관된 네이밍 규칙
```

#### Figma 구조 예시
```
Design System/
├── 🎨 Foundations/
│   ├── Colors
│   ├── Typography
│   └── Spacing
├── 🧩 Components/
│   ├── Buttons/
│   │   ├── Primary Button
│   │   ├── Secondary Button
│   │   └── Text Button
│   └── Forms/
│       ├── Input Field
│       └── Checkbox
└── 📱 Templates/
    ├── Login Screen
    └── Dashboard
```

### **2. 네이밍 컨벤션 통일**

#### Figma → Code 매핑
```yaml
Figma 레이어명:
  Button/Primary/Large → ButtonPrimaryLarge.tsx
  Card/Product → ProductCard.tsx
  Icon/Search/24 → SearchIcon24.tsx

색상 네이밍:
  Figma: Primary/500 → Code: theme.colors.primary[500]
  Figma: Surface/Background → Code: theme.colors.surface.background
```

### **3. 컴포넌트 준비 상태**

#### 체크포인트
```yaml
구조:
  ✅ Auto Layout 사용 (Flexbox 변환 용이)
  ✅ Constraints 설정 (반응형 대응)
  ✅ Component/Instance 구분 명확
  
상태:
  ✅ Hover, Active, Disabled 상태 정의
  ✅ 다크모드 variant 준비
  ✅ 반응형 breakpoint 정의
```

---

## 🔧 변환 전략

### **1. 수동 준비 + AI 변환 (추천)**

#### Step 1: Figma 내보내기
```javascript
// Figma Plugin: Design Tokens
{
  "colors": {
    "primary": "#007AFF",
    "secondary": "#5856D6"
  },
  "typography": {
    "h1": {
      "fontSize": 32,
      "fontWeight": 700,
      "lineHeight": 1.2
    }
  },
  "spacing": {
    "xs": 4,
    "sm": 8,
    "md": 16
  }
}
```

#### Step 2: Claude에 구조화된 요청
```markdown
다음 Figma 스펙으로 React 컴포넌트 생성해줘:

**컴포넌트**: PrimaryButton
**Props**:
- size: small | medium | large
- disabled: boolean
- onClick: function

**스타일**:
- Background: #007AFF
- Border Radius: 8px
- Padding: 12px 24px (medium)
- Font: 16px, weight 600

**상태**:
- Hover: opacity 0.9
- Disabled: opacity 0.5
```

### **2. Flutter 전용 전략**

#### 준비사항
```yaml
Figma 설정:
  - 디바이스 프레임 사용 (iPhone, Android)
  - Material Design 가이드라인 준수
  - dp 단위 사용

변환 템플릿:
```

```dart
// Claude 프롬프트
"이 Figma 디자인을 Flutter 위젯으로 변환해줘:
- Material 3 적용
- Responsive 처리
- Theme 연동
[Figma 스크린샷 첨부]"
```

### **3. Next.js/React 전용 전략**

#### 준비사항
```yaml
Figma 설정:
  - Web 프레임 사용
  - CSS Grid/Flexbox 고려한 레이아웃
  - rem 단위 사용

스타일 시스템:
  - CSS Modules or Styled Components
  - Tailwind 클래스 매핑
```

```typescript
// Claude 프롬프트
"Figma 컴포넌트를 Next.js로 변환:
- TypeScript 사용
- Tailwind CSS 적용
- 접근성 고려 (aria-label 등)
[Figma JSON 또는 스크린샷]"
```

---

## 🚀 MCP 서버 자동화 구축

### **Figma MCP Server 아키텍처**

```typescript
// figma-mcp-server.ts
class FigmaMCPServer {
  private figmaAPI: FigmaClient;
  private codeGenerator: CodeGenerator;
  
  async extractComponent(fileId: string, nodeId: string) {
    // 1. Figma API로 노드 정보 추출
    const node = await this.figmaAPI.getNode(fileId, nodeId);
    
    // 2. 스타일 정보 파싱
    const styles = this.parseStyles(node);
    
    // 3. 코드 생성
    return this.codeGenerator.generate({
      type: 'react', // or 'flutter'
      node,
      styles,
      options: {
        typescript: true,
        styling: 'tailwind' // or 'styled-components'
      }
    });
  }
  
  parseStyles(node: FigmaNode) {
    return {
      layout: this.extractLayout(node),
      colors: this.extractColors(node),
      typography: this.extractTypography(node),
      effects: this.extractEffects(node)
    };
  }
}
```

### **자동 변환 워크플로우**

```yaml
1. 디자이너 작업:
   - Figma에서 디자인 완성
   - 컴포넌트 태깅 (#ready-for-dev)
   
2. 자동 감지:
   - Figma Webhook → MCP Server
   - 변경사항 감지
   
3. 코드 생성:
   - MCP가 Claude 호출
   - 컴포넌트 코드 생성
   
4. PR 생성:
   - GitHub에 자동 PR
   - 스토리북 업데이트
   - 프리뷰 링크 생성
```

---

## 📊 성공 메트릭

### **측정 지표**
```yaml
효율성:
  - 디자인 → 코드 시간: 2시간 → 15분
  - 수정 반복 횟수: 5회 → 2회
  - 픽셀 퍼펙트 정확도: 95%+

품질:
  - 디자인 시스템 일관성: 100%
  - 접근성 준수율: WCAG AA
  - 반응형 커버리지: 모든 디바이스
```

---

## 🔍 일반적인 함정과 해결책

### **문제 1: 복잡한 애니메이션**
```yaml
문제: Figma 애니메이션 → 코드 변환 어려움
해결: 
  - Lottie 파일 별도 제작
  - 기본 transition만 자동화
  - 복잡한 것은 수동 구현
```

### **문제 2: 커스텀 그래픽**
```yaml
문제: 복잡한 일러스트/아이콘
해결:
  - SVG로 내보내기
  - 아이콘 폰트 활용
  - 이미지 최적화 파이프라인
```

### **문제 3: 동적 데이터**
```yaml
문제: 정적 디자인 → 동적 컴포넌트
해결:
  - 목업 데이터 준비
  - Props 인터페이스 정의
  - 엣지 케이스 고려
```

---

## ✅ 실전 체크리스트

### **Figma 준비**
- [ ] Design System 구축 완료
- [ ] 컴포넌트 라이브러리 정리
- [ ] Auto Layout 적용
- [ ] 네이밍 규칙 통일
- [ ] Design Tokens 추출

### **개발 환경**
- [ ] Figma API 토큰 발급
- [ ] 코드 템플릿 준비
- [ ] 스타일 시스템 결정
- [ ] MCP 서버 구축

### **프로세스**
- [ ] 디자이너-개발자 핸드오프 규칙
- [ ] 변환 가이드라인 문서화
- [ ] QA 체크리스트 작성

---

## 🎯 Quick Start

### **오늘 당장 시작하기**

1. **Figma 토큰 정리 (1시간)**
   ```javascript
   // colors.json
   {
     "primary": "#007AFF",
     "text": "#000000"
   }
   ```

2. **첫 컴포넌트 변환 (30분)**
   ```
   Claude: "이 Button 컴포넌트를 React로 변환해줘
   [Figma 스크린샷 + 스펙]"
   ```

3. **결과 검증 (30분)**
   - 스토리북에서 확인
   - 디자인 대조
   - 반응형 테스트

---

## 📚 참고 자료

### 도구
- **Figma Tokens Plugin**: 디자인 토큰 관리
- **Figma to React**: 기본 변환 도구
- **Anima**: Figma to Code 서비스
- **Builder.io**: Visual to Code

### 문서
- [Figma API Documentation](https://www.figma.com/developers/api)
- [Design Tokens W3C Spec](https://www.w3.org/community/design-tokens/)
- [Material Design Guidelines](https://material.io/design)

### Claude 프롬프트 템플릿
```markdown
# Figma to Code 변환 요청

## 컴포넌트 정보
- 이름: [컴포넌트명]
- 타입: [Button/Card/Form 등]
- 플랫폼: [Flutter/React]

## 디자인 스펙
[Figma 스크린샷 또는 JSON]

## 요구사항
- [ ] TypeScript/Dart
- [ ] 반응형 디자인
- [ ] 다크모드 지원
- [ ] 접근성 (a11y)

## 스타일 시스템
- [ ] Tailwind CSS
- [ ] Styled Components
- [ ] Material UI
```

---

**작성자**: Tech Lead  
**최종 업데이트**: 2025-08-13

*이 가이드는 실제 프로젝트 경험을 바탕으로 지속적으로 업데이트됩니다.*