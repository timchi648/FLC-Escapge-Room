/*
 * Wonderlands onboarding interactive game
 * This script manages the sequence of scenes, dialogues, choices and mini games.
 */

// Global state
const state = {
  currentScene: null,
  lineIndex: 0,
  waitingClick: false,
  step6Attempts: 0,
  briefingDone: null, // 'weather' or 'news'
  step9Answered: false,
  // typing control
  typing: false,
  currentTyping: null,
  skipRequested: false,
  // skipAndAdvance is kept for backward compatibility but not used in this version
  skipAndAdvance: false,
};

// DOM elements
const backgroundEl = document.getElementById('background');
const dialogueBox = document.getElementById('dialogue-box');
const charPortrait = document.getElementById('character-portrait');
const dialogueText = document.getElementById('dialogue-text');
const choiceContainer = document.getElementById('choice-container');
const bgm = document.getElementById('bgm');
const alertOverlay = document.getElementById('alert-overlay');
const toastEl = document.getElementById('toast');

// 대사+선택지를 스크롤 전용 래퍼로 한 번 감싸기
const dialogueScroll = document.createElement('div');
dialogueScroll.id = 'dialogue-scroll';
dialogueScroll.style.display = 'flex';
dialogueScroll.style.flexDirection = 'column';
dialogueScroll.style.gap = '8px';
dialogueScroll.style.flex = '1';
dialogueScroll.style.minHeight = '0';

// portrait 오른쪽에 오도록, text/choices를 래퍼로 이동
dialogueBox.insertBefore(dialogueScroll, dialogueText);
dialogueScroll.appendChild(dialogueText);
dialogueScroll.appendChild(choiceContainer);

// 아래로 스크롤 도우미
function scrollDialogueToBottom() {
  // 레이아웃 반영 후 스크롤
  requestAnimationFrame(() => {
    dialogueScroll.scrollTop = dialogueScroll.scrollHeight;
  });
}

// Toast notification handling
let toastTimeout = null;
function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.style.opacity = '1';
  // reset existing timeout
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toastEl.style.opacity = '0';
    toastTimeout = null;
  }, 2000);
}


init();
function init() {
  [
    'assets/images/cctv/A.png',
    'assets/images/cctv/B.png',
    'assets/images/cctv/C.png',
    'assets/images/cctv/D.png',
    'assets/images/closet.png',
    'assets/images/kitchen.png',
    'assets/images/living_room.png',
    'assets/images/manager_undock_smile.png',
    'assets/images/manager_undock.png',
    'assets/images/manager_yeoldock.png',
    'assets/images/office.png',
    'assets/images/owner_breath.png',
    'assets/images/owner_happy.png',
    'assets/images/owner_read_book.png',
    'assets/images/owner_sleepy.png',
    'assets/images/owner_surprise.png',
    'assets/images/owner_thinking.png',
    'assets/images/shoe_room.png',
    

  ].forEach(preloadImage);
}

// Functions to control alert effects for emergency scene
function startAlertEffect() {
  if (alertOverlay) {
    alertOverlay.style.display = 'block';
  }
  // add shake class to dialogue box
  dialogueBox.classList.add('shake');
}

function stopAlertEffect() {
  if (alertOverlay) {
    alertOverlay.style.display = 'none';
  }
  dialogueBox.classList.remove('shake');
}

// Helper to preload images
const imageCache = {};
function preloadImage(src) {
  if (!imageCache[src]) {
    const img = new Image();
    img.src = src;
    imageCache[src] = img;
  }
  return imageCache[src];
}

