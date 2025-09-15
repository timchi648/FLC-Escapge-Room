/*
 * LABS QUEST – 스마트홈 어드벤처 (모바일 세로 고정 1024x1536)
 * - 모든 레이어는 #app(1024x1536) 내부에서만 렌더링되도록 수정
 * - 터치 친화적 사이즈 및 이펙트 개선
 * - 첫 사용자 상호작용 시 BGM 재생
 */

// ===== 전역 상태 =====
const state = {
  currentScene: null,
  lineIndex: 0,
  waitingClick: false,
  isNoteOpen: false,
  typing: false,
  currentTyping: null,
  skipRequested: false,
  missions: {
    south: false, // red (주작)
    north: false, // black (현무)
    west: false,  // white (백호)
    east: false,  // blue (청룡)
    center: false // yellow (황중앙)
  },
    tipsShown: {
      south:false,
      north:false,
      west:false,
      east:false,
      center:false
    },
  lastParkingCode: '1345',
  livingRoomLayer: null,
  // 현재 선택된 색온도(앰비언트 유지용). 초기값은 5700K(하얀빛).
  ambientKelvin: 5700,

  // === 추가된 전역 상태 (요구사항) ===
  // elec: 콘센트 전력을 차단하지 않았을 때 true, 3초간 전체끄기 유지로 차단되면 false
  // tiger: 자동차 장난감 비밀번호 해제 성공 시 true (실패/미해제는 false)
  // vent: 환기 전원이 ON이면 true, OFF면 false
  elec: true,   // 초기값: true
  tiger: false, // 초기값: false
  vent: false   // 초기값: false
};

// ===== DOM 참조 =====
const app = document.getElementById('app');
const backgroundEl = document.getElementById('background');
const ambientOverlay = document.getElementById('ambient-overlay'); // 색온도 배경 오버레이
const dialogueBox = document.getElementById('dialogue-box');
const portraitEl = document.getElementById('character-portrait');
const dialogueTextEl = document.getElementById('dialogue-text');
const choiceContainer = document.getElementById('choice-container');
const gaugeContainer = document.getElementById('gauge-container');
const gaugeSegments = {
  north: document.querySelector('.gauge-segment.north'),
  south: document.querySelector('.gauge-segment.south'),
  east: document.querySelector('.gauge-segment.east'),
  west: document.querySelector('.gauge-segment.west'),
  center: document.querySelector('.gauge-segment.center')
};
const modalContainer = document.getElementById('modal-container');
const toastEl = document.getElementById('toast');
const bgm = document.getElementById('bgm');

window.onerror = (m, s, l, c, e) => console.log('[ERR]', m, s+':'+l, e);
console.log('app?', !!document.getElementById('app'), 'vv?', !!window.visualViewport);

// 실제 가용 높이를 --vvh로 동기화 (주소창/회전 보정)
(function fitVisualViewport() {
  const apply = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    document.documentElement.style.setProperty('--vvh', vv.height + 'px');
  };
  apply();
  window.addEventListener('resize', apply);
  window.visualViewport && window.visualViewport.addEventListener('resize', apply);
})();

