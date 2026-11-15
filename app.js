/**
 * 『나란히』 — Reader Engine v3 · Orb & Constellation Edition
 *
 * Page model: state.pages = [cover, (chapter, content...)×8, credits]
 *   type: 'cover' | 'chapter' | 'content' | 'credits'
 *   Only 'content' pages carry a folio number (pageNo) and reading progress.
 *
 * Navigation: no persistent bars. One orb (progress ring) toggles the deck:
 *   constellation scrubber (drag = scrub, star = jump to chapter) + 4 actions.
 * Audiobook: pre-rendered neural voices, one set per gender (audio/{m|f}/ch{N}.mp3 + cues.json),
 *   paragraph-synced highlighting and page following. Web Speech is the fallback.
 */
(function () {
  'use strict';

  const STORAGE_KEY_SETTINGS = 'side_by_side_settings_v1';
  const STORAGE_KEY_PROGRESS = 'side_by_side_progress_v1';
  const STORAGE_KEY_BOOKMARKS = 'side_by_side_bookmarks_v1';

  const FONT_MAP = {
    gowun: "'Gowun Batang', 'Noto Serif KR', serif",
    serif: "'Noto Serif KR', serif",
    myeongjo: "'Nanum Myeongjo', serif",
    sans: "'Pretendard', -apple-system, sans-serif"
  };

  const THEME_META_COLOR = { starlight: '#04060d', sepia: '#2e2520', paper: '#e6e8ee', dawn: '#2b2a3b' };

  const DECK_AUTOHIDE_MS = 5200;

  // Ending credits (클로징 멘트) — edit freely.
  const CREDITS_CHAPTER_ID = 99;
  // 클로징 멘트 — 에필로그. '*' = 장면 나눔
  const AFTERWORD_PARAS = [
    "7월 21일, 밤 뉴스. 남부 지방 장마는 이번 주 후반 끝나겠습니다. 비가 그친 뒤에도 산비탈 가까이는 며칠 더 조심하십시오. 흙은 비보다 늦게 무너집니다.",
    "*",
    "8월 9일, 주말 뉴스. 습도가 높아 체감온도는 35도까지 오르겠습니다. 여름 체감온도는 바람이 아니라 습도로 봅니다. 곡성의 어느 분께 배운 겁니다.",
    "*",
    "9월 16일, 밤 뉴스. 태풍은 남해안을 비껴가겠습니다. 비껴가도, 대비는 하십시오. 영도에 계신 분들은 특히요.",
    "*",
    "11월 12일, 밤 뉴스. 철 지난 소나기 소식이 있습니다. 우산은 괜히 들고 나와도 괜찮습니다. 괜히 든 우산이 제일 좋은 우산입니다.",
    "*",
    "2월 4일, 아침 뉴스. 오늘은 입춘입니다. 기온으로 보면 봄은 아직 한 달쯤 남았습니다. 그래도 기다리는 건 자유입니다.",
    "*",
    "7월 14일, 밤 뉴스. 1년 전 오늘, 이 자리에서 원고에 없는 말을 했습니다. 오늘 전국은 대체로 맑겠습니다. 곡성 동산리, 강씨네 주유소 사장님. 오늘도 맑음입니다. 내일도 맑음으로 하겠습니다.",
  ];
  const AFTERWORD_SIGNATURE = '';

  // What inspired the story — listed after the afterword. 소설은 해설 영상, 영화는 예고편, 음악은 음원.
  const INSPIRATIONS = [
    { kind: '음악', by: '성시경', title: '넌 감동이었어', year: 2002, url: 'https://www.youtube.com/results?search_query=%EC%84%B1%EC%8B%9C%EA%B2%BD%20%EB%84%8C%20%EA%B0%90%EB%8F%99%EC%9D%B4%EC%97%88%EC%96%B4' },
    { kind: '음악', by: '김연우', title: '사랑한다는 흔한 말', year: 2006, url: 'https://www.youtube.com/results?search_query=%EA%B9%80%EC%97%B0%EC%9A%B0%20%EC%82%AC%EB%9E%91%ED%95%9C%EB%8B%A4%EB%8A%94%20%ED%9D%94%ED%95%9C%20%EB%A7%90' },
    { kind: '음악', by: '기리보이', title: '이상기후', year: '', url: 'https://www.youtube.com/results?search_query=%EA%B8%B0%EB%A6%AC%EB%B3%B4%EC%9D%B4%20%EC%9D%B4%EC%83%81%EA%B8%B0%ED%9B%84' },
    { kind: '음악', by: '박효신', title: '좋은 사람', year: 2002, url: 'https://www.youtube.com/results?search_query=%EB%B0%95%ED%9A%A8%EC%8B%A0%20%EC%A2%8B%EC%9D%80%20%EC%82%AC%EB%9E%8C' },
    { kind: '음악', by: '김동률', title: '사랑한다 말해도', year: 2014, url: 'https://www.youtube.com/results?search_query=%EA%B9%80%EB%8F%99%EB%A5%A0%20%EC%82%AC%EB%9E%91%ED%95%9C%EB%8B%A4%20%EB%A7%90%ED%95%B4%EB%8F%84' },
    { kind: '음악', by: '한로로', title: '화해', year: 2023, url: 'https://www.youtube.com/results?search_query=%ED%95%9C%EB%A1%9C%EB%A1%9C%20%ED%99%94%ED%95%B4' },
    { kind: '음악', by: '한로로', title: '0+0', year: 2025, url: 'https://www.youtube.com/results?search_query=%ED%95%9C%EB%A1%9C%EB%A1%9C%200%2B0' },
    { kind: '음악', by: '한로로', title: '입춘', year: 2022, url: 'https://www.youtube.com/results?search_query=%ED%95%9C%EB%A1%9C%EB%A1%9C%20%EC%9E%85%EC%B6%98' },
    { kind: '음악', by: '한로로', title: '사랑하게 될 거야', year: 2023, url: 'https://www.youtube.com/results?search_query=%ED%95%9C%EB%A1%9C%EB%A1%9C%20%EC%82%AC%EB%9E%91%ED%95%98%EA%B2%8C%20%EB%90%A0%20%EA%B1%B0%EC%95%BC' },
    { kind: '음악', by: '도경수', title: 'Somebody', year: 2023, url: 'https://www.youtube.com/results?search_query=%EB%8F%84%EA%B2%BD%EC%88%98%20Somebody' }
  ];

  // Signs and inscriptions quoted in the text → bold
  const SIGN_TEXTS = ['0+0: 아무것도 안 사도 됨. 대신 사장 있음.', '(충전도 됨.)', '내일 곡성: 맑음.', '강지운: 맑음.', '니가 안 물어봐서, 내가 먼저 말할게.', '소규모 산지 마을 산사태 조기경보 — 예보 격자 밖의 사람들.'];
  function paraHtml(text) {
    if (/^\*[^*]+\*$/.test(text)) return `<em class="aside">${escapeHtml(text.slice(1, -1))}</em>`; // 3장 듀엣 독백
    let html = escapeHtml(text);
    for (const t of SIGN_TEXTS) if (text.includes(t)) html = html.replace(escapeHtml(t), `<strong class="sign">${escapeHtml(t)}</strong>`);
    // 시나리오 혼합체: 장면 머리(S#n.), INSERT/FLASHBACK 줄, '이름 : 대사'
    const sm = text.match(/^S#(\d+)\./);
    if (sm) return `<span class="scene-head">${html}</span>` + (SCENE_IMAGES[sm[1]] ? `<img class="scene-img" src="${SCENE_IMAGES[sm[1]]}" alt="" width="1600" height="900" loading="lazy">` : '');
    const lm = text.match(/^(화면|회상 몽타주|회상|다시 현재)(?: — | (?=\(S#))/);
    if (lm) return `<span class="sc-insert"><span class="sc-badge">${lm[1]}</span>${html.slice(escapeHtml(lm[0]).length)}</span>`;
    return html.replace(/^([^:<(]{1,24}?)(?: \(([^)]+)\))? : /, (m, who, tag) => `<span class="who">${who}</span>` + (tag ? `<span class="who-tag">${tag}</span>` : ''));
  }

  // Line-art motif per chapter (64×64, stroke = currentColor)
  const CHAPTER_MOTIFS = {
    1: `<svg viewBox="0 0 64 64"><circle cx="22" cy="20" r="7"/><path d="M22 6v4M22 30v4M8 20h4M32 20h4M12 10l3 3M32 10l-3 3"/><path d="M40 42V16a4 4 0 0 1 8 0v26"/><circle cx="44" cy="48" r="6"/></svg>`,
    2: `<svg viewBox="0 0 64 64"><circle cx="32" cy="26" r="16"/><circle cx="32" cy="26" r="2.5"/><path d="M32 26c0-8 5-11 9-8M32 26c7 3 7 9 3 11M32 26c-7 3-11 0-10-5" opacity=".7"/><path d="M32 42v10M22 56h20"/></svg>`,
    3: `<svg viewBox="0 0 64 64"><circle cx="22" cy="16" r="6"/><path d="M22 4v3M10 16h3M13 7l2 2"/><path d="M20 38h26a8 8 0 0 0-1-16 11 11 0 0 0-21 2 7 7 0 0 0-4 14z"/><path d="M26 44l-2 6M36 44l-2 6M46 44l-2 6" opacity=".6"/></svg>`,
    4: `<svg viewBox="0 0 64 64"><rect x="10" y="8" width="24" height="48" rx="1"/><circle cx="29" cy="33" r="1.4" fill="currentColor" stroke="none"/><path d="M46 12c0-4 6-4 6 0v4"/><path d="M52 16l-3 6-2 20h6l-2-20z"/><path d="M42 30l-3 6M60 28l-3 6M44 46l-3 6M60 44l-3 6" opacity=".55"/></svg>`,
    5: `<svg viewBox="0 0 64 64"><path d="M8 20h48v6H8z"/><path d="M16 26v28M48 26v28"/><rect x="26" y="36" width="12" height="18" rx="2"/><circle cx="14" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="32" cy="7" r="1.3" fill="currentColor" stroke="none"/><circle cx="48" cy="12" r="1.3" fill="currentColor" stroke="none"/></svg>`,
    6: `<svg viewBox="0 0 64 64"><rect x="25" y="8" width="14" height="26" rx="7"/><path d="M19 28a13 13 0 0 0 26 0M32 41v10M24 56h16"/></svg>`,
    7: `<svg viewBox="0 0 64 64"><circle cx="15" cy="44" r="10"/><circle cx="49" cy="44" r="10"/><path d="M15 44l10-16h16l8 16M25 28l7 16H15M41 28l-2-6h-5M22 25h6"/></svg>`,
    8: `<svg viewBox="0 0 64 64"><path d="M8 56C20 46 30 36 48 14"/><path d="M28 38c4-1 9 0 13 3"/><circle cx="45" cy="14" r="1.8"/><circle cx="45" cy="8.5" r="3"/><circle cx="50.2" cy="12.3" r="3"/><circle cx="48.2" cy="18.5" r="3"/><circle cx="41.8" cy="18.5" r="3"/><circle cx="39.8" cy="12.3" r="3"/><ellipse cx="43" cy="42" rx="2" ry="3"/></svg>`,
    9: `<svg viewBox="0 0 64 64"><path d="M6 54L26 18l14 16 18 20z"/><path d="M28 30c2 8 6 14 10 24" opacity=".6"/><path d="M40 54v-6h10v6M39 48l6-5 6 5"/><path d="M12 8l-2 5M24 5l-2 5M40 8l-2 5M54 10l-2 5" opacity=".55"/></svg>`,
    10: `<svg viewBox="0 0 64 64"><rect x="8" y="14" width="16" height="30" rx="2"/><rect x="11" y="18" width="10" height="7" rx="1"/><path d="M16 44v10M24 30c7 0 7 10 0 10"/><circle cx="38" cy="30" r="3.2"/><circle cx="50" cy="30" r="3.2"/><path d="M38 34v20M50 34v20"/></svg>`,
    cover: `<svg viewBox="0 0 64 64"><path d="M8 22h48v6H8z"/><path d="M16 28v26M48 28v26"/><rect x="26" y="36" width="12" height="18" rx="2"/></svg>`,
    end: `<svg viewBox="0 0 64 64"><path d="M22 54V24M42 54V24"/><circle cx="22" cy="18" r="3" fill="currentColor" stroke="none"/><circle cx="42" cy="18" r="3" fill="currentColor" stroke="none"/></svg>`
  };

  const MODE_ICONS = {
    flip: `<svg viewBox="0 0 24 24"><path d="M3 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H3zM21 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/></svg>`,
    scroll: `<svg viewBox="0 0 24 24"><path d="M6 4h12M6 9h12M6 14h9M12 18v-3M9.5 18.5L12 21l2.5-2.5"/></svg>`
  };

  const state = {
    theme: 'starlight',
    fontKey: 'gowun',
    fontSize: 17,
    lineHeight: 1.95,
    mode: 'flip', // 'flip' | 'scroll'
    pages: [],
    chapterStartPages: {},
    contentTotal: 1,
    currentPageIndex: 0,
    isFlipping: false,
    deckOpen: false,
    bookmarks: [],
    ttsStatus: 'stopped', // 'stopped' | 'playing' | 'paused'
    ttsRate: 1.0,
    ttsParaOffset: 0,
    ttsVoice: 'm', // 'm' | 'f' — which pre-rendered voice set (audio/m, audio/f)
    seasonFx: true
  };

  // Season per scene (S#) — 날씨·계절이 화면에 보이는 장면에만. 나머지는 효과 없음
  const SCENE_SEASON = {
    6: { key: 'rain', density: 0.8 },       // 첫 소나기, 캐노피 아래
    9: { key: 'fireflies', density: 0.3 },  // 8월 열대야, 옛집 마루
    10: { key: 'fireflies', density: 0.2 },
    18: { key: 'leaves', density: 0.3 },    // 10월 마지막 날, 섬진강 둑
    20: { key: 'rain', density: 0.6 },      // 11월 철 지난 소나기
    25: { key: 'rain', density: 0.4 },      // 병원 창밖 소나기
    26: { key: 'rain', density: 1 },        // 12월 겨울 폭우
    27: { key: 'rain', density: 0.7 },
    28: { key: 'rain', density: 1 },        // 빗속으로 걸어가는 해원
    32: { key: 'rain', density: 0.2 },      // 비가 그치는 새벽
    34: { key: 'snow', density: 0.6 },      // 첫눈, 캐노피
    35: { key: 'snow', density: 0.4 },
    51: { key: 'leaves', density: 0.45 },   // 10월 섬진강 자전거길
    56: { key: 'petals', density: 0.3 },    // 곡성 매화, 열흘 일찍
    60: { key: 'petals', density: 0.15 },   // 2월 바람, 흙 녹는 냄새
    62: { key: 'rain', density: 0.5 },      // 정체전선, 레이더
    65: { key: 'rain', density: 1 },        // 마을회관
    66: { key: 'rain', density: 1 },        // 불 켜진 주유소
    68: { key: 'rain', density: 1 },        // 뒷산이 무너진다
    77: { key: 'fireflies', density: 0.3 }  // 비 갠 여름밤, 별
  };

  // 장면별 생성 이미지. 'S#번호': 'scenes/파일.webp' — 파일을 넣고 여기에 등록하면 장면 머리 아래에 뜬다
  const SCENE_IMAGES = {};

  // The scene showing at the end of a content page (so a new weather scene starts with its page)
  function sceneAt(page) {
    if (!page || page.type !== 'content') return 0;
    const ch = (window.NOVEL_DATA.chapters || [])[page.chapterId - 1];
    if (!ch) return 0;
    for (let i = Math.min(page.endParaIndex, ch.paragraphs.length - 1); i >= 0; i--) {
      const m = ch.paragraphs[i].match(/^S#(\d+)\./);
      if (m) return Number(m[1]);
    }
    return 0;
  }

  function seasonFor(page) {
    return SCENE_SEASON[sceneAt(page)] || { key: 'none', density: 0 };
  }

  const $ = (id) => document.getElementById(id);
  const el = {
    html: document.documentElement,
    metaThemeColor: $('metaThemeColor'),
    starCanvas: $('starfieldCanvas'),
    bookViewport: $('bookViewport'),
    currentPage: $('currentPage'),
    pageRibbon: $('pageRibbon'),
    flipLayer: $('flipLayer'),
    flipCard: $('flipCard'),
    flipFront: $('flipFront'),
    flipBack: $('flipBack'),
    measureBox: $('measureBox'),
    scrollViewport: $('scrollViewport'),
    scrollContent: $('scrollContent'),
    zonePrev: $('zonePrev'),
    zoneCenter: $('zoneCenter'),
    zoneNext: $('zoneNext'),
    orb: $('orb'),
    orbRing: $('orbRing'),
    deck: $('deck'),
    deckChapter: $('deckChapter'),
    deckPage: $('deckPage'),
    constellation: $('constellation'),
    constDone: $('constDone'),
    constNodes: $('constNodes'),
    constThumb: $('constThumb'),
    constTip: $('constTip'),
    btnOpenToc: $('btnOpenToc'),
    btnCloseToc: $('btnCloseToc'),
    tocDrawer: $('tocDrawer'),
    drawerBackdrop: $('drawerBackdrop'),
    drawerProgressLabel: $('drawerProgressLabel'),
    drawerProgressFill: $('drawerProgressFill'),
    tabBtnToc: $('tabBtnToc'),
    tabBtnBookmarks: $('tabBtnBookmarks'),
    tabPanelToc: $('tabPanelToc'),
    tabPanelBookmarks: $('tabPanelBookmarks'),
    tocList: $('tocList'),
    bookmarkList: $('bookmarkList'),
    bookmarkEmptyState: $('bookmarkEmptyState'),
    bookmarkCountBadge: $('bookmarkCountBadge'),
    btnBookmarkPage: $('btnBookmarkPage'),
    btnOpenSettings: $('btnOpenSettings'),
    btnCloseSettings: $('btnCloseSettings'),
    settingsPanel: $('settingsPanel'),
    fontSizeVal: $('fontSizeVal'),
    lineHeightVal: $('lineHeightVal'),
    btnFontDec: $('btnFontDec'),
    btnFontInc: $('btnFontInc'),
    btnLineDec: $('btnLineDec'),
    btnLineInc: $('btnLineInc'),
    btnToggleMode: $('btnToggleMode'),
    modeIcon: $('modeIcon'),
    modeText: $('modeText'),
    btnOpenTts: $('btnOpenTts'),
    audioCapsule: $('audioCapsule'),
    ttsWaveDot: $('ttsWaveDot'),
    ttsStatusText: $('ttsStatusText'),
    btnTtsPlayPause: $('btnTtsPlayPause'),
    ttsPlayIcon: $('ttsPlayIcon'),
    btnTtsStop: $('btnTtsStop'),
    btnTtsSpeed: $('btnTtsSpeed'),
    btnTtsClose: $('btnTtsClose'),
    ttsVoiceNote: $('ttsVoiceNote'),
    seasonCanvas: $('seasonCanvas'),
    seasonToggle: $('seasonToggle'),
    resumeToast: $('resumeToast'),
    resumeToastMsg: $('resumeToastMsg'),
    btnResumeYes: $('btnResumeYes'),
    btnResumeClose: $('btnResumeClose')
  };

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // =========================================================================
  // 1. Settings & storage
  // =========================================================================
  function loadSavedSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.theme && THEME_META_COLOR[p.theme]) state.theme = p.theme;
        if (p.fontKey && FONT_MAP[p.fontKey]) state.fontKey = p.fontKey;
        if (p.fontSize) state.fontSize = Math.min(26, Math.max(14, Number(p.fontSize)));
        if (p.lineHeight) state.lineHeight = Math.min(2.4, Math.max(1.5, Number(p.lineHeight)));
        if (p.mode === 'scroll' || p.mode === 'flip') state.mode = p.mode;
        if (p.ttsVoice === 'm' || p.ttsVoice === 'f') state.ttsVoice = p.ttsVoice;
        if (typeof p.seasonFx === 'boolean') state.seasonFx = p.seasonFx;
      }
      const bmRaw = localStorage.getItem(STORAGE_KEY_BOOKMARKS);
      if (bmRaw) state.bookmarks = JSON.parse(bmRaw) || [];
    } catch (e) {
      console.warn('Settings load skipped:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify({
        theme: state.theme, fontKey: state.fontKey, fontSize: state.fontSize,
        lineHeight: state.lineHeight, mode: state.mode, ttsVoice: state.ttsVoice, seasonFx: state.seasonFx
      }));
    } catch (e) {}
  }

  function saveReadingProgress() {
    const page = state.pages[state.currentPageIndex];
    if (!page || page.type !== 'content') return;
    try {
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify({
        chapterId: page.chapterId, paraIndex: page.startParaIndex || 0, chapterTitle: page.chapterTitle,
        pageIndex: state.currentPageIndex, totalPages: state.pages.length, updatedAt: Date.now()
      }));
    } catch (e) {}
  }

  function applyVisualSettings() {
    el.html.setAttribute('data-theme', state.theme);
    if (el.metaThemeColor) el.metaThemeColor.setAttribute('content', THEME_META_COLOR[state.theme] || THEME_META_COLOR.starlight);
    el.html.style.setProperty('--font-reader', FONT_MAP[state.fontKey]);
    el.html.style.setProperty('--reader-font-size', state.fontSize + 'px');
    el.html.style.setProperty('--reader-line-height', String(state.lineHeight));
    el.fontSizeVal.textContent = state.fontSize + 'px';
    el.lineHeightVal.textContent = state.lineHeight.toFixed(2);
    document.querySelectorAll('[data-theme-select]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-theme-select') === state.theme));
    document.querySelectorAll('[data-font-select]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-font-select') === state.fontKey));
    document.querySelectorAll('[data-voice-select]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-voice-select') === state.ttsVoice));
    if (el.seasonToggle) el.seasonToggle.setAttribute('aria-checked', String(state.seasonFx));
    if (window.SeasonFX) { window.SeasonFX.setTheme(state.theme === 'starlight'); window.SeasonFX.setEnabled(state.seasonFx); }
  }

  // =========================================================================
  // 2. Page builders & pagination
  // =========================================================================
  function coverStarsSvg() {
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    let out = '';
    for (let i = 0; i < 58; i++) {
      const x = (rnd() * 400).toFixed(1), y = (rnd() * 700).toFixed(1), r = (0.45 + rnd() * 1.25).toFixed(2);
      const cls = i % 3 === 0 ? ' t2' : i % 3 === 1 ? ' t3' : '';
      out += `<circle class="cover-star-bg${cls}" cx="${x}" cy="${y}" r="${r}"/>`;
    }
    return out;
  }

  function buildCoverPageObject() {
    return {
      type: 'cover', chapterId: 0, chapterTitle: '표지', startParaIndex: 0, endParaIndex: -1,
      html: `
        <div class="cover">
          <svg class="cover-sky-svg" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs><linearGradient id="cvSky" x1="0" y1="0" x2="0" y2="1"><stop class="cv-sky-a" offset="0"/><stop class="cv-sky-b" offset="1"/></linearGradient></defs>
            <rect width="400" height="700" fill="url(#cvSky)"/>
            ${coverStarsSvg()}
            <line class="cover-shooting" x1="262" y1="330" x2="304" y2="296"/>
          </svg>
          <div class="cover-frame-line" aria-hidden="true"></div>
          <span class="cover-genre">단편소설</span>
          <div class="cover-content">
            <div class="cover-head">
              <span class="cover-rule"></span>
              <h1 class="cover-title">나란히</h1>
              <span class="cover-hanja">竝 肩</span>
            </div>
            <svg class="cover-pond-svg" viewBox="0 0 400 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
              <defs><radialGradient id="cvGlow" cx="50%" cy="60%" r="55%"><stop class="cv-glow-a" offset="0"/><stop class="cv-glow-b" offset="1"/></radialGradient></defs>
              <ellipse cx="200" cy="76" rx="210" ry="60" fill="url(#cvGlow)"/>
              <line class="cover-horizon" x1="30" y1="46" x2="370" y2="46"/>
              <ellipse class="cover-pond" cx="200" cy="80" rx="152" ry="27"/>
              <ellipse class="cover-ripple-ring" cx="200" cy="80" rx="60" ry="11"/>
              <ellipse class="cover-ripple-ring r2" cx="200" cy="80" rx="60" ry="11"/>
              <ellipse class="cover-ripple-ring r3" cx="200" cy="80" rx="60" ry="11"/>
              <circle class="cover-orb" cx="200" cy="20" r="4.5"/>
              <ellipse class="cover-orb-reflection" cx="200" cy="80" rx="9" ry="3"/>
            </svg>
            <p class="cover-epigraph">
              <span class="epigraph-line">“마주 앉으면 서로의 얼굴이 보인다.</span>
              <span class="epigraph-line epigraph-gap">나란히 서면</span>
              <span class="epigraph-line">같은 길이 보인다.”</span>
            </p>
            <div class="cover-foot">
              <button type="button" class="btn-open-book" data-action="open-first-chapter">책 펼치기 →</button>
              <span class="cover-date-meta">2026년 11월. 초고.</span>
            </div>
          </div>
        </div>`
    };
  }

  function chapterHeadHtml(chapter) {
    const motif = CHAPTER_MOTIFS[chapter.id] || CHAPTER_MOTIFS.cover;
    const chars = chapter.paragraphs.reduce((n, p) => n + p.length, 0);
    const minutes = Math.max(1, Math.round(chars / 500)); // estimated reading time at 500 chars/min
    return `
      <div class="chapter-motif">${motif}</div>
      <span class="chapter-kicker">${escapeHtml(chapter.number)}</span>
      <h2 class="chapter-heading">${escapeHtml(chapter.subtitle)}</h2>
      <span class="chapter-rule"></span>
      <span class="chapter-paracount">약 ${minutes}분</span>`;
  }

  function buildChapterPageObject(chapter) {
    return {
      type: 'chapter', chapterId: chapter.id, chapterNumber: chapter.number, chapterSubtitle: chapter.subtitle,
      chapterTitle: chapter.fullTitle, startParaIndex: 0, endParaIndex: -1,
      html: `
        <div class="chapter-page">
          <span class="chapter-bignum" aria-hidden="true">${String(chapter.id).padStart(2, '0')}</span>
          <div class="chapter-page-inner">${chapterHeadHtml(chapter)}</div>
        </div>`
    };
  }

  const CREDITS_TOP_HTML = `
      <div class="credits-top">
                <div class="credits-star-wrap"><span class="credits-star"></span></div>
        <span class="chapter-kicker">에필로그</span>
        <h2 class="credits-title">클로징 멘트</h2>
      </div>`;
  const creditsBottomHtml = (withButton) => `
      <div class="credits-bottom">
        <span class="credits-sign">나란히 · 2026. 11. 15.</span>
        ${withButton ? '<button type="button" class="btn-open-book btn-back-cover" data-action="back-to-cover">처음으로 돌아가기</button>' : ''}
      </div>`;
  // Afterword blocks, each a paginatable item; the inspiration list is one block so it stays on a single page
  const AFTERWORD_ITEMS = AFTERWORD_PARAS.map((t) => t === '*' ? '<p class="novel-para credits-para credits-break">＊</p>' : `<p class="novel-para credits-para">${escapeHtml(t)}</p>`);
  const SIGNATURE_HTML = (AFTERWORD_SIGNATURE ? `<p class="novel-para credits-para credits-signature">${escapeHtml(AFTERWORD_SIGNATURE)}</p>` : '') + '<div class="credits-top credits-end-bottom"><span class="credits-end-mark">끝</span></div>';
  const INSPIRATIONS_HTML = '<div class="credits-refs"><p class="credits-ref-head">이 이야기에 영감을 준 것들</p>' +
    INSPIRATIONS.map((r, i) => `<p class="credits-ref"><a href="${r.url}" target="_blank" rel="noopener"><span class="ref-no">${i + 1}.</span> <span class="ref-kind">(${r.kind})</span> ${escapeHtml(r.by)}, 〈${escapeHtml(r.title)}〉 ${r.year ? `<span class="ref-year">(${r.year})</span>` : ''}</a></p>`).join('') +
    '</div>';
  const creditsItemHtml = (html) => html;

  // Each inspiration line stays on one line: shrink the font until it fits (phones are narrow)
  function fitRefLines(root) {
    root.querySelectorAll('.credits-ref').forEach((p) => {
      let size = 13;
      p.style.fontSize = size + 'px';
      while (p.scrollWidth > p.clientWidth && size > 9) { size -= 0.5; p.style.fontSize = size + 'px'; }
    });
  }

  const contentHeaderHtml = (title) => `<div class="page-header-strip"><span class="rh-left">나란히</span><span class="rh-right">${escapeHtml(title)}</span></div>`;
  const contentFooterHtml = (pageNo) => `<div class="page-footer-strip"><span>${pageNo}</span></div>`;

  // Fill pages with as many paragraphs as fit. headHtml opens the first page; tailHtml must fit on the last
  // (falls to a new page with the final paragraph if it doesn't). Returns [{start, end, html}].
  function fillPages(measureBody, maxH, paras, renderPara, headHtml, tailHtml) {
    const out = [];
    let pIdx = 0;
    do {
      const start = pIdx, parts = [];
      measureBody.innerHTML = out.length ? '' : headHtml;
      while (pIdx < paras.length) {
        measureBody.insertAdjacentHTML('beforeend', renderPara(paras[pIdx], pIdx));
        if (measureBody.scrollHeight > maxH && parts.length) { measureBody.lastElementChild.remove(); break; }
        parts.push(measureBody.lastElementChild.outerHTML);
        pIdx++;
        if (measureBody.scrollHeight > maxH) break; // oversized single paragraph
      }
      if (pIdx < paras.length && parts.length > 1 && parts[parts.length - 1].includes('scene-head')) { parts.pop(); pIdx--; }
      out.push({ start, end: pIdx - 1, html: (out.length ? '' : headHtml) + parts.join('') });
    } while (pIdx < paras.length);
    if (tailHtml) {
      const last = out[out.length - 1];
      measureBody.innerHTML = last.html + tailHtml;
      if (measureBody.scrollHeight <= maxH) last.html += tailHtml;
      else {
        const movedPara = last.end > last.start ? renderPara(paras[last.end], last.end) : '';
        if (movedPara) { last.html = last.html.slice(0, last.html.lastIndexOf('<p')); last.end--; }
        out.push({ start: last.end + 1, end: last.end + (movedPara ? 1 : 0), html: movedPara + tailHtml });
      }
    }
    return out;
  }

  function paginateNovel() {
    const novel = window.NOVEL_DATA;
    if (!novel || !novel.chapters) return;

    const rect = el.bookViewport.getBoundingClientRect();
    el.measureBox.style.width = (rect.width || Math.min(560, window.innerWidth)) + 'px';
    el.measureBox.style.height = (rect.height || window.innerHeight) + 'px';

    const pages = [buildCoverPageObject()];
    const chapterStartPages = {};
    let pageNo = 0;

    el.measureBox.innerHTML = `${contentHeaderHtml('제1장')}<div class="page-body-content" id="measureBody"></div>${contentFooterHtml(1)}`;
    const measureBody = document.getElementById('measureBody');
    const maxBodyHeight = measureBody.clientHeight;

    const renderNovelPara = (t) => `<p class="novel-para">${paraHtml(t)}</p>`;
    novel.chapters.forEach((chapter) => {
      chapterStartPages[chapter.id] = pages.length;
      pages.push(buildChapterPageObject(chapter));
      fillPages(measureBody, maxBodyHeight, chapter.paragraphs, renderNovelPara, '<div class="chapter-sink"></div>', '').forEach((pg) => {
        pageNo++;
        pages.push({
          type: 'content', chapterId: chapter.id, chapterNumber: chapter.number, chapterSubtitle: chapter.subtitle,
          chapterTitle: chapter.fullTitle, startParaIndex: pg.start, endParaIndex: pg.end, pageNo,
          snippet: (chapter.paragraphs[pg.start] || chapter.fullTitle).slice(0, 68),
          bodyInnerHtml: pg.html
        });
      });
    });

    // 작가의 말 — paginated like a chapter so every paragraph is reachable
    chapterStartPages[CREDITS_CHAPTER_ID] = pages.length;
    measureBody.classList.add('credits-page'); // measure with the credits typography, same as the rendered page
    const pushCredits = (pg, offset) => pages.push({
      type: 'credits', chapterId: CREDITS_CHAPTER_ID, chapterTitle: '클로징 멘트', startParaIndex: pg.start + offset, endParaIndex: pg.end + offset,
      html: `${contentHeaderHtml('클로징 멘트')}<div class="page-body-content credits-page">${pg.html}</div>${contentFooterHtml('')}`
    });
    // Signature is the tail: it never sits alone, the last paragraph moves with it if needed
    fillPages(measureBody, maxBodyHeight, AFTERWORD_ITEMS, creditsItemHtml, CREDITS_TOP_HTML, SIGNATURE_HTML).forEach((pg) => pushCredits(pg, 0));
    // Inspirations always open a fresh page, with the back-to-cover button beneath
    fillPages(measureBody, maxBodyHeight, [INSPIRATIONS_HTML], creditsItemHtml, '', creditsBottomHtml(true)).forEach((pg) => pushCredits(pg, AFTERWORD_ITEMS.length));
    measureBody.classList.remove('credits-page');
    state.pages = pages;
    state.chapterStartPages = chapterStartPages;
    state.contentTotal = Math.max(1, pageNo);
  }

  function buildFullPageHtml(pageIndex) {
    const page = state.pages[pageIndex];
    if (!page) return '';
    if (page.type !== 'content') return page.html;
    return `${contentHeaderHtml(page.chapterTitle)}<div class="page-body-content">${page.bodyInnerHtml}</div>${contentFooterHtml(page.pageNo)}`;
  }

  function pageLabel(page) {
    if (!page) return '';
    if (page.type === 'cover') return '표지';
    if (page.type === 'credits') return '끝';
    if (page.type === 'chapter') return page.chapterNumber;
    return `${page.pageNo} / ${state.contentTotal}쪽`;
  }

  function readPercent(pageIndex) {
    const page = state.pages[pageIndex];
    if (!page) return 0;
    if (page.type === 'credits') return 100;
    if (page.type === 'content') return Math.round((page.pageNo / state.contentTotal) * 100);
    if (page.type === 'chapter') {
      const next = state.pages[pageIndex + 1];
      return next && next.pageNo ? Math.round(((next.pageNo - 1) / state.contentTotal) * 100) : 0;
    }
    return 0;
  }

  // =========================================================================
  // 3. Rendering & flip
  // =========================================================================
  let renderedHtml = '';
  // animate=false lands the page in its settled state (used when flipping back to a page already seen)
  function renderCurrentPage(animate = true) {
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    const html = buildFullPageHtml(state.currentPageIndex);
    if (html !== renderedHtml) { // same markup → leave the DOM alone so entrance animations run only once
      renderedHtml = html;
      el.currentPage.innerHTML = html;
      el.currentPage.classList.toggle('no-enter', !animate);
      if (page.type === 'credits') fitRefLines(el.currentPage);

      const openBtn = el.currentPage.querySelector('[data-action="open-first-chapter"]');
      if (openBtn) openBtn.addEventListener('click', (e) => { e.stopPropagation(); turnToPage(1, 'forward'); });
      const backBtn = el.currentPage.querySelector('[data-action="back-to-cover"]');
      if (backBtn) backBtn.addEventListener('click', (e) => { e.stopPropagation(); turnToPage(0, 'backward'); });
    }

    updateIndicators();
    saveReadingProgress();
  }

  function turnToPage(targetIndex, directionOverride, onCompleteCallback) {
    if (state.isFlipping) return;
    const clamped = Math.max(0, Math.min(state.pages.length - 1, targetIndex));
    if (clamped === state.currentPageIndex) { if (onCompleteCallback) onCompleteCallback(); return; }

    const direction = directionOverride || (clamped > state.currentPageIndex ? 'forward' : 'backward');
    const isManualTurnDuringTts = !onCompleteCallback && state.ttsStatus === 'playing';
    if (isManualTurnDuringTts) ttsHold();

    const oldHtml = buildFullPageHtml(state.currentPageIndex);
    const newHtml = buildFullPageHtml(clamped);

    state.isFlipping = true;
    el.flipCard.classList.remove('anim-forward', 'anim-backward');
    el.flipLayer.classList.remove('hidden');

    if (direction === 'forward') {
      state.currentPageIndex = clamped;
      renderCurrentPage(); // new page animates in once, revealed under the lifting sheet
      el.flipFront.innerHTML = `<div class="book-page">${oldHtml}</div>`;
      el.flipBack.innerHTML = `<div class="book-page"></div>`;
      void el.flipCard.offsetWidth;
      el.flipCard.classList.add('anim-forward');
    } else {
      el.flipFront.innerHTML = `<div class="book-page">${newHtml}</div>`;
      el.flipBack.innerHTML = `<div class="book-page"></div>`;
      void el.flipCard.offsetWidth;
      el.flipCard.classList.add('anim-backward');
      state.currentPageIndex = clamped;
    }

    updateIndicators();
    saveReadingProgress();

    setTimeout(() => {
      renderCurrentPage(direction === 'forward'); // backward: the sheet already showed the page, land it settled
      el.flipLayer.classList.add('hidden');
      el.flipCard.classList.remove('anim-forward', 'anim-backward');
      state.isFlipping = false;
      if (onCompleteCallback) onCompleteCallback();
      else if (isManualTurnDuringTts) ttsResumeOnCurrentPage();
    }, 520);
  }

  const nextPage = () => { if (state.currentPageIndex < state.pages.length - 1) turnToPage(state.currentPageIndex + 1, 'forward'); };
  const prevPage = () => { if (state.currentPageIndex > 0) turnToPage(state.currentPageIndex - 1, 'backward'); };

  // =========================================================================
  // 4. Scroll mode
  // =========================================================================
  function renderScrollModeContent() {
    const novel = window.NOVEL_DATA;
    if (!novel) return;
    const parts = novel.chapters.map((chap) => `
      <section class="scroll-chapter-block" id="scroll-chap-${chap.id}" data-chapter-id="${chap.id}">
        <div class="scroll-chapter-head">${chapterHeadHtml(chap)}</div>
        ${chap.paragraphs.map((p) => `<p>${paraHtml(p)}</p>`).join('')}
      </section>`);
    parts.push(`<section class="scroll-credits-block credits-page" id="scroll-credits" data-chapter-id="${CREDITS_CHAPTER_ID}">${CREDITS_TOP_HTML}${AFTERWORD_ITEMS.join('')}${SIGNATURE_HTML}${INSPIRATIONS_HTML}${creditsBottomHtml(false)}</section>`);
    el.scrollContent.innerHTML = parts.join('');
    fitRefLines(el.scrollContent);
  }

  function scrollMax() {
    return Math.max(1, el.scrollViewport.scrollHeight - el.scrollViewport.clientHeight);
  }

  // Chapter whose block is at the reading line (35% down the viewport)
  function scrollCurrentChapter() {
    const y = el.scrollViewport.scrollTop + el.scrollViewport.clientHeight * 0.35;
    let cur = null;
    el.scrollContent.querySelectorAll('[data-chapter-id]').forEach((sec) => {
      if (sec.offsetTop <= y) cur = sec;
    });
    return cur ? Number(cur.getAttribute('data-chapter-id')) : 0;
  }

  function scrollToChapter(chapterId) {
    const node = document.getElementById(chapterId === CREDITS_CHAPTER_ID ? 'scroll-credits' : `scroll-chap-${chapterId}`);
    if (node) el.scrollViewport.scrollTo({ top: node.offsetTop - 24, behavior: 'smooth' });
  }

  // First visible paragraph in scroll mode → { chapterId, paraIndex }
  function scrollAnchorParagraph() {
    const top = el.scrollViewport.getBoundingClientRect().top + 60;
    const sections = el.scrollContent.querySelectorAll('.scroll-chapter-block');
    for (const sec of sections) {
      const ps = sec.querySelectorAll('p');
      for (let i = 0; i < ps.length; i++) {
        if (ps[i].getBoundingClientRect().bottom > top) return { chapterId: Number(sec.getAttribute('data-chapter-id')), paraIndex: i };
      }
    }
    return { chapterId: 1, paraIndex: -1 };
  }

  function updateModeView() {
    if (state.mode === 'scroll') {
      el.bookViewport.style.display = 'none';
      el.scrollViewport.classList.remove('hidden');
      el.modeIcon.innerHTML = MODE_ICONS.scroll;
      el.modeText.textContent = '스크롤';
      if (!el.scrollContent.innerHTML.trim()) renderScrollModeContent();
      const cur = state.pages[state.currentPageIndex];
      if (cur && cur.chapterId > 0) {
        const node = document.getElementById(cur.chapterId === CREDITS_CHAPTER_ID ? 'scroll-credits' : `scroll-chap-${cur.chapterId}`);
        if (node) el.scrollViewport.scrollTop = node.offsetTop - 24;
      }
    } else {
      el.scrollViewport.classList.add('hidden');
      el.bookViewport.style.display = 'block';
      el.modeIcon.innerHTML = MODE_ICONS.flip;
      el.modeText.textContent = '책넘김';
      paginateNovel();
      renderCurrentPage();
    }
    buildConstellation();
    updateIndicators();
  }

  // =========================================================================
  // 5. Orb, deck & constellation
  // =========================================================================
  let deckHideTimer = null;

  function showDeck() {
    state.deckOpen = true;
    el.deck.classList.remove('hidden');
    el.orb.classList.add('open');
    updateIndicators();
    armDeckAutoHide();
  }

  function hideDeck() {
    state.deckOpen = false;
    el.deck.classList.add('hidden');
    el.orb.classList.remove('open');
    clearTimeout(deckHideTimer);
  }

  function toggleDeck() { state.deckOpen ? hideDeck() : showDeck(); }

  function armDeckAutoHide() {
    clearTimeout(deckHideTimer);
    if (state.deckOpen) deckHideTimer = setTimeout(hideDeck, DECK_AUTOHIDE_MS);
  }

  // Current position as 0..1 in the active mode
  function currentRatio() {
    if (state.mode === 'scroll') return clamp01(el.scrollViewport.scrollTop / scrollMax());
    return state.pages.length > 1 ? state.currentPageIndex / (state.pages.length - 1) : 0;
  }

  function currentPercent() {
    if (state.mode === 'scroll') return Math.round(currentRatio() * 100);
    return readPercent(state.currentPageIndex);
  }

  // Build star nodes for cover / 8 chapters / credits at their positions in the active mode
  function buildConstellation() {
    const novel = window.NOVEL_DATA;
    if (!novel) return;
    const nodes = [];
    const ratioFor = (chapterId) => {
      if (chapterId === 0) return 0;
      if (chapterId === CREDITS_CHAPTER_ID && state.mode === 'scroll') return 1;
      if (state.mode === 'scroll') {
        const sec = document.getElementById(`scroll-chap-${chapterId}`);
        return sec ? clamp01((sec.offsetTop - 24) / scrollMax()) : 0;
      }
      return (state.chapterStartPages[chapterId] || 1) / Math.max(1, state.pages.length - 1);
    };
    const add = (chapterId, label, ep) => {
      const r = ratioFor(chapterId);
      nodes.push(`<button type="button" class="const-node${ep ? ' ep' : ''}" data-chapter="${chapterId}" data-ratio="${r.toFixed(4)}" style="left:${(r * 100).toFixed(2)}%" title="${escapeHtml(label)}"><span class="const-label">${escapeHtml(label)}</span><i></i></button>`);
    };
    add(0, '표지', true);
    novel.chapters.forEach((c) => add(c.id, String(c.id), false));
    add(CREDITS_CHAPTER_ID, '끝', true);
    el.constNodes.innerHTML = nodes.join('');
    el.constNodes.querySelectorAll('.const-node').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        jumpToChapter(Number(btn.getAttribute('data-chapter')));
        armDeckAutoHide();
      });
    });
  }

  function jumpToChapter(chapterId) {
    if (state.mode === 'scroll') {
      if (chapterId === 0) el.scrollViewport.scrollTo({ top: 0, behavior: 'smooth' });
      else scrollToChapter(chapterId);
      return;
    }
    if (chapterId === 0) turnToPage(0);
    else turnToPage(state.chapterStartPages[chapterId] || 1);
  }

  // Label for an arbitrary ratio (scrub preview)
  function labelAtRatio(ratio) {
    if (state.mode === 'scroll') {
      let title = '표지';
      el.constNodes.querySelectorAll('.const-node').forEach((n) => {
        if (Number(n.getAttribute('data-ratio')) <= ratio + 0.0001) {
          const id = Number(n.getAttribute('data-chapter'));
          const chap = (window.NOVEL_DATA.chapters || []).find((c) => c.id === id);
          title = id === CREDITS_CHAPTER_ID ? '클로징 멘트' : chap ? chap.fullTitle : '표지';
        }
      });
      return `${title} · ${Math.round(ratio * 100)}%`;
    }
    const idx = Math.round(ratio * (state.pages.length - 1));
    const page = state.pages[idx];
    return page ? `${page.chapterTitle} · ${pageLabel(page)}` : '';
  }

  function commitRatio(ratio) {
    if (state.mode === 'scroll') {
      el.scrollViewport.scrollTo({ top: ratio * scrollMax(), behavior: 'auto' });
    } else {
      turnToPage(Math.round(ratio * (state.pages.length - 1)));
    }
  }

  function setThumb(ratio) {
    const pct = (ratio * 100).toFixed(2) + '%';
    el.constThumb.style.left = `calc(8px + (100% - 16px) * ${ratio.toFixed(4)})`;
    el.constDone.style.width = `calc((100% - 16px) * ${ratio.toFixed(4)})`;
    el.constNodes.querySelectorAll('.const-node').forEach((n) => {
      const r = Number(n.getAttribute('data-ratio'));
      n.classList.toggle('done', r < ratio - 0.0005);
    });
    void pct;
  }

  function bindScrubber() {
    let dragging = false;

    const ratioFromEvent = (e) => {
      const rect = el.constNodes.getBoundingClientRect();
      return clamp01((e.clientX - rect.left) / Math.max(1, rect.width));
    };

    el.constellation.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.const-node')) return; // node handles its own click
      dragging = true;
      el.constellation.classList.add('dragging');
      el.constellation.setPointerCapture(e.pointerId);
      const r = ratioFromEvent(e);
      setThumb(r);
      el.constTip.textContent = labelAtRatio(r);
      clearTimeout(deckHideTimer);
    });

    el.constellation.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = ratioFromEvent(e);
      setThumb(r);
      el.constTip.textContent = labelAtRatio(r);
    });

    const finish = (e) => {
      if (!dragging) return;
      dragging = false;
      el.constellation.classList.remove('dragging');
      commitRatio(ratioFromEvent(e));
      armDeckAutoHide();
    };
    el.constellation.addEventListener('pointerup', finish);
    el.constellation.addEventListener('pointercancel', finish);
  }

  // Everything that reflects position: deck labels, constellation, orb ring, ribbon, TOC highlight
  function updateIndicators() {
    const page = state.pages[state.currentPageIndex];
    const ratio = currentRatio();
    const pct = currentPercent();

    el.orbRing.style.setProperty('--p', pct);
    setThumb(ratio);

    let chapterId;
    if (state.mode === 'scroll') {
      chapterId = scrollCurrentChapter();
      const chap = (window.NOVEL_DATA.chapters || []).find((c) => c.id === chapterId);
      el.deckChapter.textContent = chapterId === CREDITS_CHAPTER_ID ? '클로징 멘트' : chap ? chap.fullTitle : '표지';
      el.deckPage.textContent = `${pct}% 읽음`;
    } else if (page) {
      chapterId = page.chapterId;
      el.deckChapter.textContent = page.chapterTitle;
      el.deckPage.textContent = page.type === 'content' ? `${pageLabel(page)} · ${pct}%` : pageLabel(page);
    }

    el.constNodes.querySelectorAll('.const-node').forEach((n) => {
      n.classList.toggle('current', Number(n.getAttribute('data-chapter')) === chapterId);
    });

    if (window.SeasonFX) {
      const s = seasonFor(state.mode === 'flip' ? page : null); // ponytail: scroll mode has no per-scene tracking, so no weather there
      window.SeasonFX.setSeason(s.key, s.density);
    }

    const isMarked = state.mode === 'flip' && isPageBookmarked(state.currentPageIndex);
    el.btnBookmarkPage.classList.toggle('active', isMarked);
    el.pageRibbon.classList.toggle('hidden', !isMarked);

    document.querySelectorAll('.toc-item').forEach((item) => {
      item.classList.toggle('active', Number(item.getAttribute('data-chapter-id')) === chapterId);
    });
    el.drawerProgressLabel.textContent = `${pct}% 읽음`;
    el.drawerProgressFill.style.width = pct + '%';
  }

  // =========================================================================
  // 6. TOC & bookmarks
  // =========================================================================
  function tocItemHtml({ chapterId, motif, num, title, right }) {
    return `
      <li class="toc-item" data-chapter-id="${chapterId}">
        <span class="toc-motif">${motif}</span>
        <div class="toc-item-left"><span class="toc-chap-num">${num}</span><span class="toc-chap-title">${escapeHtml(title)}</span></div>
        <span class="toc-page-num">${right}</span>
      </li>`;
  }

  function renderTocList() {
    const novel = window.NOVEL_DATA;
    if (!novel) return;
    const items = [tocItemHtml({ chapterId: 0, motif: CHAPTER_MOTIFS.cover, num: 'COVER', title: '표지 — 나란히', right: '표지' })];
    novel.chapters.forEach((chap) => {
      const firstContent = state.pages[(state.chapterStartPages[chap.id] || 0) + 1];
      items.push(tocItemHtml({
        chapterId: chap.id, motif: CHAPTER_MOTIFS[chap.id] || CHAPTER_MOTIFS.cover, num: chap.number, title: chap.subtitle,
        right: `${firstContent && firstContent.pageNo ? firstContent.pageNo : 1}쪽`
      }));
    });
    items.push(tocItemHtml({ chapterId: CREDITS_CHAPTER_ID, motif: CHAPTER_MOTIFS.end, num: 'EPILOGUE', title: '클로징 멘트', right: '끝' }));
    el.tocList.innerHTML = items.join('');
    el.tocList.querySelectorAll('.toc-item').forEach((li) => {
      li.addEventListener('click', () => {
        closeOverlays();
        jumpToChapter(Number(li.getAttribute('data-chapter-id')));
      });
    });
  }

  function isPageBookmarked(pageIndex) {
    const page = state.pages[pageIndex];
    if (!page || page.type !== 'content') return false;
    return state.bookmarks.some((b) => b.chapterId === page.chapterId && b.paraIndex >= page.startParaIndex && b.paraIndex <= page.endParaIndex);
  }

  function toggleCurrentPageBookmark() {
    if (state.mode === 'scroll') return;
    const page = state.pages[state.currentPageIndex];
    if (!page || page.type !== 'content') return;
    const existing = state.bookmarks.findIndex((b) => b.chapterId === page.chapterId && b.paraIndex >= page.startParaIndex && b.paraIndex <= page.endParaIndex);
    if (existing >= 0) state.bookmarks.splice(existing, 1);
    else state.bookmarks.unshift({ chapterId: page.chapterId, paraIndex: page.startParaIndex, chapterTitle: page.chapterTitle, snippet: page.snippet, savedAt: new Date().toLocaleDateString('ko-KR') });
    try { localStorage.setItem(STORAGE_KEY_BOOKMARKS, JSON.stringify(state.bookmarks)); } catch (e) {}
    renderBookmarkList();
    updateIndicators();
  }

  function findPageForParagraph(chapterId, paraIndex) {
    for (let i = 1; i < state.pages.length; i++) {
      const p = state.pages[i];
      if (p.type !== 'content' && p.type !== 'credits') continue;
      if (p.chapterId === chapterId && paraIndex >= p.startParaIndex && paraIndex <= p.endParaIndex) return i;
    }
    return state.chapterStartPages[chapterId] || 1;
  }

  function renderBookmarkList() {
    el.bookmarkCountBadge.textContent = String(state.bookmarks.length);
    if (state.bookmarks.length === 0) {
      el.bookmarkList.innerHTML = '';
      el.bookmarkEmptyState.classList.remove('hidden');
      return;
    }
    el.bookmarkEmptyState.classList.add('hidden');
    el.bookmarkList.innerHTML = state.bookmarks.map((bm, i) => {
      const pageIdx = findPageForParagraph(bm.chapterId, bm.paraIndex);
      const folio = (state.pages[pageIdx] && state.pages[pageIdx].pageNo) || '';
      return `
        <li class="bookmark-item" data-bm-index="${i}" data-target-page="${pageIdx}">
          <div class="bookmark-item-top"><span>${escapeHtml(bm.chapterTitle)}</span><span>${folio ? folio + '쪽 · ' : ''}${bm.savedAt}</span></div>
          <p class="bookmark-snippet">${escapeHtml(bm.snippet)}…</p>
        </li>`;
    }).join('');
    el.bookmarkList.querySelectorAll('.bookmark-item').forEach((li) => {
      li.addEventListener('click', () => {
        closeOverlays();
        if (state.mode === 'scroll') { state.mode = 'flip'; saveSettings(); updateModeView(); }
        turnToPage(Number(li.getAttribute('data-target-page')));
      });
    });
  }

  // =========================================================================
  // 7. Audiobook (pre-rendered neural voice) with Web Speech fallback
  // =========================================================================
  const audiobook = { available: false, cues: null, audio: new Audio(), chapterId: 0, paraIndex: -1, ticking: false };
  audiobook.audio.preload = 'auto';

  async function initAudiobook() {
    audiobook.available = false;
    audiobook.cues = null;
    try {
      const res = await fetch(`audio/${state.ttsVoice}/cues.json`, { cache: 'no-cache' });
      if (!res.ok) return;
      const cues = await res.json();
      if (!cues || !cues.chapters) return;
      // ponytail: audio built from an older text → paragraph cues misalign; use Web Speech until rebuilt
      const stale = (window.NOVEL_DATA.chapters || []).some((c) => ((cues.chapters[String(c.id)] || {}).starts || []).length !== c.paragraphs.length);
      if (stale) { if (el.ttsVoiceNote) el.ttsVoiceNote.textContent = '본문이 고쳐져 내장 오디오북을 다시 만드는 중입니다. 그동안은 브라우저 음성으로 낭독합니다.'; return; }
      audiobook.cues = cues;
      audiobook.available = true;
    } catch (e) {
      /* offline or audio not built: Web Speech fallback stays active */
    }
    if (!audiobook.available && !audiobook.cues && el.ttsVoiceNote && !/다시 만드는 중/.test(el.ttsVoiceNote.textContent)) {
      el.ttsVoiceNote.textContent = '내장 오디오북을 불러오지 못해 브라우저 음성으로 낭독합니다. 선택한 성별에 가장 가까운 한국어 음성을 씁니다.';
    }
  }

  // Switch voice set; a running audiobook resumes at the same paragraph in the new voice
  async function setTtsVoice(key) {
    if (key === state.ttsVoice) return;
    state.ttsVoice = key;
    saveSettings();
    applyVisualSettings();
    const resume = audiobook.available && state.ttsStatus === 'playing' ? { c: audiobook.chapterId, p: audiobook.paraIndex } : null;
    if (resume) audiobook.audio.pause();
    audiobook.chapterId = 0;
    await initAudiobook();
    if (resume && audiobook.available) abPlay(resume.c, resume.p);
    else if (!audiobook.available && state.ttsStatus === 'playing') speakCurrentParagraph();
    updateTtsUi();
  }

  const chapterById = (id) => (window.NOVEL_DATA.chapters || []).find((c) => c.id === id);

  function abCue(chapterId) {
    return audiobook.cues && audiobook.cues.chapters[String(chapterId)];
  }

  function abPlay(chapterId, paraIndex) {
    const cue = abCue(chapterId);
    if (!cue) { ttsFinish(); return; }
    const a = audiobook.audio;
    const t = paraIndex < 0 ? 0 : (cue.starts[Math.min(paraIndex, cue.starts.length - 1)] || 0);
    const src = `audio/${state.ttsVoice}/ch${chapterId}.mp3`;
    const needLoad = audiobook.chapterId !== chapterId || !a.src || !a.src.endsWith(src);
    audiobook.chapterId = chapterId;
    audiobook.paraIndex = paraIndex;
    state.ttsStatus = 'playing';
    a.playbackRate = state.ttsRate;

    const seek = () => { try { a.currentTime = t; } catch (e) {} };
    const go = () => {
      seek();
      a.play().catch(() => {});
      // Some servers/browsers drop a seek issued at loadedmetadata; verify once playback actually starts
      if (t > 0.5) {
        a.addEventListener('playing', () => {
          if (audiobook.chapterId === chapterId && audiobook.paraIndex === paraIndex && Math.abs(a.currentTime - t) > 0.5) seek();
        }, { once: true });
      }
    };
    if (needLoad) {
      a.src = src;
      a.addEventListener('loadedmetadata', go, { once: true });
      a.load();
    } else {
      go();
    }
    highlightAudioParagraph(chapterId, paraIndex);
    updateTtsUi();
    if (!audiobook.ticking) { audiobook.ticking = true; requestAnimationFrame(abTick); }
  }

  function abTick() {
    if (!audiobook.available || state.ttsStatus !== 'playing') { audiobook.ticking = false; return; }
    const a = audiobook.audio;
    const cue = abCue(audiobook.chapterId);
    if (cue && !a.paused && !a.seeking) {
      const t = a.currentTime;
      let i = audiobook.paraIndex;
      while (i + 1 < cue.starts.length && t >= cue.starts[i + 1] - 0.015) i++;
      if (i !== audiobook.paraIndex) {
        // No pause/resume here: the rendered audio already holds ~1s of silence at each boundary,
        // and a pause/play cycle clips the first words after it (Bluetooth sinks drop up to a second).
        audiobook.paraIndex = i;
        highlightAudioParagraph(audiobook.chapterId, i);
        updateTtsUi();
      }
    }
    requestAnimationFrame(abTick);
  }

  audiobook.audio.addEventListener('ended', () => {
    if (state.ttsStatus !== 'playing') return;
    const next = audiobook.chapterId + 1;
    if (!abCue(next)) { ttsFinish(); return; }
    if (state.mode === 'flip') {
      turnToPage(state.chapterStartPages[next] || state.currentPageIndex + 1, 'forward', () => abPlay(next, -1));
    } else {
      scrollToChapter(next);
      abPlay(next, -1);
    }
  });

  audiobook.audio.addEventListener('error', () => {
    if (state.ttsStatus !== 'playing') return;
    audiobook.available = false; // fall back to Web Speech from here on
    el.ttsStatusText.textContent = '오디오를 불러오지 못해 브라우저 음성으로 전환';
    state.ttsStatus = 'stopped';
    setTimeout(ttsStartFromCurrentPage, 600);
  });

  function clearTtsHighlight() {
    document.querySelectorAll('.tts-reading-active').forEach((n) => n.classList.remove('tts-reading-active'));
  }

  // Highlight paragraph i of chapter; follows the reading across pages / scroll
  function highlightAudioParagraph(chapterId, i) {
    clearTtsHighlight();
    if (i < 0) return; // chapter title segment
    if (state.mode === 'scroll') {
      const sec = document.getElementById(`scroll-chap-${chapterId}`);
      const p = sec && sec.querySelectorAll('p')[i];
      if (!p) return;
      p.classList.add('tts-reading-active');
      const vr = el.scrollViewport.getBoundingClientRect();
      const pr = p.getBoundingClientRect();
      if (pr.top < vr.top + 90 || pr.bottom > vr.bottom - 160) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const idx = findPageForParagraph(chapterId, i);
    const apply = () => {
      const page = state.pages[state.currentPageIndex];
      if (!page || page.type !== 'content') return;
      const node = el.currentPage.querySelectorAll('p.novel-para')[i - page.startParaIndex];
      if (node) node.classList.add('tts-reading-active');
    };
    if (idx === state.currentPageIndex) apply();
    else if (state.isFlipping) setTimeout(() => highlightAudioParagraph(chapterId, i), 560);
    else turnToPage(idx, idx > state.currentPageIndex ? 'forward' : 'backward', apply);
  }

  // ---- Web Speech fallback ----
  const synth = window.speechSynthesis || null;
  let cachedVoice = null; // { key: 'm'|'f', voice }
  let currentUtterance = null;
  const MALE_KEYWORDS = ['injoon', '인준', 'hyunsu', '현수', 'bongjin', '봉진', 'gookmin', '국민', 'male', '남성', '민수', '태민'];
  const NEURAL_RE = /natural|online|neural|premium|enhanced|wavenet|studio/i;

  function getKoreanVoices() {
    if (!synth) return [];
    return (synth.getVoices() || []).filter((v) => /^ko/i.test(v.lang || '') || /한국어|korean/i.test(v.name || ''));
  }
  const isLikelyMaleVoice = (v) => !!v && MALE_KEYWORDS.some((kw) => v.name.toLowerCase().includes(kw));
  // Prefer voices matching the chosen gender, then neural/online quality
  function scoreVoice(v) {
    const n = v.name.toLowerCase();
    const genderMatch = isLikelyMaleVoice(v) === (state.ttsVoice === 'm');
    return (genderMatch ? 100 : 0) + (NEURAL_RE.test(n) ? 50 : 0) + (n.includes('google') ? 20 : 0) + (v.localService === false ? 10 : 0);
  }
  function resolveTtsVoice() {
    if (!cachedVoice || cachedVoice.key !== state.ttsVoice) {
      const ko = getKoreanVoices();
      cachedVoice = { key: state.ttsVoice, voice: ko.length ? ko.slice().sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] : null };
    }
    return cachedVoice.voice;
  }
  if (synth && typeof synth.onvoiceschanged !== 'undefined') {
    synth.onvoiceschanged = () => { cachedVoice = null; };
  }

  function cancelSpeechInternal() {
    currentUtterance = null;
    if (synth) { synth.cancel(); if (synth.paused) synth.resume(); }
  }

  // Split long text into ≤150-char sentence chunks: Chrome silently stops long utterances (~15 s) on network voices
  function chunkSentences(text) {
    const parts = text.match(/[^.!?。…”]+[.!?。…”]*\s*/g) || [text];
    const chunks = [];
    let cur = '';
    for (const p of parts) {
      if ((cur + p).length > 150 && cur) { chunks.push(cur.trim()); cur = p; } else cur += p;
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks;
  }

  function speakText(text, onDone) {
    cancelSpeechInternal();
    const chunks = chunkSentences(text.replace(/\*/g, '').replace(/^S#\d+\.\s*/, '').replace(/^[^:]{1,24}? : /, ''));
    let k = 0;
    const speakNext = () => {
      if (k >= chunks.length) { onDone(); return; }
      const utter = new SpeechSynthesisUtterance(chunks[k++]);
      utter.lang = 'ko-KR';
      const voice = resolveTtsVoice();
      if (voice) utter.voice = voice;
      // Male set reads low and slow; if only a female system voice exists for 'm', drop pitch to approximate
      utter.pitch = state.ttsVoice === 'm' ? (isLikelyMaleVoice(voice) ? 0.85 : 0.72) : 0.95;
      utter.rate = state.ttsRate * (state.ttsVoice === 'm' ? 0.85 : 0.92);
      const finish = () => { if (currentUtterance !== utter || state.ttsStatus !== 'playing') return; speakNext(); };
      utter.onend = finish;
      utter.onerror = (ev) => { if (currentUtterance !== utter) return; if (ev.error === 'interrupted' || ev.error === 'canceled') return; finish(); };
      currentUtterance = utter;
      // Chrome drops a speak() issued synchronously after cancel(); yield one tick
      setTimeout(() => { if (currentUtterance === utter) synth.speak(utter); }, 40);
    };
    speakNext();
  }

  function ttsAdvancePage() {
    clearTtsHighlight();
    if (state.currentPageIndex < state.pages.length - 1) {
      state.ttsParaOffset = 0;
      turnToPage(state.currentPageIndex + 1, 'forward', () => { if (state.ttsStatus === 'playing') speakCurrentParagraph(); });
    } else {
      ttsFinish();
    }
  }

  function speakCurrentParagraph() {
    if (!synth) { el.ttsStatusText.textContent = '이 브라우저는 음성 낭독을 지원하지 않습니다'; return; }
    if (state.mode === 'scroll') { state.mode = 'flip'; saveSettings(); updateModeView(); }
    const page = state.pages[state.currentPageIndex];
    if (!page) return;
    if (page.type === 'cover') { state.ttsStatus = 'playing'; state.ttsParaOffset = 0; updateTtsUi(); ttsAdvancePage(); return; }
    if (page.type === 'credits') { ttsFinish(); return; }
    if (page.type === 'chapter') { state.ttsStatus = 'playing'; updateTtsUi(); speakText(`${page.chapterNumber}. ${page.chapterSubtitle}.`, ttsAdvancePage); return; }

    const paraNodes = el.currentPage.querySelectorAll('p.novel-para');
    if (state.ttsParaOffset >= paraNodes.length) { ttsAdvancePage(); return; }
    const text = (paraNodes[state.ttsParaOffset].textContent || '').trim();
    if (!text) { state.ttsParaOffset++; speakCurrentParagraph(); return; }
    clearTtsHighlight();
    paraNodes[state.ttsParaOffset].classList.add('tts-reading-active');
    state.ttsStatus = 'playing';
    updateTtsUi();
    speakText(text, () => { state.ttsParaOffset++; speakCurrentParagraph(); });
  }

  // ---- Unified TTS controls ----
  function ttsOpenCapsule() {
    el.audioCapsule.classList.remove('hidden');
    el.scrollContent.classList.add('tts-open');
  }

  function ttsStartFromCurrentPage() {
    ttsOpenCapsule();
    if (audiobook.available) {
      if (state.mode === 'scroll') {
        const { chapterId, paraIndex } = scrollAnchorParagraph();
        abPlay(chapterId, paraIndex);
        return;
      }
      const page = state.pages[state.currentPageIndex];
      if (!page || page.type === 'cover') { turnToPage(1, 'forward', () => abPlay(1, -1)); state.ttsStatus = 'playing'; updateTtsUi(); return; }
      if (page.type === 'chapter') { abPlay(page.chapterId, -1); return; }
      if (page.type === 'credits') { ttsFinish(); return; }
      abPlay(page.chapterId, page.startParaIndex);
      return;
    }
    state.ttsStatus = 'playing';
    state.ttsParaOffset = 0;
    speakCurrentParagraph();
  }

  function ttsPause() {
    state.ttsStatus = 'paused';
    if (audiobook.available) audiobook.audio.pause();
    else if (synth && synth.speaking) synth.pause();
    updateTtsUi();
  }

  function ttsResume() {
    state.ttsStatus = 'playing';
    if (audiobook.available) {
      const a = audiobook.audio;
      try { a.currentTime = Math.max(0, a.currentTime - 0.8); } catch (e) {} // back up a little so nothing is lost on resume
      a.play().catch(() => {});
      if (!audiobook.ticking) { audiobook.ticking = true; requestAnimationFrame(abTick); }
    } else if (synth && synth.paused) {
      synth.resume();
    } else {
      speakCurrentParagraph();
    }
    updateTtsUi();
  }

  function ttsTogglePlay() {
    if (state.ttsStatus === 'playing') ttsPause();
    else if (state.ttsStatus === 'paused') ttsResume();
    else ttsStartFromCurrentPage();
  }

  // Silence without changing status (used while a manual page turn is in flight)
  function ttsHold() {
    if (audiobook.available) audiobook.audio.pause();
    else cancelSpeechInternal();
  }

  function ttsResumeOnCurrentPage() {
    if (state.ttsStatus !== 'playing') return;
    if (audiobook.available) {
      const page = state.pages[state.currentPageIndex];
      if (!page || page.type === 'cover') { abPlay(1, -1); return; }
      if (page.type === 'chapter') { abPlay(page.chapterId, -1); return; }
      if (page.type === 'credits') { ttsFinish(); return; }
      abPlay(page.chapterId, page.startParaIndex);
    } else {
      state.ttsParaOffset = 0;
      speakCurrentParagraph();
    }
  }

  function ttsStop() {
    state.ttsStatus = 'stopped';
    if (audiobook.available) { audiobook.audio.pause(); audiobook.paraIndex = -1; }
    cancelSpeechInternal();
    state.ttsParaOffset = 0;
    clearTtsHighlight();
    updateTtsUi();
  }

  function ttsFinish() {
    ttsStop();
    el.ttsStatusText.textContent = '완독 완료';
  }

  function ttsClose() {
    ttsStop();
    el.audioCapsule.classList.add('hidden');
    el.scrollContent.classList.remove('tts-open');
  }

  function ttsSetRate(rate) {
    state.ttsRate = rate;
    if (audiobook.available) audiobook.audio.playbackRate = rate;
    else if (state.ttsStatus === 'playing') speakCurrentParagraph();
    updateTtsUi();
  }

  function cycleTtsSpeed() {
    const speeds = [0.9, 1.0, 1.1, 1.25];
    const idx = speeds.findIndex((s) => Math.abs(s - state.ttsRate) < 0.03);
    ttsSetRate(speeds[(idx + 1) % speeds.length]);
  }

  // Tap-to-read: paragraph `offset` on the current flip page
  function ttsFromPageParagraph(offset) {
    if (state.isFlipping) return;
    const page = state.pages[state.currentPageIndex];
    if (!page || page.type !== 'content') return;
    ttsOpenCapsule();
    if (audiobook.available) { abPlay(page.chapterId, page.startParaIndex + offset); return; }
    cancelSpeechInternal();
    state.ttsParaOffset = Math.max(0, offset);
    state.ttsStatus = 'playing';
    speakCurrentParagraph();
  }

  function paragraphUnderPointer(e) {
    if (el.audioCapsule.classList.contains('hidden')) return null;
    if (typeof e.clientX !== 'number') return null;
    const page = state.pages[state.currentPageIndex];
    if (!page || page.type !== 'content') return null;
    const stack = document.elementsFromPoint(e.clientX, e.clientY) || [];
    return stack.find((n) => n.matches && n.matches('#currentPage p.novel-para')) || null;
  }

  function updateTtsUi() {
    const isPlaying = state.ttsStatus === 'playing';
    const isPaused = state.ttsStatus === 'paused';
    el.btnOpenTts.classList.toggle('active', isPlaying || isPaused);
    el.ttsWaveDot.classList.toggle('speaking', isPlaying);
    el.orb.classList.toggle('playing', isPlaying);
    el.ttsPlayIcon.textContent = isPlaying ? '⏸' : '▶';
    el.btnTtsSpeed.textContent = state.ttsRate.toFixed(1) + 'x';

    let chapLabel = '';
    if (audiobook.available && audiobook.chapterId) {
      const c = chapterById(audiobook.chapterId);
      chapLabel = c ? c.number : '';
    } else {
      const page = state.pages[state.currentPageIndex];
      chapLabel = (page && page.chapterNumber) || '';
    }
    const voiceTag = audiobook.available ? (state.ttsVoice === 'f' ? ' · 여성' : ' · 남성') : '';
    if (isPlaying) el.ttsStatusText.textContent = `${chapLabel} 낭독 중${voiceTag}`;
    else if (isPaused) el.ttsStatusText.textContent = `일시정지 · ${chapLabel}`;
    else el.ttsStatusText.textContent = '문단을 탭하면 그곳부터 읽어요';
  }

  // =========================================================================
  // 8. Starfield
  // =========================================================================
  function initStarfield() {
    const canvas = el.starCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let stars = [];
    let shoot = null;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const count = Math.floor((canvas.width * canvas.height) / 13000);
      stars = Array.from({ length: Math.min(110, Math.max(30, count)) }, () => ({
        x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.35, phase: Math.random() * Math.PI * 2, speed: Math.random() * 0.016 + 0.004
      }));
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      if (state.theme === 'starlight') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const s of stars) {
          s.phase += s.speed;
          const alpha = 0.22 + 0.55 * Math.sin(s.phase);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(216, 181, 106, ${Math.max(0.06, alpha)})`;
          ctx.fill();
        }
        if (!shoot && Math.random() < 0.0014) {
          shoot = { x: canvas.width * (0.3 + Math.random() * 0.65), y: canvas.height * Math.random() * 0.4, vx: -4.2, vy: 2.6, life: 1, len: 110 };
        }
        if (shoot) {
          const tx = shoot.x + shoot.len * 0.85, ty = shoot.y - shoot.len * 0.53;
          const grad = ctx.createLinearGradient(shoot.x, shoot.y, tx, ty);
          grad.addColorStop(0, `rgba(242, 220, 163, ${0.9 * shoot.life})`);
          grad.addColorStop(1, 'rgba(242, 220, 163, 0)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(shoot.x, shoot.y); ctx.lineTo(tx, ty); ctx.stroke();
          shoot.x += shoot.vx; shoot.y += shoot.vy; shoot.life -= 0.018;
          if (shoot.life <= 0) shoot = null;
        }
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }

  // =========================================================================
  // 9. Events
  // =========================================================================
  function closeOverlays() {
    el.tocDrawer.classList.add('hidden');
    el.settingsPanel.classList.add('hidden');
    el.drawerBackdrop.classList.add('hidden');
  }

  function checkSavedProgressToast() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !saved.chapterId) return;
      const targetPage = findPageForParagraph(saved.chapterId, saved.paraIndex || 0);
      const target = state.pages[targetPage];
      if (target && target.type === 'content' && target.pageNo > 1) {
        el.resumeToastMsg.textContent = `${saved.chapterTitle} · ${target.pageNo}쪽부터`;
        el.resumeToast.classList.remove('hidden');
        el.btnResumeYes.onclick = () => { el.resumeToast.classList.add('hidden'); turnToPage(targetPage, 'forward'); };
        el.btnResumeClose.onclick = () => el.resumeToast.classList.add('hidden');
        setTimeout(() => el.resumeToast.classList.add('hidden'), 8000);
      }
    } catch (e) {}
  }

  function preservePositionAndRepaginate() {
    const cur = state.pages[state.currentPageIndex];
    const type = cur ? cur.type : 'cover';
    const chapId = cur ? cur.chapterId : 0;
    const paraIdx = cur ? cur.startParaIndex : 0;
    paginateNovel();
    renderTocList();
    renderBookmarkList();
    if (type === 'cover') state.currentPageIndex = 0;
    else if (type === 'chapter') state.currentPageIndex = state.chapterStartPages[chapId] || 1;
    else state.currentPageIndex = findPageForParagraph(chapId, paraIdx);
    renderCurrentPage();
    buildConstellation();
    updateIndicators();
  }

  function bindEvents() {
    // Page zones — while the audiobook capsule is open, tapping a paragraph reads from there
    const zoneClick = (fallback) => (e) => {
      // The zone overlay sits above the page, so cover/credits buttons underneath get the tap forwarded
      const btn = (document.elementsFromPoint(e.clientX, e.clientY) || []).find((n) => n.matches && n.matches('#currentPage [data-action], #currentPage a[href]'));
      if (btn) { btn.click(); return; }
      const para = paragraphUnderPointer(e);
      if (para) {
        ttsFromPageParagraph(Array.from(el.currentPage.querySelectorAll('p.novel-para')).indexOf(para));
        return;
      }
      fallback();
    };
    el.zonePrev.addEventListener('click', zoneClick(prevPage));
    el.zoneNext.addEventListener('click', zoneClick(nextPage));
    el.zoneCenter.addEventListener('click', zoneClick(toggleDeck));

    // Scroll mode: paragraphs are directly tappable while the capsule is open
    el.scrollContent.addEventListener('click', (e) => {
      const p = e.target.closest('.scroll-chapter-block p');
      if (!p) { if (!e.target.closest('button, a')) toggleDeck(); return; }
      if (el.audioCapsule.classList.contains('hidden')) { toggleDeck(); return; }
      const sec = p.closest('.scroll-chapter-block');
      const idx = Array.from(sec.querySelectorAll('p')).indexOf(p);
      if (audiobook.available) abPlay(Number(sec.getAttribute('data-chapter-id')), idx);
    });

    // Swipe
    let tx = 0, ty = 0;
    el.bookViewport.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; } }, { passive: true });
    el.bookViewport.addEventListener('touchend', (e) => {
      if (e.changedTouches.length !== 1) return;
      const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) { if (dx < 0) nextPage(); else prevPage(); }
    }, { passive: true });

    // Orb & deck
    el.orb.addEventListener('click', toggleDeck);
    el.deck.addEventListener('pointerdown', armDeckAutoHide);
    bindScrubber();

    // Scroll sync → orb ring, deck labels, thumb
    let scrollRaf = 0;
    el.scrollViewport.addEventListener('scroll', () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; updateIndicators(); });
    }, { passive: true });

    // Keyboard
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeOverlays(); hideDeck(); return; }
      if (state.mode !== 'flip') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); nextPage(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prevPage(); }
    });

    // TOC drawer
    el.btnOpenToc.addEventListener('click', () => {
      renderTocList(); renderBookmarkList(); updateIndicators();
      hideDeck();
      el.settingsPanel.classList.add('hidden');
      el.tocDrawer.classList.remove('hidden');
      el.drawerBackdrop.classList.remove('hidden');
    });
    el.btnCloseToc.addEventListener('click', closeOverlays);
    el.drawerBackdrop.addEventListener('click', closeOverlays);
    el.tabBtnToc.addEventListener('click', () => {
      el.tabBtnToc.classList.add('active'); el.tabBtnBookmarks.classList.remove('active');
      el.tabPanelToc.classList.remove('hidden'); el.tabPanelBookmarks.classList.add('hidden');
    });
    el.tabBtnBookmarks.addEventListener('click', () => {
      el.tabBtnBookmarks.classList.add('active'); el.tabBtnToc.classList.remove('active');
      el.tabPanelBookmarks.classList.remove('hidden'); el.tabPanelToc.classList.add('hidden');
    });

    el.btnBookmarkPage.addEventListener('click', () => { toggleCurrentPageBookmark(); armDeckAutoHide(); });

    // Settings
    el.btnOpenSettings.addEventListener('click', () => {
      hideDeck();
      el.tocDrawer.classList.add('hidden');
      el.settingsPanel.classList.remove('hidden');
      el.drawerBackdrop.classList.remove('hidden');
    });
    el.btnCloseSettings.addEventListener('click', closeOverlays);

    if (el.seasonToggle) {
      el.seasonToggle.addEventListener('click', () => {
        state.seasonFx = !state.seasonFx;
        applyVisualSettings();
        saveSettings();
      });
    }

    document.querySelectorAll('[data-theme-select]').forEach((btn) => btn.addEventListener('click', () => {
      state.theme = btn.getAttribute('data-theme-select'); applyVisualSettings(); saveSettings();
    }));
    document.querySelectorAll('[data-font-select]').forEach((btn) => btn.addEventListener('click', () => {
      state.fontKey = btn.getAttribute('data-font-select'); applyVisualSettings(); saveSettings();
      if (state.mode === 'flip') preservePositionAndRepaginate(); else buildConstellation();
    }));
    const stepSetting = (apply) => () => {
      apply(); applyVisualSettings(); saveSettings();
      if (state.mode === 'flip') preservePositionAndRepaginate(); else { buildConstellation(); updateIndicators(); }
    };
    el.btnFontDec.addEventListener('click', stepSetting(() => { if (state.fontSize > 14) state.fontSize -= 1; }));
    el.btnFontInc.addEventListener('click', stepSetting(() => { if (state.fontSize < 26) state.fontSize += 1; }));
    el.btnLineDec.addEventListener('click', stepSetting(() => { if (state.lineHeight > 1.55) state.lineHeight = Number((state.lineHeight - 0.1).toFixed(2)); }));
    el.btnLineInc.addEventListener('click', stepSetting(() => { if (state.lineHeight < 2.35) state.lineHeight = Number((state.lineHeight + 0.1).toFixed(2)); }));

    // Mode toggle
    el.btnToggleMode.addEventListener('click', () => {
      state.mode = state.mode === 'flip' ? 'scroll' : 'flip';
      saveSettings();
      updateModeView();
      armDeckAutoHide();
    });

    // Audiobook
    el.btnOpenTts.addEventListener('click', () => {
      hideDeck();
      if (el.audioCapsule.classList.contains('hidden')) ttsStartFromCurrentPage();
      else ttsTogglePlay();
    });
    el.btnTtsPlayPause.addEventListener('click', ttsTogglePlay);
    el.btnTtsStop.addEventListener('click', ttsStop);
    el.btnTtsSpeed.addEventListener('click', cycleTtsSpeed);
    el.btnTtsClose.addEventListener('click', ttsClose);
    document.querySelectorAll('[data-voice-select]').forEach((btn) => btn.addEventListener('click', () => setTtsVoice(btn.getAttribute('data-voice-select'))));

    window.addEventListener('beforeunload', () => { cancelSpeechInternal(); });

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.mode === 'flip') preservePositionAndRepaginate(); else { buildConstellation(); updateIndicators(); }
      }, 220);
    });
  }

  // =========================================================================
  // 10. Init
  // =========================================================================
  function init() {
    loadSavedSettings();
    if (window.SeasonFX && el.seasonCanvas) window.SeasonFX.init(el.seasonCanvas, document.getElementById('bookStage'));
    applyVisualSettings();
    el.modeIcon.innerHTML = MODE_ICONS.flip;
    initStarfield();
    paginateNovel();
    renderTocList();
    renderBookmarkList();
    renderCurrentPage();
    buildConstellation();
    if (state.mode === 'scroll') updateModeView();
    updateIndicators();
    bindEvents();
    initAudiobook();
    checkSavedProgressToast();

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { if (state.mode === 'flip') preservePositionAndRepaginate(); });
    }
  }

  // Debug/test handle (read-only use)
  window.__reader = { state, audiobook };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