// Scenes definition
const scenes = [
  {
    id: 1,
    background: 'assets/images/closet.png',
    script: [
      { speaker: 'Narrator', text: '당신은 고된 취준 끝에, ‘원더랜드’에 입사하게 된 신입 사원입니다.\n즐거운 첫 출근을 해보세요!' }
    ],
    choices: [
      { text: '출근하기', nextScene: 2, onSelect: () => {  } }
    ]
  },
  {
    id: 2,
    // Step 2: 밝게 웃는 열덕 매니저가 인사하고, 곧바로 까칠한 언덕 매니저가 이어서 말하는 장면
    background: 'assets/images/office.png',
    script: [
      {
        speaker: '열덕 매니저',
        name: '열덕 매니저',
        expression: 'assets/images/manager_yeoldock.png',
        text: '어어, 원더 매니저. 잘오셨습니다. 오늘은 언덕 매니저님과 현장에 나가서 교육을 받으면 됩니다. 음.. 조금 까칠하시긴 한데.. 그래도 괜찮을거에요 ㅎㅎ'
      },
      {
        speaker: '언덕 매니저',
        name: '언덕 매니저',
        expression: 'assets/images/manager_undock.png',
        text: '왔냐? …그래, 시간은 맞춰 왔네. 여기가 베스틴 원더랜드다. 오늘 하루 네 교육은 내가 맡았어. 실수하면? 그냥 나가라. 시간 아까우니까 바로 현장으로 간다.'
      }
    ],
    // 모든 대사를 본 후 자동으로 다음 장면으로 이동한다.
    nextScene: 4
  },
  {
    id: 3,
    // Step 3: 까칠한 언덕 매니저를 만나는 장면
    background: 'assets/images/office.png',
    script: [
      {
        speaker: '언덕 매니저',
        name: '언덕 매니저',
        expression: 'assets/images/manager_undock.png',
        text: '왔냐? …그래, 시간은 맞춰 왔네. 여기가 원더랜드다. 오늘 하루 네 교육은 내가 맡았어. 실수하면? 그냥 나가라. 시간 아까우니까 바로 현장으로 간다.'
      }
    ],
    choices: [
      {
        text: '언덕 매니저님의 담당 현장으로 이동하자!',
        onSelect: () => {
          // Use onSelect to transition to next scene to prevent re-entry bugs
          showScene(4);
        }
      }
    ]
  },
  {
    id: 4,
    background: 'assets/images/living_room.png',
    script: [
      { speaker: 'Narrator', text: '짹짹- 아침 새소리와 함께 평화로운 거실의 모습이 보인다.' }
    ],
    nextScene: 5
  },
  {
    id: 5,
    background: 'assets/images/living_room.png',
    script: [
      // 주인이 기지개를 피는 모습 (stretching); this file actually shows the owner stretching
      { speaker: '주인', name: '주인', expression: 'assets/images/owner_sleepy.png', text: '하암~ 원더, 왔어? 오늘도 출근 준비 잘부탁해~' },
      { speaker: '언덕 매니저', name: '언덕 매니저', expression: 'assets/images/manager_undock.png', text: '아침이 엉망이면 하루 종일 기분 잡치는 거 알지?\n주인이 뭘 먼저 하는지 잘보고 빠릿빠릿 움직이라고.' }
    ],
    nextScene: 6
  },
  {
    id: 6,
    background: 'assets/images/living_room.png',
    script: [
      // 주인이 하품하며 졸린 모습 (yawning)
      { speaker: '주인', name: '주인', expression: 'assets/images/owner_sleepy.png', text: '으.. 졸려. 잠이 안깨네..' }
    ],
    process: runStep6
  },
  {
    id: 7,
    background: 'assets/images/kitchen.png',
    script: [
      { speaker: 'Narrator', text: '주인이 주방에서 아침을 요리한다.' }
    ],
    process: runStep7
  },
  {
    id: 8,
    background: 'assets/images/living_room.png',
    script: [
      { speaker: '주인', name: '주인', expression: 'assets/images/owner_thinking.png', text: '아.. 내가 금요일에 차를 A구역에 뒀던가? 씁.. 자리가 없길래 평소랑 다른데 뒀던 것 같은데..\n\n\n힌트 : 주인의 차는 파란색, 차 번호는 12가 1234\n (버튼이 보이지 않는다면 스크롤 해보세요!)' }
    ],
    process: runStep8
  },
  {
    id: 9,
    background: 'assets/images/living_room.png',
    script: [
      { speaker: 'Narrator', text: '주인은 출근 준비 중이다. 이제 뭘 할까?' }
    ],
    process: runStep9
  },
  {
    id: 10,
    background: 'assets/images/living_room.png',
    script: [
      { speaker: 'Narrator', text: '주인은 출근 준비 중이다. 이제 뭘 할까?' }
    ],
    process: runStep10
  },
  {
    id: 11,
    background: 'assets/images/living_room.png',
    script: [
      { speaker: 'Narrator', text: '주인이 신발을 신는다.' }
    ],
    process: runStep11
  },
  {
    id: 12,
    background: 'assets/images/shoe_room.png',
    script: [
      { speaker: '주인', name: '주인', expression: 'assets/images/owner_goodbye.png', text: '오늘도 집 잘부탁해 원더~\n(버튼이 모두 보이지 않는다면 스크롤 해보세요!)' }
    ],
    process: runStep12
  },
  {
    id: 13,
    background: 'assets/images/living_room.png',
    // Custom process handles intruder overlay, red alert, and emergency dialogues
    process: runStep13
  },
  {
    id: 14,
    background: 'assets/images/living_room.png',
    script: [
      { speaker: 'Narrator', text: '곧 경비원과 경찰, 주인에 의해 도둑이 붙잡혔다.' }
    ],
    process: () => showSystemTip('security', () => showScene(15))
  },
  {
    id: 15,
    background: 'assets/images/living_room.png',
    script: [
      { speaker: '주인', name: '주인', expression: 'assets/images/owner_read_book.png', text: '아이고.. 이게 뭔일이래. 금방 잡혀서 다행이다. 책이나 읽어야지..' },
      { speaker: '언덕 매니저', name: '언덕 매니저', expression: 'assets/images/manager_undock.png', text: '야! 멍때리지마. 주인 책읽는단다! 빨리 너도 할일을 해야지!' }
    ],
    process: runStep15
  },
  {
    id: 16,
    background: 'assets/images/living_room.png',
    script: [
      { speaker: 'Narrator', text: '삐빅! 월패드에서 알림이 도착했다. “현재 실내 공기질이 좋지 않습니다. 환기를 동작시킬까요?”' },
      { speaker: '언덕 매니저', name: '언덕 매니저', expression: 'assets/images/manager_undock.png', text: '야! 얼른 알겠다고 해. 주인이 알아서 하게 하지말고. 넌 주인의 편의를 최대한 봐줘야한다.' }
    ],
    process: runStep16
  },
  {
    id: 17,
    background: 'assets/images/living_room.png',
    script: [
      { speaker: '주인', name: '주인', expression: 'assets/images/owner_sleepy.png', text: '하암~…..' },
      { speaker: 'Narrator', text: '주인이 책을 읽다 잠들었다.' }
    ],
    process: runStep17
  },
  {
    id: 18,
    background: 'assets/images/living_room.png',
    script: [
      { speaker: 'Narrator', text: '당신은 원더랜드의 신입 직원으로서 기본 자격을 갖추었습니다.\n하지만 언덕의 인정은 절반뿐입니다.' },
      { speaker: '언덕 매니저', name: '언덕 매니저', expression: 'assets/images/manager_undock_smile.png', text: '오늘은 테스트니까 봐줬다. 그래도.. 나쁘지 않았다. ..내일보자.' },
      { speaker: 'Narrator', text: '당신은 지금까지 베스틴 스마트홈의 AI인 원더가 되어보았습니다.' },
      { speaker: 'Narrator', text: '원더는 주인의 편의성을 보장해주는 스마트홈 AI 입니다.' },
      { speaker: 'Narrator', text: '베스틴 스마트홈을 통해 실제 원더를 만나보세요!' },
    ],
    // no nextScene, end of game
  }
];