(function fitCenterLayout() {
  const APP_W = 1024, APP_H = 1536;
  const UPSCALE = true; // fitCenter (업/다운)

  function apply() {
    if (!app) return; // 안전 가드

    const vv = window.visualViewport;
    const w = Math.max(1, Math.round(vv?.width  || window.innerWidth  || document.documentElement.clientWidth  || 1));
    const h = Math.max(1, Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 1));

    const sRaw = Math.min(w / APP_W, h / APP_H);
    const s = UPSCALE ? sRaw : Math.min(1, sRaw);

    // 측정값이 불안정하면 다음 프레임에 재시도
    if (!isFinite(s) || s <= 0) {
      requestAnimationFrame(apply);
      return;
    }

    if (vv && typeof vv.offsetLeft === 'number' && typeof vv.offsetTop === 'number') {
      // ✅ visualViewport 보정 브랜치 (주소창/폴더블 오프셋 대응)
      const baseW = Math.round(window.innerWidth  || w);
      const baseH = Math.round(window.innerHeight || h);
      const x = ((baseW - APP_W * s) / 2) + vv.offsetLeft;
      const y = ((baseH - APP_H * s) / 2) + vv.offsetTop;

      app.style.top = '0';
      app.style.left = '0';
      app.style.transformOrigin = '0 0';
      app.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s})`;
    } else {
      // ✅ 폴백: 레이아웃 뷰포트 중앙 정렬
      app.style.top = '50%';
      app.style.left = '50%';
      app.style.transformOrigin = '50% 50%';
      app.style.transform = `translate(-50%, -50%) scale(${s})`;
    }

    app.style.visibility = 'visible'; // 첫 레이아웃 성공 → 노출
    relayoutInteractiveLayer();       // 레터박스 박스에 맞춰 핫스팟 재배치
  }

  // 첫 적용 전엔 깜빡임 방지
  if (app) app.style.visibility = 'hidden';

  // 즉시 1회 + 로드/회전/주소창 변화마다 재적용
  requestAnimationFrame(apply);
  window.addEventListener('load', apply);
  window.addEventListener('resize', apply);
  window.addEventListener('orientationchange', apply);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', apply);
    window.visualViewport.addEventListener('scroll', apply);
  }
})();

function wait(sec) {
    let start = Date.now(), now = start;
    while (now - start < sec * 1000) {
        now = Date.now();
    }
}

// ===== 이미지 프리로드 =====
const imageCache = {};
function preload(src) {
  if (!imageCache[src]) {
    const img = new Image();
    img.src = src;
    imageCache[src] = img;
  }
  return imageCache[src];
}

// ===== 토스트 =====
let toastTimeout = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.style.opacity = '1';
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.style.opacity = '0';
    toastTimeout = null;
  }, 1800);
}

// ===== 배경 페이드 전환 =====
// Fade the background to a new image
function ensureBgLayers() {
  if (!backgroundEl.querySelector('.bg-layer')) {
    const a = document.createElement('div');
    const b = document.createElement('div');
    a.className = 'bg-layer active';
    b.className = 'bg-layer';
    backgroundEl.appendChild(a);
    backgroundEl.appendChild(b);
  }
}

function getImageContentBox() {
  const appW = app.clientWidth;   // 1024
  const appH = app.clientHeight;  // 1536

  const active = backgroundEl.querySelector('.bg-layer.active');
  const src = active?.dataset.src;
  const im  = src && imageCache[src];
  if (!im || !im.naturalWidth || !im.naturalHeight) {
    return { left:0, top:0, width:appW, height:appH };
  }

  const iw = im.naturalWidth, ih = im.naturalHeight;
  const s  = Math.min(appW/iw, appH/ih); // fitCenter 스케일
  const width  = iw * s;
  const height = ih * s;
  const left   = (appW - width)  / 2;
  const top    = (appH - height) / 2;
  return { left, top, width, height };
}

function relayoutInteractiveLayer() {
  const layer = state.livingRoomLayer;
  if (!layer) return;
  const box = getImageContentBox();
  Object.assign(layer.style, {
    left:  box.left + 'px',
    top:   box.top  + 'px',
    width: box.width + 'px',
    height: box.height + 'px'
  });
}

let flip = false;
function setBackground(src) {
  ensureBgLayers();
  const [a, b] = backgroundEl.querySelectorAll('.bg-layer');
  const top  = flip ? b : a;
  const back = flip ? a : b;

  const img = preload(src);
  const swap = () => {
    back.style.backgroundImage   = `url("${src}")`;
    back.style.backgroundSize    = 'contain';   // 안전망
    back.style.backgroundPosition= 'center';
    back.style.backgroundRepeat  = 'no-repeat';

    back.dataset.src = src;                     // ✅ 현재 이미지 경로 보관
    top.classList.remove('active');
    back.classList.add('active');
    flip = !flip;

    relayoutInteractiveLayer();                 // ✅ 핫스팟/레이어 재배치
  };

  if (img.complete) swap();
  else img.addEventListener('load', swap, { once: true });
}

/* ===========================================================
   동적 배경 결정 (요구사항)
   - 장면 2 이후(즉, id >= 3) 모든 배경은 elec/tiger/vent 조합으로 결정
   =========================================================== */
function getDynamicBackgroundSrc() {
  const elecKey = state.elec ? 'elecon' : 'elecoff';
  const tigerKey = state.tiger ? 'tigeron' : 'tigeroff';
  const ventKey  = state.vent  ? 'venton'  : 'ventoff';
  return `assets/images/${elecKey}_${tigerKey}_${ventKey}.png`;
}

// 현재 장면이 동적 배경을 사용하는 경우 즉시 반영
function refreshDynamicBackgroundIfNeeded() {
  if (state.currentScene !== null && state.currentScene >= 3) {
    setBackground(getDynamicBackgroundSrc());
  }
}

// ===== 색온도 → RGB 근사 (Tanner Helland 알고리즘) =====
function kelvinToRGB(kelvin) {
  let temp = kelvin / 100;
  let r, g, b;

  // Red
  if (temp <= 66) {
    r = 255;
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592);
    r = Math.min(255, Math.max(0, r));
  }

  // Green
  if (temp <= 66) {
    g = 99.4708025861 * Math.log(temp) - 161.1195681661;
    g = Math.min(255, Math.max(0, g));
  } else {
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492);
    g = Math.min(255, Math.max(0, g));
  }

  // Blue
  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307;
    b = Math.min(255, Math.max(0, b));
  }

  return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

// ===== 배경 오버레이 색온도 적용(보정 강화) =====
function setAmbientFromKelvin(k) {
  if (!ambientOverlay) return;

  // 1) 물리 RGB
  const src = kelvinToRGB(k);

  // 2) '더 따뜻하게' 보이도록 목표색을 주황/노랑으로 설정
  const warmTarget = { r: 255, g: 176, b: 64 };

  // 3) 따뜻함 정도: 5700K(차가움)=0 → 3000K(따뜻함)=1
  const t = Math.min(1, Math.max(0, (5700 - k) / (5700 - 3000)));

  // 4) 색 보정(블렌딩): 따뜻할수록 목표색 쪽으로 더 강하게
  const blend = (a, b, amt) => Math.round(a + (b - a) * amt);
  const blendAmt = 0.25 + 0.55 * t; // 최대 약 0.8까지 당김
  const r = blend(src.r, warmTarget.r, blendAmt);
  const g = blend(src.g, warmTarget.g, blendAmt);
  const b = blend(src.b, warmTarget.b, blendAmt);
  ambientOverlay.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;

  // 5) 불투명도: 따뜻할수록 더 두껍게(최대 약 0.7)
  const baseOpacity = 0.25; // 차가운 쪽 최소
  const extra = 0.45 * t;   // 따뜻할수록 추가
  ambientOverlay.style.opacity = String(baseOpacity + extra);
}

// ===== 게이지 업데이트 =====
function updateGauge() {
  ['north','south','east','west','center'].forEach(dir => {
    if (state.missions[dir]) {
      gaugeSegments[dir].classList.add('active');
    } else {
      gaugeSegments[dir].classList.remove('active');
    }
  });
}

// ===== 사신 연출 =====
(function ensureCreatureKeyframes(){
  if (document.getElementById('creature-anim-style')) return;
  const s = document.createElement('style');
  s.id = 'creature-anim-style';
  s.textContent = `
    @keyframes fadeCreature { from{opacity:0; transform:scale(.88)} to{opacity:1; transform:scale(1)} }
    @-webkit-keyframes fadeCreature { from{opacity:0; -webkit-transform:scale(.88)} to{opacity:1; -webkit-transform:scale(1)} }
  `;
  document.head.appendChild(s);
})();

function showCreature(creature, onDone) {
  // 최상위 z-index 계산
  const topZ = Math.max(
    parseInt(getComputedStyle(modalContainer).zIndex) || 0,
    parseInt(getComputedStyle(dialogueBox).zIndex) || 0,
    parseInt(getComputedStyle(toastEl).zIndex) || 0,
    parseInt(getComputedStyle(gaugeContainer).zIndex) || 0,
    0
  ) + 20;

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'absolute',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: String(topZ),
    pointerEvents: 'none',
    background: 'rgba(0,0,0,0.45)',
    opacity: '0',
    transition: 'opacity .2s ease'
  });

  const img = new Image();
  img.src = `assets/images/${creature}.png`;
  Object.assign(img.style, {
    width: 'min(80vw, 560px)',
    maxWidth: '100%',
    height: 'auto',
    objectFit: 'contain',
    willChange: 'transform, opacity',
    animation: 'fadeCreature 1.2s ease forwards'
  });

  overlay.appendChild(img);
  app.appendChild(overlay);

  const start = () => {
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    setTimeout(() => {
      overlay.remove();
      if (typeof onDone === 'function') onDone();
    }, 1300); // 애니 끝난 뒤 콜백
  };

  if (img.complete) start();
  else img.addEventListener('load', start, { once: true });
}

// ===== 시스템 팁 모달(흰 배경 + 주황 테두리) =====
(function ensureSystemTipStyles(){
  if (document.getElementById('system-tip-style')) return;
  const s = document.createElement('style');
  s.id = 'system-tip-style';
  s.textContent = `
    .modal-content.system-tip {
      background:#fff !important;
      color:#111 !important;
      border:2px solid #FFA63B;
      border-radius:16px;
      box-shadow: 0 20px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(255,166,59,.2) inset;
    }
    .system-tip h3 { margin:0 0 .4rem 0; font-size:1.05rem; color:#111; }
    .system-tip p  { margin:.3rem 0; font-size:.9rem; color:#222; }
    .btn-tip {
      background:#FFA63B; color:#111; border:none; border-radius:12px;
      padding:.6rem 1rem; font-size:.85rem; cursor:pointer;
      box-shadow:0 8px 16px rgba(0,0,0,.25);
      transition: transform .1s ease, box-shadow .1s ease;
    }
    .btn-tip:active { transform: translateY(1px); box-shadow:0 6px 12px rgba(0,0,0,.25); }
  `;
  document.head.appendChild(s);
})();

function showSystemTip(which, onClose) {
  // 이미 보여준 팁이면 즉시 다음 흐름 진행
  if (state.tipsShown?.[which]) { if (onClose) onClose(); return; }
  if (!state.tipsShown) state.tipsShown = {};
  state.tipsShown[which] = true;

  const map = {
    south: { title: '🔥 조명',    msg: '베스틴 스마트홈에서는 월패드를 통해 색온도를 제어할 수 있습니다!<br>베스틴 스마트홈에서 자신만의 색온도 모드를 정의해보세요.' },
    north: { title: '🐢 전력',    msg: '베스틴 스마트홈의 스마트 콘센트에서 전력 사용량을 관리하고, 대기전력을 차단할 수 있습니다.<br>베스틴 스마트홈으로 더욱 스마트하게 효율적으로 에너지를 사용하세요!' },
    west:  { title: '🐯 보안',    msg: '베스틴 스마트홈에서는 출차기록을 남기고 관리할 수 있습니다. 뛰어난 보안과 편의는 덤이죠!' },
    east:  { title: '🐉 환기',    msg: '베스틴 스마트홈에서는 월패드에서 환기를 켤 수 있습니다.<br>필터 교체 시기, 공기질 모두 자동으로 관리해요!' },
    center:  { title: '🔒 보안',    msg: '베스틴 도어락과 보안 시스템으로 더욱 안전한 우리집을 만들 수 있습니다.' },
  };
  const info = map[which] || { title:'안내', msg:'스마트홈 기능을 확인해보세요.' };

  modalContainer.innerHTML = `
    <div class="modal-content system-tip" style="max-width: 820px;">
      <h3>${info.title}</h3>
      <p>${info.msg}</p>
      <div style="text-align:center; margin-top:.8rem;">
        <button class="btn-tip" id="tip-ok">확인</button>
      </div>
    </div>`;
  modalContainer.classList.remove('hidden');

  const finish = () => {
    modalContainer.classList.add('hidden');
    modalContainer.innerHTML = '';
    if (onClose) onClose();
  };

  modalContainer.onclick = (e) => {
    if (!e.target.closest('.modal-content')) finish();
  };
  document.getElementById('tip-ok')?.addEventListener('click', finish);
}


// keyframes (사신 페이드)
const creatureStyle = document.createElement('style');
creatureStyle.textContent = `
  @keyframes fadeCreature {
    from { opacity: 0; transform: scale(0.88);}
    to   { opacity: 1; transform: scale(1);}
  }
`;
document.head.appendChild(creatureStyle);

// ===== 타자기 효과 =====
function typeText(text, callback) {
  state.typing = true;
  state.skipRequested = false;
  dialogueTextEl.innerHTML = '';
  let index = 0;

  function step() {
    if (state.skipRequested) {
      dialogueTextEl.innerHTML = text.replace(/\n/g, '<br>');
      state.typing = false;
      callback && callback();
      return;
    }
    const char = text[index];
    if (char === '\n') {
      dialogueTextEl.innerHTML += '<br>';
    } else {
      dialogueTextEl.innerHTML += char;
    }
    index++;
    if (index < text.length) {
      state.currentTyping = setTimeout(step, 26);
    } else {
      state.typing = false;
      callback && callback();
    }
  }
  step();
}

// ===== 다음 대사/로직 =====
function showNextLine() {
  const scene = scenes.find(s => s.id === state.currentScene);
  if (!scene) return;

  if (scene.script && state.lineIndex < scene.script.length) {
    const line = scene.script[state.lineIndex];
    state.lineIndex++;

    if (line.expression) {
      portraitEl.src = line.expression;
      portraitEl.style.display = 'block';
    } else {
      portraitEl.style.display = 'none';
    }

    dialogueBox.classList.remove('hidden');

    typeText(line.text, () => {
      state.waitingClick = true;
      if (state.lineIndex === scene.script.length && scene.choices) {
        showChoices(scene.choices);
      }
    });
  } else {
    dialogueBox.classList.add('hidden');

    if (scene.choices) {
      showChoices(scene.choices);
      return;
    }
    if (scene.process) {
      scene.process();
      return;
    }
    if (scene.nextScene) {
      showScene(scene.nextScene);
      return;
    }
  }
}

// ===== 선택지 =====
function showChoices(choices) {
  choiceContainer.innerHTML = '';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.textContent = choice.text;
    btn.addEventListener('click', () => {
      choiceContainer.innerHTML = '';
      if (choice.onSelect) choice.onSelect();
      if (choice.nextScene) showScene(choice.nextScene);
    });
    choiceContainer.appendChild(btn);
  });
}

/* ===========================================================
   씬 전환
   - id < 3: 기존 scene.background 사용
   - id >= 3: 전역 상태(elec/tiger/vent) 조합으로 동적 배경 적용
   =========================================================== */
function showScene(id) {
  if (state.livingRoomLayer) {
    state.livingRoomLayer.remove();
    state.livingRoomLayer = null;
  }
  modalContainer.classList.add('hidden');
  modalContainer.innerHTML = '';
  choiceContainer.innerHTML = '';
  dialogueBox.classList.add('hidden');
  state.lineIndex = 0;
  state.currentScene = id;

  const scene = scenes.find(s => s.id === id);
  if (!scene) return;

  if (id >= 3) {
    setBackground(getDynamicBackgroundSrc());
  } else {
    if (scene.background) setBackground(scene.background);
  }

  if (id >= 3) {
    gaugeContainer.style.display = 'block';
  } else {
    gaugeContainer.style.display = 'none';
  }
  updateGauge();

  if (scene.script && scene.script.length > 0) {
    showNextLine();
  } else if (scene.process) {
    scene.process();
  }
}

// 대사 클릭/스킵 =====
let lastAdvanceAt = 0;                     // ← 추가

function advanceDialogue() {
  const now = Date.now();                  // ← 추가
  if (now - lastAdvanceAt < 220) return;   // ← 220ms 내 중복 호출 무시
  lastAdvanceAt = now;                     // ← 추가

  if (modalContainer && !modalContainer.classList.contains('hidden')) return; // 모달 열렸으면 무시
  if (state.typing) { state.skipRequested = true; return; }
  if (state.waitingClick) { state.waitingClick = false; showNextLine(); }
}

dialogueBox.addEventListener('pointerdown', (e) => {
  e.preventDefault();        // ← click 생성 억제
  e.stopPropagation();       // ← 상위 app의 pointerdown으로 올라가는 것 차단
  advanceDialogue();
}, { passive: false });

let lastHintAt = 0;

function shouldShowHintTap(e) {
    // 모달 열려있으면 힌트 X
    if (isModalOpen()) return false;
    // 대화창이 보이면(=스토리 중) 힌트 대신 진행
    if (!dialogueBox.classList.contains('hidden')) return false;
    // 거실 인터랙션 레이어가 있을 때만 (씬 3)
    if (!state.livingRoomLayer) return false;
    return true;
}

// 현재 미션 상황에 맞는 힌트 문구 선택
function getContextHint() {
    // 우선순위: 남쪽(주작) → 서쪽(백호) → 북쪽(현무) → 동쪽(청룡) → 센터
    if (!state.isNoteOpen) {
      return '액자의 문구를 살펴보자.';
    }
    if (!state.missions.south) {
        return '방을 노을빛으로 만드려면 어떻게 해야할까?';
    }
    if (!state.missions.north) {
        return '모든 전원을 끄고 3초간 유지해 보자. 콘센트는 월패드에서 제어할 수 있어.';
    }
    if (!state.missions.west) {
        return '출차시간을 확인해서 호랑이 자동차의 잠금을 풀자.';
    }
    if (!state.missions.east) {
        return '환기를 켜서 공기를 맑게 만들어 보자. 월패드의 환기에서 켤 수 있어.';
    }
    if (state.missions.north && state.missions.south && state.missions.west && state.missions.east && !state.missions.center) {
        return '사방신의 힘이 모였어. 다음 단계로 진행해 볼까?';
    }
    // 전부 완료면 가벼운 안내
    return '월패드, 액자, 호랑이 자동차 중 하나를 눌러 볼까?';
}

// (선택) 화면 아무 곳 탭해도 진행/힌트
app.addEventListener('pointerdown', (e) => {
    // 인터랙티브 요소 위 탭이면 원래 동작 유지
    if (e.target.closest('.modal-content, #choice-container, .vslider, .hotspot, button, a')) return;

    // 거실에서 대화창이 없고(=스토리 아님), 모달도 없고, 핫스팟이 아닌 영역 → 힌트
    if (shouldShowHintTap(e)) {
        const now = Date.now();
        if (now - lastHintAt > 2000) { // 1초 쿨다운
            const msg = getContextHint();
            if (msg) showToast(msg);
            lastHintAt = now;
        }
        return; // 힌트만 띄우고 스토리 진행은 막음
    }

    // 그 외(예: 스토리 장면) → 기존 진행 로직
    advanceDialogue();
}, { passive: true });


// ===== 씬 정의 =====
const scenes = [
  {
    id: 1,
    background: 'assets/images/ruined_city.png',
    script: [
      { speaker: 'Narrator', text: '도사가 사라지고, 스마트홈 시스템이 마비됐다.' }
    ],
    nextScene: 2
  },
  {
    id: 2,
    background: 'assets/images/ruined_city.png',
    script: [
      {
        speaker: '도사',
        expression: 'assets/images/sage_face.png',
        text: '제자여.. 스마트홈에 숨어있는 4개의 생활 주문을 풀어 사방신을 깨워야한다. 그래야 이 재앙을 멈출 수 있다.'
      },
      { speaker: 'Narrator',
        text: '나는 도사의 제자.\n도사님의 의지를 이어받아 스마트홈의 문제를 해결해야 한다.' },
      {
        speaker: 'Narrator',
        text: '베스틴 스마트홈에 가보자.'
      }
    ],
    nextScene: 3
  },
  {
    id: 3,
    // background는 무시되고 동적 배경으로 대체됨
    background: 'assets/images/living_room.png',
    script: [
      {
        speaker: 'Narrator',
        text: '베스틴 스마트홈에 도착했다. 이제 사방신을 깨워 스마트홈을 수호하게 만들어야 한다.'
      }
      ,{ speaker: 'Narrator',
        text: '거실에는 월패드와 흰 호랑이 장난감 자동차, 액자가 보인다. 무엇을 먼저 살펴볼까?' }
    ],
    process: runLivingRoom
  },
  {
    id: 4,
    // 이후 씬들도 모두 동적 배경 사용
    background: 'assets/images/peaceful_city.png',
    script: [
      { speaker: 'Narrator', text: '모든 생활 주문이 풀리자, 사방신의 힘이 하나로 모였다.' }
    ],
    process: runGaugeComplete
  },
  {
    id: 5,
    background: 'assets/images/peaceful_city.png',
    script: [],
    process: runInfiltration
  },
  {
    id: 6,
    background: 'assets/images/peaceful_city.png',
    script: [
      { speaker: '도사', expression: 'assets/images/sage_face.png', text: '제자여. 스마트홈의 사방신을 모두 깨웠구나.' },
      { speaker: '도사', expression: 'assets/images/sage_face.png', text: '사실 스마트홈 시스템을 멈춘 건 나였다.' },
      { speaker: '도사', expression: 'assets/images/sage_face.png', text: '너의 능력을 테스트하기 위함이었지.' },
      { speaker: '도사', expression: 'assets/images/sage_face.png', text: '베스틴 스마트홈의 관리자는 스마트홈의 기능을 이해하고, 지혜가 있어야한다.' },
      { speaker: '도사', expression: 'assets/images/sage_face.png', text: '너는 조명·전력·보안·환기를 정확히 다뤘구나.' },
      { speaker: '도사', expression: 'assets/images/sage_face.png', text: '지금부터 베스틴 스마트홈 관리자의 자격을 맡기노라.' },
      { speaker: '도사', expression: 'assets/images/sage_face.png', text: '난 이제 편히 눈을 감을 수 있겠구나. 축하한다.' }
    ],
    nextScene: 7
  },
  {
    id: 7,
    background: 'assets/images/peaceful_city.png',
    script: [
      { speaker: 'Narrator', text: '시스템 복구 완료.' },
      { speaker: 'Narrator', text: '난 베스틴 스마트홈 관리자가 되었다.' }
    ],
    nextScene: null
  }
];

// ===== 거실 인터랙션 레이어 =====

function isModalOpen() {
  return modalContainer && !modalContainer.classList.contains('hidden');
}

function runLivingRoom() {
  gaugeContainer.style.display = 'block';
  updateGauge();

  const layer = document.createElement('div');
  layer.id = 'interactive-layer';
  layer.style.position = 'absolute';
  layer.style.top = '0';
  layer.style.left = '0';
  layer.style.width = '100%';
  layer.style.height = '100%';
  layer.style.zIndex = '4';
  layer.style.pointerEvents = 'none';

  // 월패드 (좌측 벽)
  const wallpad = document.createElement('div');
  wallpad.classList.add('hotspot');
  wallpad.style.position = 'absolute';
  wallpad.style.top = '30%';
  wallpad.style.left = '5%';
  wallpad.style.width = '22%';
  wallpad.style.height = '40%';
  wallpad.style.cursor = 'pointer';
  wallpad.style.pointerEvents = 'auto';
  wallpad.setAttribute('title', '월패드');
  // 월패드
  wallpad.addEventListener('click', (e) => {
    if (isModalOpen()) return;   // ← 모달 켜져 있으면 무시
    openWallpad();
  });
  layer.appendChild(wallpad);

  // 액자 (소파 위)
  const frame = document.createElement('div');
  frame.classList.add('hotspot');
  frame.style.position = 'absolute';
  frame.style.top = '30%';
  frame.style.left = '40%';
  frame.style.width = '20%';
  frame.style.height = '25%';
  frame.style.cursor = 'pointer';
  frame.style.pointerEvents = 'auto';
  frame.setAttribute('title', '액자');
  frame.addEventListener('click', (e) => {
  if (isModalOpen()) return;   // ← 모달 켜져 있으면 무시
  openNote();
});
  layer.appendChild(frame);

  // 장난감 자동차 (하단 좌측)
  const car = document.createElement('div');
  car.classList.add('hotspot');
  car.style.position = 'absolute';
  car.style.top = '70%';
  car.style.left = '15%';
  car.style.width = '20%';
  car.style.height = '20%';
  car.style.cursor = 'pointer';
  car.style.pointerEvents = 'auto';
  car.setAttribute('title', '장난감 자동차');
  car.addEventListener('click', (e) => {
    if (isModalOpen()) return;   // ← 모달 켜져 있으면 무시
    if (!state.missions.west) openCarLock();
  });
  layer.appendChild(car);

  app.appendChild(layer);
  state.livingRoomLayer = layer;
  relayoutInteractiveLayer();
}

// ===== 쪽지 =====
function openNote() {
  state.isNoteOpen = true;
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.setProperty('--modal-max', '840px');
  content.innerHTML = `
    <h3>쪽지</h3>
    <p>방을 노을빛으로 물들이면 사방신 주작이 깨어난다.</p>
    <p>현무의 물결은 잔잔해야 한다. 3초간 방에 전기가 흐르지 않도록 유지해라.</p>
    <p>철마차가 떠난 시각을 기억하라. 그럼 백호가 움직일 것이다.</p>
    <p>청룡이 나타날 수 있도록, 깨끗한 하늘과 같은 환경을 만들어라.</p>
    <div style="text-align:center;margin-top:1rem;">
      <button id="close-note" class="btn-secondary">닫기</button>
    </div>
  `;
  modalContainer.innerHTML = '';
  modalContainer.appendChild(content);
  modalContainer.classList.remove('hidden');
  modalContainer.addEventListener('click', (e) => {
    if (!e.target.closest('.modal-content')) modalContainer.classList.add('hidden');
  });
  document.getElementById('close-note').addEventListener('click', () => {
    modalContainer.classList.add('hidden');
  });
}

// ===== 월패드 홈 =====


function openWallpad() {
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.setProperty('--modal-max', '960px');

  const title = document.createElement('h3');
  title.textContent = '월패드';
  title.style.textAlign = 'center';
  title.style.marginBottom = '0.5rem';
  content.appendChild(title);

  const padWrapper = document.createElement('div');
  padWrapper.style.position = 'relative';
  padWrapper.style.width = '100%';
  padWrapper.style.borderRadius = '16px';
  padWrapper.style.overflow = 'hidden';
  padWrapper.style.marginBottom = '1rem';
  padWrapper.style.touchAction = 'manipulation';

  const img = document.createElement('img');
  img.src = 'assets/images/wallpad_home.png';
  img.style.width = '100%';
  img.style.display = 'block';
  img.draggable = false;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.style.pointerEvents = 'none';     // 이미지가 이벤트 먹지 않도록
  padWrapper.appendChild(img);

  // 아이콘 영역 정의 (0~1 비율 좌표)
  const ICONS = [
    { key:'parking',  label:'출차기록', onClick: openParking,
      rect:{ left:0.50, top:0.15, width:0.2, height:0.3 } },
    { key:'light',    label:'조명',     onClick: openLighting,
      rect:{ left:0.7, top:0.15, width:0.2, height:0.3 } },
    { key:'vent',     label:'환기',     onClick: openVentilation,
      rect:{ left:0.50, top:0.5, width:0.2, height:0.3 } },
    { key:'outlet',   label:'콘센트',   onClick: openOutlet,
      rect:{ left:0.7, top:0.5, width:0.2, height:0.3 } },
  ];

  // (선택) 디버그 박스: 클릭과 무관, 시각화만 함
  const dbg = document.createElement('div');
  dbg.style.position = 'absolute';
  dbg.style.inset = '0';
  dbg.style.pointerEvents = 'none';     // ← 클릭 가로채지 않음
  padWrapper.appendChild(dbg);
  // padWrapper.classList.add('debug'); // 켜면 박스 보이게
  if (padWrapper.classList.contains('debug')) {
    ICONS.forEach(ic => {
      const box = document.createElement('div');
      box.style.position = 'absolute';
      box.style.left   = (ic.rect.left  * 100) + '%';
      box.style.top    = (ic.rect.top   * 100) + '%';
      box.style.width  = (ic.rect.width * 100) + '%';
      box.style.height = (ic.rect.height* 100) + '%';
      box.style.outline = '2px dashed rgba(0,255,255,.7)';
      box.style.background = 'rgba(0,255,255,.08)';
      box.style.pointerEvents = 'none';
      dbg.appendChild(box);
    });
  }

  // ✅ 한 군데(padWrapper)에서만 클릭을 받아 좌표 판정
  padWrapper.addEventListener('pointerup', (e) => {
    // 모달 외부로 전파 금지
    e.stopPropagation();

    const rect = padWrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;   // 0~1
    const y = (e.clientY - rect.top)  / rect.height;  // 0~1

    const hit = ICONS.find(ic =>
      x >= ic.rect.left && x <= ic.rect.left + ic.rect.width &&
      y >= ic.rect.top  && y <= ic.rect.top  + ic.rect.height
    );

    if (hit) {
      console.log('[HIT-map]', hit.key, x.toFixed(3), y.toFixed(3));
      requestAnimationFrame(() => hit.onClick());
    }
  }, { passive: true });

  // 모달 내부 이벤트는 앱으로 버블 금지
  content.addEventListener('pointerdown', (e) => e.stopPropagation(), { passive: true });
  content.addEventListener('click', (e) => e.stopPropagation());

  content.appendChild(padWrapper);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '닫기';
  closeBtn.className = 'btn-secondary';
  closeBtn.style.display = 'block';
  closeBtn.style.margin = '0 auto';
  closeBtn.addEventListener('click', () => modalContainer.classList.add('hidden'));
  content.appendChild(closeBtn);

  modalContainer.innerHTML = '';
  modalContainer.appendChild(content);
  modalContainer.classList.remove('hidden');
}

// 모달 백드롭 틴트 제거(원복)
function clearModalBackdropTint() {
  if (!modalContainer) return;
  modalContainer.style.background = 'rgba(0,0,0,0.45)';
}


/* =========================================
   조명 – 실제 월패드 색온도 슬라이더 구현 (개선)
   ========================================= */
function openLighting() {
  const content = document.createElement('div');
  content.className = 'modal-content tintable-light'; /* 모달 틴팅 활성 */
  content.style.setProperty('--modal-max', '960px');

  content.innerHTML = `
    <h3>조명 제어</h3>
    <p style="margin-top:0.2rem">오른쪽 <strong>세로 슬라이더</strong>를 드래그하여 색온도를 조절하세요. (위쪽=하얀빛, 아래쪽=노을빛)</p>

    <div class="wallpad-light-wrap" aria-label="월패드 조명 제어 화면">
      <img class="wallpad-light-img" src="assets/images/Color_Temperature_Adjustment_Screen.png" alt="월패드 색온도 조절 화면" />
      <!-- 실제로 동작하는 커스텀 세로 슬라이더 (이미지 위에 정밀 오버레이) -->
      <div id="ct-slider" class="vslider" role="slider" aria-label="색온도" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
        <div class="vslider-track" aria-hidden="true"></div>
        <div class="vslider-thumb" aria-hidden="true"></div>
      </div>
    </div>

    <div class="ct-readout-wrap">
      <div id="ct-swatch" class="ct-swatch" aria-hidden="true"></div>
      <p id="ct-readout" class="ct-readout">색온도 5700K · 차가운 흰색</p>
    </div>

    <div style="text-align:center; margin-top:1rem;">
      <button id="light-close" class="btn-secondary">닫기</button>
    </div>
  `;

  modalContainer.innerHTML = '';
  modalContainer.appendChild(content);
  modalContainer.classList.remove('hidden');

  const slider = content.querySelector('#ct-slider');
  const thumb = slider.querySelector('.vslider-thumb');
  const readout = content.querySelector('#ct-readout');
  const swatch  = content.querySelector('#ct-swatch');

  // value: 0(상단, 하얀색=5700K) ~ 100(하단, 노란색=3000K)
  // 현재 유지 중인 색온도(state.ambientKelvin)를 슬라이더 위치로 반영
  const K_MIN = 3000, K_MAX = 5700;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  function valueToKelvin(v) {
    const t = v / 100; // 0 → 1
    return Math.round(K_MAX - (K_MAX - K_MIN) * t);
  }
  function kelvinToValue(k) {
    // k=5700 -> 0, k=3000 -> 100
    const t = (K_MAX - k) / (K_MAX - K_MIN);
    return clamp(Math.round(t * 100), 0, 100);
  }

  function kelvinToLabel(k) {
    if (k >= 5200) return '차가운 흰색';
    if (k >= 4200) return '중성 백색';
    if (k >= 3600) return '따뜻한 백색';
    return '노을빛';
  }

  function updateSwatchFromKelvin(k) {
    const { r, g, b } = kelvinToRGB(k);
    swatch.style.background = `rgb(${r},${g},${b})`;
  }

  // 모달 자체 틴트(색온도 연동) - CSS 변수 업데이트
  function setModalTintFromKelvin(k) {
    // ambient와 동일한 보정 로직을 사용하되, 과하지 않게 알파만 다르게
    const src = kelvinToRGB(k);
    const warmTarget = { r: 255, g: 176, b: 64 };
    const t = Math.min(1, Math.max(0, (K_MAX - k) / (K_MAX - K_MIN)));
    const blendAmt = 0.22 + 0.50 * t; // 모달은 ambient보다 약간 낮게
    const r = Math.round(src.r + (warmTarget.r - src.r) * blendAmt);
    const g = Math.round(src.g + (warmTarget.g - src.g) * blendAmt);
    const b = Math.round(src.b + (warmTarget.b - src.b) * blendAmt);

    // 따뜻할수록 강하게: top/bottom 알파 및 스트로크 알파 가변
    const aTop = (0.08 + 0.28 * t).toFixed(3);     // 0.08 ~ 0.36
    const aBottom = (0.04 + 0.20 * t).toFixed(3);  // 0.04 ~ 0.24
    const aStroke = (0.06 + 0.22 * t).toFixed(3);  // 0.06 ~ 0.28

    content.style.setProperty('--modal-tint-rgb', `${r}, ${g}, ${b}`);
    content.style.setProperty('--modal-tint-alpha-top', aTop);
    content.style.setProperty('--modal-tint-alpha-bottom', aBottom);
    content.style.setProperty('--modal-stroke-alpha', aStroke);
  }

  // 조명 배경(앰비언트) 동기화
  let sunsetTimer = null; // '노을빛' 1초 유지 체크

  // 초기 상태를 현재 유지 중인 색온도로 세팅
  let value = kelvinToValue(state.ambientKelvin);

  function render() {
    // thumb 위치 (중심 정렬)
    thumb.style.top = `${value}%`;
    slider.setAttribute('aria-valuenow', String(Math.round(value)));

    const k = valueToKelvin(value);
    readout.textContent = `색온도 ${k}K · ${kelvinToLabel(k)}`;
    updateSwatchFromKelvin(k);

    // 배경/모달 동시에 업데이트 (항상 표시)
    setAmbientFromKelvin(k);
    setModalTintFromKelvin(k);


    const label = kelvinToLabel(k);

    // '노을빛' 조건 1초 유지 시 주작 발동
    if (label === '노을빛' && !state.missions.south) {
      if (!sunsetTimer) {
        sunsetTimer = setTimeout(() => {
          const currentK = valueToKelvin(value);
          if (kelvinToLabel(currentK) === '노을빛' && !state.missions.south) {
            state.missions.south = true;
            updateGauge();
            showCreature('phoenix', () => showSystemTip('south'));
            showToast('주작의 힘이 깨어났습니다!');
            // 노을빛 유지: 현재 색온도를 상태에 저장하고 모달만 닫음
            state.ambientKelvin = currentK;
            setAmbientFromKelvin(state.ambientKelvin);
            setTimeout(() => {
              modalContainer.classList.add('hidden');
              // 모달 CSS 변수 초기화
              content.style.removeProperty('--modal-tint-rgb');
              content.style.removeProperty('--modal-tint-alpha-top');
              content.style.removeProperty('--modal-tint-alpha-bottom');
              content.style.removeProperty('--modal-stroke-alpha');
              checkAllMissions();
            }, 1200);
          }
          sunsetTimer = null;
        }, 1000); // 1초 지연
      }
    } else {
      // 노을빛에서 벗어나면 타이머 취소
      if (sunsetTimer) {
        clearTimeout(sunsetTimer);
        sunsetTimer = null;
      }
    }
  }

  function setValue(v) {
    value = clamp(v, 0, 100);
    render();
  }

  function clientYToValue(clientY) {
    const rect = slider.getBoundingClientRect();
    const percent = ((clientY - rect.top) / rect.height) * 100;
    return Math.max(0, Math.min(100, percent));
  }

  // 포인터(마우스/터치) 처리
  function onPointerDown(e) {
    e.preventDefault();
    slider.setPointerCapture?.(e.pointerId);
    setValue(clientYToValue(e.clientY));

    const move = (ev) => setValue(clientYToValue(ev.clientY));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  slider.addEventListener('pointerdown', onPointerDown, { passive: false });

  // 키보드 접근성
  slider.addEventListener('keydown', (e) => {
    const step = (e.shiftKey ? 10 : 3);
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      setValue(value + step);
      e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      setValue(value - step);
      e.preventDefault();
    } else if (e.key === 'Home') {
      setValue(0); e.preventDefault();
    } else if (e.key === 'End') {
      setValue(100); e.preventDefault();
    }
  });

  // 초기 렌더 (현재 유지 중인 색온도로)
  requestAnimationFrame(render);

  // 닫기
  content.querySelector('#light-close').addEventListener('click', () => {
    if (sunsetTimer) {
      clearTimeout(sunsetTimer);
      sunsetTimer = null;
    }
    // 닫기 시에도 현재 설정 색온도를 '유지'
    state.ambientKelvin = valueToKelvin(value);
    setAmbientFromKelvin(state.ambientKelvin);

    modalContainer.classList.add('hidden');
    // 모달 CSS 변수 정리
    content.style.removeProperty('--modal-tint-rgb');
    content.style.removeProperty('--modal-tint-alpha-top');
    content.style.removeProperty('--modal-tint-alpha-bottom');
    content.style.removeProperty('--modal-stroke-alpha');
  });
}

// ===== 콘센트 =====
function openOutlet() {
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.setProperty('--modal-max', '960px');

  const outletImgSrc = state.elec
    ? 'assets/images/elecon.png'
    : 'assets/images/elecoff.png';

  content.innerHTML = `
    <h3>콘센트 제어</h3>
    <p style="margin-top:0.3rem;">모든 전원을 끄고 3초간 유지하세요.</p>

    <div style="position:relative; width:100%; margin-top:0.8rem;">
      <img id="outlet-img" src="${outletImgSrc}" alt="콘센트 상태"
           class="outlet-img" />
    </div>

    <div style="text-align:center; margin-top:1rem;">
      <button id="outlet-close" class="btn-secondary">닫기</button>
    </div>
  `;

  modalContainer.innerHTML = '';
  modalContainer.appendChild(content);
  modalContainer.classList.remove('hidden');

  const outletImg = content.querySelector('#outlet-img');

  // OFF 유지 카운트다운 타이머 관리
  let offTimers = [];
  let offFlowActive = false;
  function clearOffFlow() {
    offTimers.forEach(t => clearTimeout(t));
    offTimers = [];
    offFlowActive = false;
  }

  function startOffFlow() {
    clearOffFlow();
    offFlowActive = true;

    // 즉시 OFF 토스트
    showToast('전원 off');

    // 1, 2, 3초 경과 토스트
    offTimers.push(setTimeout(() => { if (!state.elec && offFlowActive) showToast('1초'); }, 1000));
    offTimers.push(setTimeout(() => { if (!state.elec && offFlowActive) showToast('2초'); }, 2000));
    offTimers.push(setTimeout(() => { if (!state.elec && offFlowActive) showToast('3초'); }, 3000));

    // 추가 1초 쉬고(총 4초) 최초 1회 연출
    offTimers.push(setTimeout(() => {
      if (!state.elec && offFlowActive && !state.missions.north) {
        state.missions.north = true;
        updateGauge();
        showCreature('black_tortoise', () => showSystemTip('north'));
        showToast('현무의 힘이 깨어났습니다!');
        setTimeout(() => {
          modalContainer.classList.add('hidden');
          checkAllMissions();
        }, 1200);
      }
      clearOffFlow();
    }, 4000));
  }

  outletImg.addEventListener('click', () => {
    const before = state.elec;
    state.elec = !state.elec;

    // 이미지/배경 갱신
    outletImg.src = state.elec ? 'assets/images/elecon.png' : 'assets/images/elecoff.png';
    refreshDynamicBackgroundIfNeeded();

    if (state.elec) {
      // ON으로 전환 → 어떤 흐름이든 중단
      clearOffFlow();
      showToast('전원 on');
    } else {
      // OFF로 전환
      // ⚠️ 이미 한 번 현무 미션을 달성했다면(= 최초가 아님) 카운트다운/연출 생략
      if (state.missions.north) {
        clearOffFlow();        // 혹시 남아있을 타이머 정리
        showToast('전원 off'); // 간단 안내만
        return;
      }
      // 최초 OFF 전환일 때만 카운트다운 시작
      startOffFlow();
    }
  });

  content.querySelector('#outlet-close').addEventListener('click', () => {
    clearOffFlow();
    modalContainer.classList.add('hidden');
  });
}


// ===== 주차 기록 =====
function openParking() {
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.setProperty('--modal-max', '960px');
  content.style.height = 'auto';
  content.style.position = 'relative';
  // Title
  const title = document.createElement('h3');
  title.textContent = '월패드';
  title.style.textAlign = 'center';
  title.style.marginBottom = '0.5rem';
  content.appendChild(title);
  // Wallpad image container
  const padWrapper = document.createElement('div');
  padWrapper.style.position = 'relative';
  padWrapper.style.width = '100%';
  padWrapper.style.borderRadius = '1rem';
  padWrapper.style.overflow = 'hidden';
  padWrapper.style.marginBottom = '1rem';
  const img = document.createElement('img');
  img.src = 'assets/images/wallpad_car_history.png';
  img.style.width = '100%';
  img.style.display = 'block';
  padWrapper.appendChild(img);
  content.appendChild(padWrapper);
  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '닫기';
  closeBtn.style.display = 'block';
  closeBtn.style.margin = '0 auto';
  closeBtn.style.padding = '0.5rem 1rem';
  closeBtn.style.background = '#444';
  closeBtn.style.color = '#fff';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '0.5rem';
  closeBtn.style.cursor = 'pointer';
  closeBtn.addEventListener('click', () => {
    modalContainer.classList.add('hidden');
  });
  content.appendChild(closeBtn);
  modalContainer.innerHTML = '';
  modalContainer.appendChild(content);
  modalContainer.classList.remove('hidden');
}

// ===== 환기 =====
function openVentilation() {
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.setProperty('--modal-max', '960px');

  // 현재 vent 상태에 따른 이미지 선택
  const ventImgSrc = state.vent ? 'assets/images/venton.png' : 'assets/images/ventoff.png';

  content.innerHTML = `
    <h3>환기 제어</h3>
    <div style="position:relative; width:100%; margin-top:1rem;">
      <img id="vent-img" src="${ventImgSrc}" alt="환기 상태" 
           style="width:100%; border-radius:8px; display:block; cursor:pointer;" />
    </div>
    <div style="text-align:center; margin-top:1rem;">
      <button id="vent-close" class="btn-secondary">닫기</button>
    </div>
  `;

  modalContainer.innerHTML = '';
  modalContainer.appendChild(content);
  modalContainer.classList.remove('hidden');

  const ventImg = content.querySelector('#vent-img');

  // 이미지 클릭으로 vent 상태 토글
  ventImg.addEventListener('click', () => {
    const before = state.vent;
    state.vent = !state.vent;

    // 이미지 즉시 갱신
    ventImg.src = state.vent ? 'assets/images/venton.png' : 'assets/images/ventoff.png';

    // 동적 배경 즉시 반영
    refreshDynamicBackgroundIfNeeded();

    // 토스트 안내
    showToast(state.vent ? '환기 ON' : '환기 OFF');

    // OFF->ON 전환 "최초 1회"만 청룡 미션 달성 연출
    if (!before && state.vent && !state.missions.east) {
      state.missions.east = true;
      updateGauge();
      showToast('청룡의 힘이 깨어났습니다!');

      const delay = 1000; // 1초 쉬고
      setTimeout(() => {
        showCreature('blue_dragon', () => showSystemTip('east')); // 그 다음 등장

        // 등장 애니메이션 시간(약 1.2초)에 맞춰 모달 닫기
        setTimeout(() => {
          modalContainer.classList.add('hidden');
          checkAllMissions();
        }, 1200);
      }, delay);
    }

  });

  content.querySelector('#vent-close').addEventListener('click', () => {
    // 상태는 그대로 유지, 모달만 닫기
    modalContainer.classList.add('hidden');
  });
}


// ===== 자동차 비밀번호 =====
function openCarLock() {
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.setProperty('--modal-max', '960px');
  content.innerHTML = `
    <h3>가장 마지막 "철마차"가 떠난 시간과 분을 기억하라.</h3>
    <p>그럼 백호가 움직일 것이다.</p>
    <input type="text" id="car-code" style="width:100%; padding:0.5rem; font-size:1rem; margin-top:0.5rem; border-radius:0.5rem; border:none; background:#333; color:#fff;" placeholder="비밀번호 입력" />
    <div style="text-align:center; margin-top:1rem;">
      <button id="car-confirm" style="padding:0.5rem 1rem; background:#0a84ff; color:#fff; border:none; border-radius:0.5rem; cursor:pointer;font-size: 0.8rem;">확인</button>
      <button id="car-close" style="padding:0.5rem 1rem; margin-left:0.5rem; background:#444; color:#fff; border:none; border-radius:0.5rem; cursor:pointer;font-size: 0.8rem;">닫기</button>
    </div>
  `;
  modalContainer.innerHTML = '';
  modalContainer.appendChild(content);
  modalContainer.classList.remove('hidden');

  // 1) 모달 내용 전체를 세로 컬럼 + 가운데 정렬
  Object.assign(content.style, {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  });

// 2) 입력창 폭은 너무 넓지 않게, 가운데 배치 + 입력 글자도 가운데
  const codeInput = content.querySelector('#car-code');
  Object.assign(codeInput.style, {
    width: 'min(100%, 420px)',
    marginTop: '0.8rem',
    marginInline: 'auto',
    textAlign: 'center'
  });

  // 3) 버튼 줄은 플렉스로 가운데 정렬 + 간격
  const btnRow = content.querySelector('#car-confirm').parentElement;
  Object.assign(btnRow.style, {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
    marginTop: '1rem',
    textAlign: 'center' // 혹시 모를 상속 이슈 대비
  });

  content.querySelector('#car-confirm').addEventListener('click', () => {
    const code = content.querySelector('#car-code').value.trim();
    if (code === state.lastParkingCode) {
      state.tiger = true;
      refreshDynamicBackgroundIfNeeded();
      if (!state.missions.west) {
        state.missions.west = true;
        updateGauge();
        showCreature('white_tiger', () => showSystemTip('west'));
        showToast('백호의 힘이 깨어났습니다!');
      }
      modalContainer.classList.add('hidden');
      checkAllMissions();
    } else {
      showToast('비밀번호가 틀렸습니다.');
    }
  });
  content.querySelector('#car-close').addEventListener('click', () => {
    modalContainer.classList.add('hidden');
  });
}

// ===== 모든 미션 체크 =====
function checkAllMissions() {
  const completed = state.missions.north && state.missions.south && state.missions.east && state.missions.west;
  if (completed && !state.missions.center) {
    setTimeout(() => {
      showScene(4);
    }, 500);
  }
}

// 모든 미션 완료 여부
function areAllMissionsTrue() {
  return state.missions.south && state.missions.north && state.missions.west && state.missions.east && state.missions.center;
}

// 탈출성공 모달
function showEscapeSuccessModal(onClose) {
  // 이미 모달 열려있다면 초기화
  modalContainer.innerHTML = '';
  modalContainer.classList.remove('hidden');

  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.setProperty('--modal-max', '960px');
  content.style.textAlign = 'center';

  content.innerHTML = `
    <h3 style="font-size:1.2rem; margin-bottom:0.6rem;">탈출 성공</h3>
    <div style="width:100%; display:flex; justify-content:center;">
      <img src="assets/images/door_open.gif" alt="문이 열리는 애니메이션"
           style="max-width:600px; width:100%; height:auto; border-radius:12px;" />
    </div>
    <p style="margin-top:0.8rem; font-size:0.9rem;">사방신의 힘이 모두 깨어났습니다.</p>
    <div style="text-align:center; margin-top:1rem;">
      <button id="escape-ok" class="btn-success">계속</button>
    </div>
  `;

  modalContainer.appendChild(content);

  // 외부 클릭으로 닫히지 않도록(원하면 열어도 됨)
  modalContainer.addEventListener('click', (e) => {
    if (!e.target.closest('.modal-content')) e.stopPropagation();
  }, { once: true });

  content.querySelector('#escape-ok').addEventListener('click', () => {
    modalContainer.classList.add('hidden');
    if (typeof onClose === 'function') onClose();
  });
}



// ===== 게이지 완성 연출 =====
function runGaugeComplete() {
  gaugeContainer.style.display = 'block';
  updateGauge();

  Object.keys(gaugeSegments).forEach(dir => {
    if (dir !== 'center' && state.missions[dir]) {
      gaugeSegments[dir].style.animation = 'blink 0.8s infinite';
    }
  });

  setTimeout(() => {
    Object.keys(gaugeSegments).forEach(dir => {
      gaugeSegments[dir].style.animation = '';
    });
    showIntruderOverlay(() => showScene(5));
  }, 3000);
}

// ===== 침입자 경고 오버레이 =====
function showIntruderOverlay(callback) {
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(0, 0, 0, 0.8)';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.zIndex = '60';
  overlay.style.cursor = 'pointer';

  const flash = document.createElement('div');
  flash.style.position = 'absolute';
  flash.style.top = '0';
  flash.style.left = '0';
  flash.style.width = '100%';
  flash.style.height = '100%';
  flash.style.background = 'rgba(255, 0, 0, 0.3)';
  flash.style.animation = 'flashRed 0.6s infinite';
  overlay.appendChild(flash);

  const img = document.createElement('img');
  img.src = 'assets/images/intruder.png';
  img.style.width = '600px';
  img.style.maxWidth = '600px';
  img.style.objectFit = 'contain';
  img.style.zIndex = '61';
  overlay.appendChild(img);

  const prompt = document.createElement('p');
  prompt.textContent = '베란다를 통해 누군가 들어왔습니다! 화면을 터치하여 상황을 확인하세요.';
  prompt.style.color = '#fff';
  prompt.style.marginTop = '1rem';
  prompt.style.zIndex = '61';
  prompt.style.textAlign = 'center';
  prompt.style.fontSize = '1rem';
  overlay.appendChild(prompt);

  app.appendChild(overlay);
  overlay.addEventListener('click', () => {
    overlay.remove();
    callback && callback();
  });
}

// keyframes (플래시/블링크)
const effectStyle = document.createElement('style');
effectStyle.textContent = `
  @keyframes flashRed { 0% { opacity: 0.2; } 50% { opacity: 0.6; } 100% { opacity: 0.2; } }
  @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
`;
document.head.appendChild(effectStyle);

// ===== 침입자 찾기 퍼즐 =====
function runInfiltration() {
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.style.width = '920px';
  content.innerHTML = `
    <h3>침입자 찾기</h3>
    <p>스마트홈의 침입자가 누군지 알아내라.</p>
    <ul class="log-list">
      <li>07:45 AM - 사용자 A (얼굴 인식)</li>
      <li>08:12 AM - 택배 기사 (임시 출입 권한)</li>
      <li>08:50 AM - 사용자 A (스마트폰 인증)</li>
      <li>12:03 PM - 사용자 B (지문)</li>
      <li>05:20 PM - 사용자 A (스마트폰 인증)</li>
      <li>07:10 PM - 사용자 A (스마트폰 인증)</li>
    </ul>
    <p>힌트 : 동일 사용자가 짧은 시간 간격으로 다른 인증 수단을 반복 사용하고 있어요!</p>
    <div id="intrusion-choices" class="choice-col"></div>
  `;
  modalContainer.innerHTML = '';
  modalContainer.appendChild(content);
  modalContainer.classList.remove('hidden');

  const choices = [
    { text: '사용자A', value: 'A' },
    { text: '택배 기사', value: 'Delivery' },
    { text: '사용자B', value: 'B' }
  ];
  const choiceWrapper = content.querySelector('#intrusion-choices');
  choices.forEach(ch => {
    const btn = document.createElement('button');
    btn.textContent = ch.text;
    btn.className = 'btn-primary';
    btn.addEventListener('click', () => {
      if (ch.value === 'A') {
        // 먼저 center 달성
        state.missions.center = true;
        updateGauge();

        // 침입자 모달 닫고 → 센터 팝업 → (닫기 후) 성공 모달
        modalContainer.classList.add('hidden');
        const goNext = () => {
          if (areAllMissionsTrue()) {
            showEscapeSuccessModal(() => showScene(6));
          } else {
            showScene(6);
          }
        };
        showSystemTip('center', goNext);
      } else {
        showToast('틀렸습니다. 다시 생각해보세요.');
      }
    });
    choiceWrapper.appendChild(btn);
  });
}

// ===== 초기화 =====
function init() {
  // 동적 배경에 쓰이는 8종 이미지 프리로드 (끊김 방지)
  [
    'assets/images/elecoff_tigeroff_ventoff.png',
    'assets/images/elecoff_tigeroff_venton.png',
    'assets/images/elecoff_tigeron_ventoff.png',
    'assets/images/elecoff_tigeron_venton.png',
    'assets/images/elecon_tigeroff_ventoff.png',
    'assets/images/elecon_tigeroff_venton.png',
    'assets/images/elecon_tigeron_ventoff.png',
    'assets/images/elecon_tigeron_venton.png',
    'assets/images/wallpad_car_home.png',
    'assets/images/venton.png',
    'assets/images/ventoff.png',
    'assets/images/ventilation_ui.png',
    'assets/images/Color_Temperature_Adjustment_Screen.png',
    'assets/images/elecoff.png',
    'assets/images/elecon.png',
  ].forEach(preload);

  if (bgm) {
    bgm.volume = 0.4;
    const resumeAudio = () => {
      bgm.play().catch(() => {});
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('keydown', resumeAudio);
    };
    window.addEventListener('pointerdown', resumeAudio);
    window.addEventListener('keydown', resumeAudio);

  }
  
  // 시작
  showScene(1);
}

// ===== 시작 =====
document.addEventListener('DOMContentLoaded', init);