// Lookup scene by id
function getSceneById(id) {
  return scenes.find(s => s.id === id);
}

// Start game with first scene
function startGame() {
  showScene(1);
}

// Set background image with fade effect
function setBackground(src) {
  preloadImage(src);
  backgroundEl.style.opacity = 0;
  // Use timeout to allow transition to work
  setTimeout(() => {
    backgroundEl.style.backgroundImage = `url('${src}')`;
    backgroundEl.style.opacity = 1;
  }, 50);
}

// Show portrait or hide
function showPortrait(exprSrc) {
  if (exprSrc) {
    preloadImage(exprSrc);
    charPortrait.innerHTML = '';
    const img = document.createElement('img');
    img.src = exprSrc;
    charPortrait.appendChild(img);
    charPortrait.style.display = 'block';
  } else {
    charPortrait.style.display = 'none';
    charPortrait.innerHTML = '';
  }
}

// Typewriter effect for text display
function typeText(text, element, callback) {
  // Displays text with a typewriter effect and supports skipping.
  let idx = 0;
  state.typing = true;
  state.skipRequested = false;
  element.classList.remove('typing-cursor');
  element.textContent = '';
  function step() {
    // If typing was cancelled (e.g., after skip), stop further processing
    if (!state.typing) {
      return;
    }
    // If a skip was requested, immediately render the full text
    if (state.skipRequested) {
      element.textContent = text;
      state.typing = false;
      state.skipRequested = false;
      element.classList.add('typing-cursor');
      if (callback) callback();
      return;
    }
    if (idx < text.length) {
      element.textContent += text.charAt(idx);
      idx++;
      dialogueScroll.scrollTop = dialogueScroll.scrollHeight;
      setTimeout(step, 20);
    } else {
      // typing finished normally
      state.typing = false;
      element.classList.add('typing-cursor');
      if (callback) callback();
    }
  }
  step();
}

// Display the next dialogue line or move to choice/next scene
function showNextLine() {
  const scene = state.currentScene;
  if (!scene) return;
  // Determine script array; ensure undefined is handled
  const script = scene.script || [];
  // Are there more scripted lines?
  if (state.lineIndex < script.length) {
    // grab the next line and increment index
    const line = script[state.lineIndex++];
    // Determine if this is the last line in the scene
    const isLastLine = state.lineIndex >= script.length;
    // Configure portrait
    if (line.expression) {
      showPortrait(line.expression);
    } else if (line.speaker === 'Narrator' || line.speaker === '원더') {
      showPortrait(null);
    } else {
      showPortrait(null);
    }
    // Compose display name
    let displayName = '';
    if (line.name) {
      displayName = line.name + '\n';
    } else if (line.speaker && line.speaker !== 'Narrator') {
      displayName = line.speaker + '\n';
    }
    dialogueBox.style.opacity = 1;
    // Clear any lingering choices
    choiceContainer.innerHTML = '';
    // Start typing; when done, handle last-line logic
    typeText(displayName + line.text, dialogueText, () => {
      if (isLastLine) {
        const sc = state.currentScene;
        if (scene === sc) {
          // If there are choices, show them immediately; otherwise require user tap to proceed
          if (sc.choices) {
            showChoices(sc.choices);
            setTimeout(scrollDialogueToBottom, 0);
          } else {
            // no auto progression; wait for user click, then next showNextLine will handle process/nextScene
            state.waitingClick = true;
          }
        }
      } else {
        // Not last line: require user click to proceed
        state.waitingClick = true;
      }
    });
  } else {
    // No more lines: call process or go to choices/next scene
    if (scene.process) {
      scene.process();
    } else if (scene.choices) {
      showChoices(scene.choices);
    } else if (scene.nextScene) {
      showScene(scene.nextScene);
    }
  }
}

// Show choices as buttons
function showChoices(choices) {
  choiceContainer.innerHTML = '';
  dialogueText.classList.remove('typing-cursor');
  state.waitingClick = false;
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.textContent = choice.text;
    btn.className = 'choice';
    btn.addEventListener('click', (event) => {
      // Prevent click from bubbling to dialogueBox which may trigger unintended showNextLine
      event.stopPropagation();
      if (choice.onSelect) choice.onSelect();
      if (choice.nextScene) {
        showScene(choice.nextScene);
      }
    });
    choiceContainer.appendChild(btn);
  });
}

// Main function to show a scene
function showScene(sceneId) {
  const scene = getSceneById(sceneId);
  // If this scene is the emergency scene (id 13) and does not have a custom process, activate alert effects;
  // otherwise deactivate. For scenes with a process (runStep13), the alert effect will be started within the process.
  if (scene && scene.id === 13 && !scene.process) {
    startAlertEffect();
  } else {
    stopAlertEffect();
  }
  state.currentScene = scene;
  state.lineIndex = 0;
  // set background
  setBackground(scene.background);
  // reset portrait and text box
  charPortrait.style.display = 'none';
  charPortrait.innerHTML = '';
  dialogueText.textContent = '';
  dialogueBox.style.opacity = 0;
  // begin after slight delay to allow background fade
  // slight delay to allow previous content to fade out and DOM to update
  setTimeout(() => {
    // If the scene has a process and no scripted lines, run the process directly
    if (scene && scene.process && (!scene.script || scene.script.length === 0)) {
      scene.process();
    } else {
      showNextLine();
    }
  }, 20);
}

// Click on dialogue box to progress dialogues
dialogueBox.addEventListener('click', (e) => {
  // If choices container has children, do not progress
  if (choiceContainer.childElementCount > 0) return;
  // If currently typing, skip to full line instantly
  if (state.typing) {
    state.skipRequested = true;
    // no auto advance; user will need to click again to progress
    return;
  }
  if (!state.waitingClick) return;
  state.waitingClick = false;
  showNextLine();
});

// ------------------- Step-specific logic ----------------------

// Step6: curtain, news, bus. Track attempts and respond accordingly
function runStep6() {
  // define options
  const options = [
    { text: '커튼 열기', id: 'curtain' },
    { text: '뉴스 켜기', id: 'news' },
    { text: '버스 도착예정 시간 알려주기', id: 'bus' }
  ];
  choiceContainer.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = opt.text;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (opt.id === 'curtain') {
        // correct
        // reset choices
        choiceContainer.innerHTML = '';
        // show reward dialogues
        const thankLine = { speaker: '주인', name: '주인', expression: 'assets/images/owner_happy.png', text: '고마워! 빛을 보니까 잠이 좀 깬다.' };
        let reactionText = '';
        if (state.step6Attempts === 0) {
          reactionText = '뭐, 나쁘지 않네.';
        } else if (state.step6Attempts <= 2) {
          reactionText = '에휴.. 벌써부터 헤매면 어떡하냐, 너.';
        } else {
          reactionText = '야.. 이걸 이렇게 틀리냐? 쯧쯧.. 넌 짐 쌀 준비해라.';
        }
        const reactionLine = { speaker: '언덕 매니저', name: '언덕 매니저', expression: 'assets/images/manager_undock.png', text: reactionText };
        // create temporary scene lines then proceed to next scene 7
        const tempScene = { script: [ thankLine, reactionLine ],
          process: () => showSystemTip('open_curtain', () => showScene(7))
        };
        // replace current scene temporarily
        state.currentScene = tempScene;
        state.lineIndex = 0;
        showNextLine();
      } else {
        // wrong
        state.step6Attempts++;
        // show manager complaint as toast
        showToast('언덕 매니저: 지금 그게 아니라니까! 다시 생각해봐.');
      }
    });
    choiceContainer.appendChild(btn);
  });
}

// Step7: choose coffee
function runStep7() {
  const options = [
    { text: '커피 내리기', id: 'coffee' },
    { text: '주방 전등 끄기', id: 'lightOff' },
    { text: '가스 밸브 잠그기', id: 'gas' }
  ];
  choiceContainer.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = opt.text;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (opt.id === 'coffee') {
        // correct
        choiceContainer.innerHTML = '';
        // show praise
        const praise = { speaker: '주인', name: '주인', expression: 'assets/images/owner_happy.png', text: '역시 원더야~~ 말안해도 척척이네 ㅎㅎ 고마워 ㅎㅎ' };
        const praise_undock = {speaker: '언덕 매니저', name: '언덕 매니저', expression: 'assets/images/manager_undock_smile.png', text: '흠.. 주인이 아침 먹을 때 커피를 마시는 걸 알아채다니, 생각보다 제법이군.'}
        const tempScene = { script: [ praise, praise_undock ], process: () => showSystemTip('coffee', () => showScene(8)) };
        state.currentScene = tempScene;
        state.lineIndex = 0;
        showNextLine();
      } else if (opt.id === 'lightOff') {
        // wrong
        showToast('언덕 매니저: 야! 요리중인데 불을 끄면 어떡하냐?! 어두우면 손 다치잖아!');
      } else if (opt.id === 'gas') {
        // wrong
        showToast('언덕 매니저: 야!!! 지금 요리 중인데 가스를 끄면 어떡하냐!! 넌 진짜.. 이럴거면 집에 가라!');
      } else {
        // wrong
        showToast('언덕 매니저: 씁.. 그건 아니지 않냐?');
      }
    });
    choiceContainer.appendChild(btn);
  });
}

// Step8: CCTV mini-game for parking
function runStep8() {
  // first-level choices
  const firstOptions = [
    { text: '주차장 CCTV 확인하기', id: 'cctv' },
    { text: '엘리베이터 호출하기', id: 'elevator' },
    { text: '일괄 소등', id: 'lightsOff' }
  ];
  choiceContainer.innerHTML = '';
  firstOptions.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = opt.text;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (opt.id === 'cctv') {
        // show CCTV game
        showCCTVGame();
      } else {
        // wrong
        showToast('언덕 매니저: 주차장 CCTV를 확인해야지!');
      }
    });
    choiceContainer.appendChild(btn);
  });
}

// CCTV mini-game implementation
function showCCTVGame() {
  // clear container
  choiceContainer.innerHTML = '';
  dialogueText.classList.remove('typing-cursor');
  // slider container
  const sliderWrap = document.createElement('div');
  sliderWrap.style.display = 'flex';
  sliderWrap.style.flexDirection = 'column';
  sliderWrap.style.alignItems = 'center';
  sliderWrap.style.gap = '6px';
  // image display
  const imgEl = document.createElement('img');
  imgEl.style.width = '100%';
  imgEl.style.maxHeight = '200px';
  imgEl.style.objectFit = 'contain';
  // list of zones
  const zones = ['A','B','C','D'];
  let currentIndex = 0;
  function updateImage() {
    imgEl.src = `assets/images/cctv/${zones[currentIndex]}.png`;
  }
  updateImage();
  // arrow controls
  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.justifyContent = 'center';
  controls.style.gap = '20px';
  const prevBtn = document.createElement('button');
  prevBtn.textContent = '←';
  prevBtn.className = 'choice';
  prevBtn.style.padding = '6px 12px';
  prevBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    currentIndex = (currentIndex - 1 + zones.length) % zones.length;
    updateImage();
  });
  const nextBtn = document.createElement('button');
  nextBtn.textContent = '→';
  nextBtn.className = 'choice';
  nextBtn.style.padding = '6px 12px';
  nextBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    currentIndex = (currentIndex + 1) % zones.length;
    updateImage();
  });
  controls.appendChild(prevBtn);
  controls.appendChild(nextBtn);
  sliderWrap.appendChild(imgEl);
  sliderWrap.appendChild(controls);
  choiceContainer.appendChild(sliderWrap);
  // zone selection buttons
  const zoneBtnWrap = document.createElement('div');
  zoneBtnWrap.style.display = 'flex';
  zoneBtnWrap.style.gap = '8px';
  zoneBtnWrap.style.flexWrap = 'wrap';
  zones.forEach(letter => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = `${letter}구역`; // e.g., A구역
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (letter === 'A') {
        // correct
        choiceContainer.innerHTML = '';
        // show success lines
        const wonderLine = { speaker: '원더', name: '원더', text: 'A구역 12 기둥 옆에 위치해있습니다.' };
        const ownerLine = { speaker: '주인', name: '주인', expression: 'assets/images/owner_happy.png', text: '헐? 고마워~' };
        const tempScene = { script: [ wonderLine, ownerLine ], 
          process: () => showSystemTip('cctv', () => showScene(9))
        };
        state.currentScene = tempScene;
        state.lineIndex = 0;
        showNextLine();
      } else {
        showToast('언덕 매니저: 주인의 차는 파란색, 12가 1234야. CCTV 화면을 잘 봐.');
      }
    });
    zoneBtnWrap.appendChild(btn);
  });
  choiceContainer.appendChild(zoneBtnWrap);
}

// Step9: choose weather or news, track done
function runStep9() {
  const options = [];
  options.push({ text: '오늘 날씨 브리핑하기', id: 'weather' });
  options.push({ text: '오늘 뉴스 브리핑하기', id: 'news' });
  options.push({ text: '엘리베이터 호출하기', id: 'elevator' });
  choiceContainer.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = opt.text;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (opt.id === 'weather' || opt.id === 'news') {
        state.briefingDone = opt.id;
        showBriefing(opt.id, 10);
      } else {
        // wrong
        showToast('언덕 매니저: 아직 할 일이 남았어.');
      }
    });
    choiceContainer.appendChild(btn);
  });
}

// Helper to show weather or news briefing and then go to next scene
function showBriefing(type, nextSceneId) {
  choiceContainer.innerHTML = '';
  let lines = [];
  if (type === 'weather') {
    lines.push({ speaker: '원더', name: '원더', text: '오늘 최저 기온은 25도, 최고 기온은 33도입니다. 오후에 비소식이 있으니, 우산 챙겨가세요.' });
    lines.push({ speaker: '주인', name: '주인', expression: 'assets/images/owner_surprise.png', text: '맞다 우산!!' });
  } else if (type === 'news') {
    lines.push({ speaker: '원더', name: '원더', text: '오늘의 주요 뉴스는 …' });
    lines.push({ speaker: '주인', name: '주인', expression: 'assets/images/owner_breath.png', text: '뭐라고?? …후.. 출근하면서 주식 좀 봐야겠다..' });
  }
  const tempScene = { script: lines, process: () => showSystemTip('news', () => showScene(nextSceneId)) };
  state.currentScene = tempScene;
  state.lineIndex = 0;
  showNextLine();
}

// Step10: pick the other briefing
function runStep10() {
  const options = [];
  // whichever was done, do not show again; show '일괄소등' in its place
  if (state.briefingDone === 'weather') {
    options.push({ text: '오늘 뉴스 브리핑하기', id: 'news' });
  } else if (state.briefingDone === 'news') {
    options.push({ text: '오늘 날씨 브리핑하기', id: 'weather' });
  } else {
    // failsafe: show both
    options.push({ text: '오늘 날씨 브리핑하기', id: 'weather' });
    options.push({ text: '오늘 뉴스 브리핑하기', id: 'news' });
  }
  options.push({ text: '일괄소등', id: 'lights' });
  options.push({ text: '엘리베이터 호출하기', id: 'elevator' });
  choiceContainer.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = opt.text;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (opt.id === 'weather' || opt.id === 'news') {
        // correct choice: show briefing and proceed to 11
        showBriefing(opt.id, 11);
      } else {
        // wrong
        showToast('언덕 매니저: 아직 끝나지 않았잖아! 다시 생각해.');
      }
    });
    choiceContainer.appendChild(btn);
  });
}

// Step11: call elevator or bus arrival
function runStep11() {
  const options = [
    { text: '엘리베이터 호출하기', id: 'elevator' },
    { text: '버스 도착 예정 시간 알려주기', id: 'bus' }
  ];
  choiceContainer.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = opt.text;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (opt.id === 'elevator') {
        // correct
        choiceContainer.innerHTML = '';
        const wonderLine = { speaker: '원더', name: '원더', text: '엘리베이터가 현재 7층에 도착했습니다.' };
        const ownerLine = { speaker: '주인', name: '주인', expression: 'assets/images/owner_happy.png', text: '땡큐~' };
        const tempScene = { script: [ wonderLine, ownerLine ], 
          process: () => showSystemTip('elevator', () => showScene(12))
        };
        state.currentScene = tempScene;
        state.lineIndex = 0;
        showNextLine();
      } else {
        // wrong
        showToast('언덕 매니저: 쯧, 집중을 안하네, 안해.. 아까 주인이 주차장에서 차를 찾았잖냐! 그런데 버스를 타겠어?! 쯧쯧..');
      }
    });
    choiceContainer.appendChild(btn);
  });
}

// Step12: multi selection (all options)
function runStep12() {
  const items = [
    { text: '일괄소등', id: 'lights' },
    { text: '가스닫기', id: 'gas' },
    { text: '환기끄기', id: 'ventilation' },
    { text: '난방 외출 모드', id: 'heating' },
    { text: '스마트 콘센트 전력 차단', id: 'plug' },
    { text: '외출 방범 모드 켜기', id: 'security' }
  ];
  choiceContainer.innerHTML = '';
  const selected = new Set();
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = item.text;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (selected.has(item.id)) {
        selected.delete(item.id);
        btn.classList.remove('selected');
      } else {
        selected.add(item.id);
        btn.classList.add('selected');
      }
    });
    choiceContainer.appendChild(btn);
  });
  // confirm button
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm';
  confirmBtn.textContent = '확인';
  confirmBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (selected.size === items.length) {
      // success
      choiceContainer.innerHTML = '';
      showSystemTip('outing', () => showScene(13));
      state.lineIndex = 0;
      showScene(13);
      } else {
        showToast('언덕 매니저: 아직 덜 선택했다! 모두 선택해야 해.');
      }
  });
  choiceContainer.appendChild(confirmBtn);
}

// Step15: choose light option
function runStep15() {
  const options = [
    { text: '밝고 부드러운 주백색', id: 'softWhite' },
    { text: '은은한 따뜻한 백색', id: 'warmWhite' },
    { text: '밝고 차가운 집중등', id: 'coolBright' }
  ];
  choiceContainer.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = opt.text;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (opt.id === 'softWhite') {
        // correct
        choiceContainer.innerHTML = '';
        const reaction = { speaker: '언덕 매니저', name: '언덕 매니저', expression: 'assets/images/manager_undock.png', text: '그래, 눈 안아프겠네. 어휴, 오늘 처음으로 사람 같은 판단했네.' };
        const tempScene = { script: [ reaction ], 
          process: () => showSystemTip('light_mode', () => showScene(16))
        };
        state.currentScene = tempScene;
        state.lineIndex = 0;
        showNextLine();
      } else if (opt.id === 'warmWhite') {
        showToast('언덕 매니저: 지금 책읽다 자라는거냐?');
      } else if (opt.id === 'coolBright') {
        showToast('언덕 매니저: 윽! 야! 밝기가 너무 세잖아!');
      }
    });
    choiceContainer.appendChild(btn);
  });
}

// Step16: confirm ventilation
function runStep16() {
  choiceContainer.innerHTML = '';
  const btn = document.createElement('button');
  btn.className = 'choice';
  btn.textContent = '확인';
  btn.addEventListener('click', (event) => {
    event.stopPropagation();
    // proceed to next scene 17
    showSystemTip('air', () => showScene(17));
  });
  choiceContainer.appendChild(btn);
}

// Step17: multi selection for sleep mode
function runStep17() {
  const items = [
    { text: '조명 : 은은한 따뜻한 백색', id: 'lightWarm' },
    { text: '보일러 : 취침모드', id: 'boiler' }
  ];
  choiceContainer.innerHTML = '';
  const selected = new Set();
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = item.text;
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (selected.has(item.id)) {
        selected.delete(item.id);
        btn.classList.remove('selected');
      } else {
        selected.add(item.id);
        btn.classList.add('selected');
      }
    });
    choiceContainer.appendChild(btn);
  });
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'confirm';
  confirmBtn.textContent = '확인';
  confirmBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    if (selected.size === items.length) {
      // success -> end
      showSystemTip('sleep', () => showScene(18));
    } else {
      showToast('언덕 매니저: 둘 다 선택해야 하지 않겠냐?');
    }
  });
  choiceContainer.appendChild(confirmBtn);
}

// Step13: intruder appears before emergency dialogues
function runStep13() {
  // Get intruder overlay element
  const overlay = document.getElementById('intruder-overlay');
  if (!overlay) {
    // fallback: directly start emergency dialogues
    // Start red alert effect
    startAlertEffect();
    const lines = [
      { speaker: '원더', name: '원더', text: '어, 이럴땐 어떡하죠, 언덕 매니저님?!!! 침입자에요!!' },
      { speaker: '언덕 매니저', name: '언덕 매니저', expression: 'assets/images/manager_undock.png', text: '쯧쯧.. 침착하게 기다려라. 아까 방범모드를 켜놨으니, 경비실과 주인에게 이미 연락이 갔을 거야. 곧 경비원이 확인해보러 올거다. 우리는 이 상황을 잘 기억해놨다가 알려주기만 하면 돼.' }
    ];
    const tempScene = { script: lines, nextScene: 14 };
    state.currentScene = tempScene;
    state.lineIndex = 0;
    showNextLine();
    return;
  }
  // Configure overlay with intruder image
  // Reset any typing/waiting state to avoid unintended progress
  state.typing = false;
  state.skipRequested = false;
  state.waitingClick = false;
  overlay.innerHTML = '';
  const img = document.createElement('img');
  img.src = 'assets/images/intruder.png';
  overlay.appendChild(img);
  // Show overlay
  overlay.style.display = 'flex';
  // Hide dialogue box during intruder illustration
  dialogueBox.style.opacity = 0;
  // When the user taps the overlay, hide it and start emergency dialogues
  function onOverlayClick(event) {
    event.stopPropagation();
    overlay.style.display = 'none';
    overlay.removeEventListener('click', onOverlayClick);
    // Restore dialogue box visibility
    // The dialogue box will be shown by showNextLine automatically
    // Start red alert effect now
    startAlertEffect();
    // Set up emergency dialogues as a temporary scene
    const lines = [
      { speaker: '원더', name: '원더', text: '어, 이럴땐 어떡하죠, 언덕 매니저님?!!!' },
      { speaker: '언덕 매니저', name: '언덕 매니저', expression: 'assets/images/manager_undock.png', text: '쯧쯧.. 침착하게 기다려라. 아까 방범모드를 켜놨으니, 경비실과 주인에게 이미 연락이 갔을 거야. 곧 경비원이 확인해보러 올거다. 우리는 이 상황을 잘 기억해놨다가 알려주기만 하면 돼.' }
    ];
    const tempScene = { script: lines, nextScene: 14 };
    state.currentScene = tempScene;
    state.lineIndex = 0;
    // Show the first line
    showNextLine();
  }
  overlay.addEventListener('click', onOverlayClick);
}

// Initialize game after DOM ready
document.addEventListener('DOMContentLoaded', () => {
  startGame();
});

// ===== System Tip (도사 버전과 동일 컨셉) =====
function ensureSystemTipOverlay() {
  let el = document.getElementById('system-tip-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'system-tip-overlay';
    document.getElementById('game').appendChild(el); // #game 위에 올림
  }
  return el;
}

// 네가 준 맵 그대로 사용
const SYSTEM_TIP_MAP = {
  open_curtain: { title: '☀️ 모닝루틴',  msg: '원더는 주인의 모닝 루틴을 파악하고 자동화해야합니다.' },
  coffee:       { title: '☀️ 모닝루틴',  msg: '스마트한 베스틴 원더 AI라면, 평소 주인의 행동을 기억해두어야겠죠?' },
  cctv:         { title: '🚗 주차장 CCTV', msg: '베스틴의 원더 AI는 당신의 차량도 기억하고 있습니다!' },
  news:         { title: '☀️ 모닝루틴',  msg: '주인이 주기적으로 확인하는 정보는 원더가 알려줍니다!' },
  elevator:     { title: '☀️ 모닝루틴',  msg: '월패드의 기능인 엘리베이터 호출하기, 버스 도착 예정 시간 알려주기 모두<br>주인의 행동을 감지한 원더가 이젠 자동으로 실행합니다.' },
  outing:       { title: '🚪 외출 연동 설정', msg: '월패드의 외출 연동 설정 기능도 이젠<br>주인의 행동을 감지한 원더가 자동으로 실행합니다.' },
  security:     { title: '🔒 방범',      msg: '아까 원더가 실행한 방범 기능을 통해 빠른 조치가 가능했네요!' },
  light_mode:   { title: '💡 조명 모드',  msg: '원더가 있다면 일일이 조명 모드를 실행하지 않아도 돼요. 모두 자동입니다!' },
  air:          { title: '🍃 환기',      msg: '월패드와 원더가 만나 더욱 스마트해졌네요!<br>이젠 일일이 확인을 누르지 않아도 됩니다.' },
  sleep:        { title: '😴 취침모드',   msg: '이젠 취침모드도 자는 모습을 감지한 원더가 자동으로..zzz 모두 안녕히 주무세요!' },
};

function showSystemTip(which, onClose) {
  if (!state.tipsShown) state.tipsShown = {};
  if (state.tipsShown[which]) { onClose && onClose(); return; }
  state.tipsShown[which] = true;

  const info = SYSTEM_TIP_MAP[which] || { title: '안내', msg: '스마트홈 기능을 확인해보세요.' };
  const overlay = ensureSystemTipOverlay();
  overlay.innerHTML = `
    <div class="system-tip modal-content" role="dialog" aria-modal="true" aria-label="${info.title}">
      <h3>${info.title}</h3>
      <p>${info.msg}</p>
      <div class="tip-actions">
        <button class="btn-tip" id="tip-ok">확인</button>
      </div>
    </div>`;
  overlay.classList.add('is-visible');

  const finish = () => {
    overlay.classList.remove('is-visible');
    overlay.innerHTML = '';
    onClose && onClose();
  };
  overlay.addEventListener('click', (e) => {
    if (!e.target.closest('.modal-content')) finish();
  }, { once: true });
  overlay.querySelector('#tip-ok')?.addEventListener('click', finish, { once: true });
}

