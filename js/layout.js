/* ArkBook — shared page chrome: sidebar, topbar, bottom player, modals,
   global search and toast helper. Include data.js before this file. */

(function(){
  const B = window.BB;

  const NAV = [
    { key:"home", label:"Home", icon:"home", href:"home.html" },
    { key:"episodes", label:"Episodes", icon:"play-circle", href:"episodes.html" },
    { key:"library", label:"Bible Library", icon:"book-open", href:"library.html" },
    { key:"networks", label:"Networks", icon:"users", href:"networks.html", count:B.getAllTopics().length },
    { key:"topics", label:"Topics", icon:"brain-circuit", href:"topics.html" },
    { key:"channels", label:"Channels", icon:"radio", href:"channels.html" },
    { key:"bookmarks", label:"Bookmarks", icon:"bookmark", href:"bookmarks.html" },
    { key:"notes", label:"Notes", icon:"notebook-pen", href:"notes.html" },
    { key:"prayer", label:"Prayer Journal", icon:"heart-handshake", href:"prayer.html" },
    { key:"downloads", label:"Downloads", icon:"download", href:"downloads.html" }
  ];

  function initials(name){
    return String(name||"?").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
  }

  function sidebarHTML(activeKey, user){
    const navItems = NAV.map(item => (
      '<a class="nav-item' + (item.key===activeKey?" active":"") + '" href="' + item.href + '">' +
        '<i data-lucide="' + item.icon + '"></i><span>' + item.label + '</span>' +
        (item.count ? '<b class="count">' + item.count + '</b>' : "") +
      '</a>'
    )).join("");

    return (
      '<div class="brand" onclick="location.href=\'home.html\'">' +
        '<div class="brand-copy"><div class="brand-name"><span class="accent">Ark</span>Book</div></div>' +
      '</div>' +
      '<nav class="nav">' + navItems + '</nav>' +
      '<div class="profile" id="profileToggle">' +
        '<div class="avatar">' + initials(user.name) + '</div>' +
        '<div class="profile-text"><strong>' + B.escapeHtml(user.name) + '</strong></div>' +
        '<i class="chev" data-lucide="chevron-down"></i>' +
        '<div class="profile-menu" id="profileMenu">' +
          '<button id="signOutBtn"><i data-lucide="log-out"></i>Sign out</button>' +
        '</div>' +
      '</div>'
    );
  }

  function topbarHTML(){
    return (
      '<label class="search">' +
        '<i data-lucide="search"></i>' +
        '<input id="searchInput" autocomplete="off" placeholder="Search episodes, verses, topics, channels" />' +
        '<span class="kbd">&#8984; K</span>' +
        '<div class="search-results" id="searchResults"></div>' +
      '</label>' +
      '<div class="top-actions">' +
        '<button class="icon-btn" id="notifyBtn"><i data-lucide="bell"></i><span class="notify-dot"></span></button>' +
        '<div id="topActionSlot"></div>' +
      '</div>'
    );
  }

  function playerHTML(){
    return (
      '<div class="now-playing" id="nowPlayingOpen" style="cursor:pointer">' +
        '<div class="now-cover img-cross-sm" id="nowCover"></div>' +
        '<div class="now-text"><strong id="nowTitle">Don’t Become What Hurt You</strong><span id="nowVerse">Romans 12:21</span></div>' +
      '</div>' +
      '<div class="player-center">' +
        '<button class="small-skip" data-skip="-15"><i data-lucide="rotate-ccw"></i><small>15</small></button>' +
        '<button class="round-play play-toggle"><i data-lucide="play"></i></button>' +
        '<button class="small-skip" data-skip="15"><i data-lucide="rotate-cw"></i><small>15</small></button>' +
        '<div class="progress-zone">' +
          '<span class="time time-current">00:00</span>' +
          '<div class="track progress-track"><div class="track-fill"></div></div>' +
          '<span class="time time-duration">02:03</span>' +
        '</div>' +
      '</div>' +
      '<div class="player-right">' +
        '<i data-lucide="volume-2"></i>' +
        '<button class="fs-open-btn" id="fsOpenBtn" title="Full screen player"><i data-lucide="maximize-2"></i></button>' +
        '<button class="fs-open-btn" id="playerHideBtn" title="Hide player"><i data-lucide="chevron-down"></i></button>' +
      '</div>' +
      '<audio id="bbAudio" preload="metadata" style="display:none"></audio>'
    );
  }

  function playerTabHTML(){
    return '<button class="player-tab" id="playerShowBtn" title="Show player"><i data-lucide="chevron-up"></i></button>';
  }

  function fsPlayerHTML(){
    return (
      '<div class="fs-player" id="fsPlayer">' +
        '<button class="fs-close" id="fsCloseBtn"><i data-lucide="chevron-down"></i></button>' +
        '<div class="fs-inner">' +
          '<div class="fs-art img-cross" id="fsArt"></div>' +
          '<div class="fs-wave" id="fsWave"></div>' +
          '<div class="fs-meta"><h2 id="fsTitle">Don’t Become What Hurt You</h2><p id="fsVerse">Romans 12:21</p></div>' +
          '<div class="fs-progress">' +
            '<span class="time time-current">00:00</span>' +
            '<div class="track progress-track"><div class="track-fill"></div></div>' +
            '<span class="time time-duration">02:03</span>' +
          '</div>' +
          '<div class="fs-controls">' +
            '<button class="small-skip" data-skip="-15"><i data-lucide="rotate-ccw"></i><small>15</small></button>' +
            '<button class="play-lg play-toggle"><i data-lucide="play"></i></button>' +
            '<button class="small-skip" data-skip="15"><i data-lucide="rotate-cw"></i><small>15</small></button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function modalsHTML(){
    return (
      '<div class="modal" id="noteModal">' +
        '<div class="modal-box">' +
          '<div class="modal-head"><h2 id="noteModalTitle">New Note</h2><button class="close-btn" data-close="noteModal"><i data-lucide="x"></i></button></div>' +
          '<div class="form-grid">' +
            '<div class="field full"><label>Title</label><input id="noteTitle" placeholder="What is on your heart?" /></div>' +
            '<div class="field full"><label>Scripture</label><input id="noteScripture" placeholder="Romans 12:21" /></div>' +
            '<div class="field full"><label id="noteBodyLabel">Reflection</label><textarea id="noteBody" placeholder="Write here"></textarea></div>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button class="ghost-btn" data-close="noteModal">Cancel</button>' +
            '<button class="primary-btn" id="saveNoteBtn"><i data-lucide="check"></i><span>Save</span></button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="modal" id="verseModal">' +
        '<div class="modal-box">' +
          '<div class="modal-head"><h2>Scripture</h2><button class="close-btn" data-close="verseModal"><i data-lucide="x"></i></button></div>' +
          '<div class="verse-modal-ref" id="verseModalRef">Reference</div>' +
          '<div class="verse-modal-text" id="verseModalText">Verse text</div>' +
          '<div class="verse-modal-actions">' +
            '<button class="ghost-btn" id="verseBookmarkBtn"><i data-lucide="bookmark"></i><span>Bookmark</span></button>' +
            '<button class="ghost-btn" id="verseCopyBtn"><i data-lucide="copy"></i><span>Copy</span></button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="modal" id="confirmModal">' +
        '<div class="modal-box" style="width:min(380px,calc(100vw - 30px))">' +
          '<div class="modal-head"><h2 id="confirmTitle">Are you sure?</h2></div>' +
          '<p id="confirmMsg" style="font-size:12px;line-height:1.6;color:#c6c2cc;margin:0 0 20px"></p>' +
          '<div class="form-actions">' +
            '<button class="ghost-btn" id="confirmCancelBtn">Cancel</button>' +
            '<button class="primary-btn danger-btn" id="confirmOkBtn"><i data-lucide="trash-2"></i><span id="confirmOkLabel">Delete</span></button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="toast" id="toast"><i data-lucide="check-circle"></i><span id="toastMsg"></span></div>'
    );
  }

  function fmtTime(seconds){
    const m = Math.floor(seconds/60).toString().padStart(2,"0");
    const s = Math.floor(seconds%60).toString().padStart(2,"0");
    return m + ":" + s;
  }

  function showToast(msg, icon){
    const toast = document.getElementById("toast");
    if(!toast) return;
    toast.querySelector("#toastMsg").textContent = msg;
    const i = toast.querySelector("i");
    if(i) i.setAttribute("data-lucide", icon || "check-circle");
    toast.classList.add("show");
    if(window.lucide) lucide.createIcons();
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=> toast.classList.remove("show"), 2600);
  }

  /* ------------------------------ Search UI ------------------------------ */
  function wireSearch(){
    const input = document.getElementById("searchInput");
    const results = document.getElementById("searchResults");
    if(!input || !results) return;

    function iconFor(kind){
      return kind==="episode" ? "play-circle" : kind==="verse" ? "book-open" : kind==="topic" ? "brain-circuit" : "radio";
    }

    function render(query){
      const r = B.searchAll(query);
      const groups = [
        { label:"Episodes", kind:"episode", items:r.episodes.map(e=>({title:e.title, sub:e.verse, action:()=>location.href="episodes.html?open="+e.id})) },
        { label:"Verses", kind:"verse", items:r.verses.map(v=>({title:v.ref, sub:v.text.slice(0,54)+(v.text.length>54?"…":""), action:()=>{ closeResults(); window.openVerseModal(v.ref); }})) },
        { label:"Topics", kind:"topic", items:r.topics.map(t=>({title:t.name, sub:t.count+" connected verses", action:()=>location.href="networks.html?topic="+t.id})) },
        { label:"Channels", kind:"channel", items:r.channels.map(c=>({title:c.name, sub:(c.visibility==="public"?"Public channel":"Private channel"), action:()=>location.href="channel.html?id="+c.id})) }
      ].filter(g => g.items.length);

      if(!query.trim()){
        results.classList.remove("open");
        results.innerHTML = "";
        return;
      }

      if(!groups.length){
        results.innerHTML = '<div class="sr-empty">No results for "' + B.escapeHtml(query) + '"</div>';
        results.classList.add("open");
        return;
      }

      results.innerHTML = groups.map(g =>
        '<div class="sr-group"><div class="sr-label">' + g.label + '</div>' +
        g.items.map((it, idx) =>
          '<div class="sr-item" data-g="' + g.kind + '" data-i="' + idx + '">' +
            '<div class="sr-icon"><i data-lucide="' + iconFor(g.kind) + '"></i></div>' +
            '<div class="sr-text"><strong>' + B.escapeHtml(it.title) + '</strong><span>' + B.escapeHtml(it.sub||"") + '</span></div>' +
          '</div>'
        ).join("") + '</div>'
      ).join("");
      results.classList.add("open");
      if(window.lucide) lucide.createIcons();

      results.querySelectorAll(".sr-item").forEach(el => {
        const g = groups.find(x => x.kind === el.dataset.g);
        const item = g.items[+el.dataset.i];
        el.addEventListener("click", item.action);
      });
    }

    function closeResults(){ results.classList.remove("open"); results.innerHTML=""; }

    input.addEventListener("input", () => render(input.value));
    input.addEventListener("focus", () => { if(input.value.trim()) render(input.value); });
    document.addEventListener("click", (e) => {
      if(!e.target.closest(".search")) closeResults();
    });
    window.addEventListener("keydown", (e) => {
      if((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==="k"){ e.preventDefault(); input.focus(); }
      if(e.key==="Escape") closeResults();
    });
  }

  /* ------------------------------ Bottom player ---------------------------
     Two modes: "demo" simulates progress with a timer for the built in
     episodes that have no real audio file. "real" plays an actual audio
     file (shipped with the site, or uploaded) through the hidden <audio>
     element. Every control that carries the shared classes below — in the
     bottom bar and in the full screen view — stays in sync automatically,
     since they all read from and act on this one piece of state. */
  const iconClass = { cross:"img-cross", sprout:"img-sprout", heart:"img-heart", door:"img-door", mountain:"img-mountain" };

  /* Playback survives navigation between pages (a fresh page load, since
     this is a static multi-page app with no client-side router) by saving
     which episode is playing, at what position, to localStorage on every
     play/pause/seek, and resuming it — in whichever player is present on
     the page that loads next, usually the bottom taskbar bar — as soon as
     the new page's player wires up. */
  const NOW_PLAYING_KEY = "bb_now_playing";
  function clearPersistedPlayback(){
    try{ localStorage.removeItem(NOW_PLAYING_KEY); }catch(e){}
  }
  window.BB_clearPersistedPlayback = clearPersistedPlayback;

  function wirePlayer(){
    const state = { playing:false, progress:32, duration:123, mode:"demo", epId:null };
    let timer = null;
    const audioEl = document.getElementById("bbAudio");
    if(!audioEl) return;

    let lastPersist = 0;
    function persistPlayback(force){
      if(!state.epId) return;
      const now = Date.now();
      if(!force && now - lastPersist < 1000) return;
      lastPersist = now;
      try{
        localStorage.setItem(NOW_PLAYING_KEY, JSON.stringify(
          state.mode === "real"
            ? { epId:state.epId, mode:"real", currentTime:audioEl.currentTime||0, playing:!audioEl.paused && !audioEl.ended }
            : { epId:state.epId, mode:"demo", currentTime:state.progress, playing:state.playing }
        ));
      }catch(e){}
    }
    window.BB_currentEpisodeId = function(){ return state.epId; };

    function fillsAndTimes(){
      return {
        fills: document.querySelectorAll(".track-fill"),
        curs: document.querySelectorAll(".time-current"),
        durs: document.querySelectorAll(".time-duration")
      };
    }

    function paintWave(pct, isPlaying){
      const wave = document.getElementById("wave");
      if(wave){
        wave.classList.toggle("playing", isPlaying);
        const bars = wave.querySelectorAll(".bar");
        const playedCount = Math.round(bars.length * pct/100);
        bars.forEach((b,i) => b.classList.toggle("played", i < playedCount));
      }
      const fsWave = document.getElementById("fsWave");
      if(fsWave) fsWave.classList.toggle("playing", isPlaying);
    }

    function paint(pct, curSeconds, durSeconds, isPlaying){
      const { fills, curs, durs } = fillsAndTimes();
      fills.forEach(el => el.style.width = pct + "%");
      curs.forEach(el => el.textContent = fmtTime(curSeconds));
      durs.forEach(el => el.textContent = fmtTime(durSeconds));
      document.querySelectorAll(".play-toggle").forEach(btn => {
        btn.innerHTML = '<i data-lucide="' + (isPlaying ? "pause" : "play") + '"></i>';
      });
      if(window.lucide) lucide.createIcons();
      paintWave(pct, isPlaying);
    }

    function updateDemo(){
      const pct = Math.min(100, state.progress/state.duration*100);
      paint(pct, state.progress, state.duration, state.playing);
    }

    function updateReal(){
      const d = audioEl.duration || 0;
      const pct = d ? (audioEl.currentTime/d*100) : 0;
      paint(pct, audioEl.currentTime || 0, d, !audioEl.paused);
    }

    function seekTo(frac){
      if(state.mode === "real"){
        if(audioEl.duration) audioEl.currentTime = Math.max(0, Math.min(1,frac)) * audioEl.duration;
        updateReal();
      } else {
        state.progress = Math.round(Math.max(0, Math.min(1,frac)) * state.duration);
        updateDemo();
      }
      persistPlayback(true);
    }

    function skip(seconds){
      if(state.mode === "real"){
        audioEl.currentTime = Math.max(0, Math.min(audioEl.duration||0, audioEl.currentTime+seconds));
        updateReal();
      } else {
        state.progress = Math.max(0, Math.min(state.duration, state.progress+seconds));
        updateDemo();
      }
      persistPlayback(true);
    }

    window.togglePlay = function(){
      if(state.mode === "real"){
        if(audioEl.paused) audioEl.play().catch(()=>{}); else audioEl.pause();
        return;
      }
      state.playing = !state.playing;
      clearInterval(timer);
      if(state.playing){
        timer = setInterval(()=>{
          state.progress += 1;
          if(state.progress >= state.duration){ state.progress = 0; state.playing = false; clearInterval(timer); clearPersistedPlayback(); }
          updateDemo();
          persistPlayback();
        },1000);
      }
      updateDemo();
      persistPlayback(true);
    };

    document.querySelectorAll(".play-toggle").forEach(btn => btn.addEventListener("click", window.togglePlay));
    document.querySelectorAll("[data-skip]").forEach(btn => btn.addEventListener("click", () => skip(+btn.dataset.skip)));
    document.querySelectorAll(".progress-track").forEach(track => track.addEventListener("click", (e) => {
      const rect = track.getBoundingClientRect();
      seekTo((e.clientX-rect.left)/rect.width);
    }));

    ["timeupdate","play","pause","loadedmetadata"].forEach(ev => {
      audioEl.addEventListener(ev, () => {
        if(state.mode !== "real") return;
        updateReal();
        persistPlayback(ev === "play" || ev === "pause");
      });
    });
    audioEl.addEventListener("ended", () => { if(state.mode === "real") clearPersistedPlayback(); });

    /* epId: the episode's id, used to persist and resume playback across
       page navigations (see NOW_PLAYING_KEY above) — null for callers that
       don't need that (there are none left, but it stays optional).
       seconds: play the built in simulated demo track.
       audioSrc: play a real audio file (a static URL or an uploaded blob
       object URL). autoplay defaults to true; pass false to just load and
       show the right duration without starting playback. img is one of
       the theme keys (cross, sprout, heart, door, mountain).
       startAt: seconds/progress to resume from instead of starting at 0. */
    window.setNowPlaying = function(epId, title, verse, seconds, audioSrc, autoplay, img, startAt){
      state.epId = epId || null;
      ["nowTitle","fsTitle"].forEach(id => { const el=document.getElementById(id); if(el) el.textContent = title; });
      ["nowVerse","fsVerse"].forEach(id => { const el=document.getElementById(id); if(el) el.textContent = verse; });
      const bigCls = iconClass[img] || "img-cross";
      const smallCls = img === "cross" ? "img-cross-sm" : bigCls;
      const cover = document.getElementById("nowCover");
      if(cover) cover.className = "now-cover " + smallCls;
      const art = document.getElementById("fsArt");
      if(art) art.className = "fs-art " + bigCls;

      clearInterval(timer);
      audioEl.pause();

      if(audioSrc){
        state.mode = "real";
        audioEl.src = audioSrc;
        audioEl.currentTime = startAt || 0;
        if(autoplay !== false) audioEl.play().catch(()=>{});
        updateReal();
      } else {
        state.mode = "demo";
        audioEl.removeAttribute("src");
        state.duration = seconds || 123;
        state.progress = startAt || 0;
        state.playing = false;
        updateDemo();
      }
    };

    updateDemo();

    /* Resume whatever was playing on the previous page, if anything. */
    (function resume(){
      let saved;
      try{ saved = JSON.parse(localStorage.getItem(NOW_PLAYING_KEY) || "null"); }catch(e){ saved = null; }
      if(!saved || !saved.epId) return;
      const ep = B.getAllEpisodes().find(e => e.id === saved.epId);
      if(!ep) { clearPersistedPlayback(); return; }
      window.playEpisode(ep, false).then(() => {
        if(state.mode === "real"){
          audioEl.currentTime = saved.currentTime || 0;
          if(saved.playing) audioEl.play().catch(()=>{});
        } else {
          state.progress = saved.currentTime || 0;
          updateDemo();
          if(saved.playing) window.togglePlay();
        }
      });
    })();
  }

  /* Plays any episode object in the bottom player: a shipped static audio
     file if it has one, a real uploaded file if it has one, otherwise the
     built in demo simulation. Pass autoplay:false to preload without
     starting playback (used to prime the home page hero on load). */
  window.playEpisode = async function(ep, autoplay){
    if(ep.audioUrl){
      window.setNowPlaying(ep.id, ep.title, ep.verse, null, ep.audioUrl, autoplay, ep.img);
    } else if(ep.audioId){
      const blob = await B.Audio.get(ep.audioId);
      if(!blob){ showToast("Audio not found in this browser", "alert-circle"); return; }
      const url = URL.createObjectURL(blob);
      window.setNowPlaying(ep.id, ep.title, ep.verse, null, url, autoplay, ep.img);
    } else {
      window.setNowPlaying(ep.id, ep.title, ep.verse, ep.seconds, null, true, ep.img);
    }
  };

  /* ------------------------------ Full screen view ------------------------- */
  function renderFsWaveBars(){
    const wave = document.getElementById("fsWave");
    if(!wave || wave.children.length) return;
    for(let i=0;i<56;i++){
      const b = document.createElement("span");
      const h = Math.round(18 + Math.abs(Math.sin(i*0.7)) * 60);
      b.className = "bar";
      b.style.height = h + "%";
      b.style.setProperty("--i", i);
      wave.appendChild(b);
    }
  }

  function wireFullscreen(){
    const fs = document.getElementById("fsPlayer");
    const openBtn = document.getElementById("fsOpenBtn");
    const nowPlaying = document.getElementById("nowPlayingOpen");
    const closeBtn = document.getElementById("fsCloseBtn");
    if(!fs || !openBtn) return;

    renderFsWaveBars();

    function open(){
      fs.classList.add("open");
      if(document.documentElement.requestFullscreen){
        document.documentElement.requestFullscreen().catch(()=>{});
      }
    }
    function close(){
      fs.classList.remove("open");
      if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
    }

    openBtn.addEventListener("click", open);
    if(nowPlaying) nowPlaying.addEventListener("click", open);
    closeBtn.addEventListener("click", close);
    document.addEventListener("fullscreenchange", () => {
      if(!document.fullscreenElement) fs.classList.remove("open");
    });
    window.addEventListener("keydown", (e) => { if(e.key === "Escape" && fs.classList.contains("open")) close(); });
  }

  /* Lets you tuck the bottom player out of the way, and bring it back with
     the small tab that stays pinned to the bottom edge while it is hidden. */
  function wirePlayerVisibility(){
    const bar = document.getElementById("playerMount");
    const hideBtn = document.getElementById("playerHideBtn");
    const showBtn = document.getElementById("playerShowBtn");
    const app = document.querySelector(".app");
    if(!bar || !hideBtn || !showBtn) return;

    hideBtn.addEventListener("click", () => {
      bar.classList.add("collapsed");
      showBtn.classList.add("show");
      if(app) app.classList.add("player-collapsed");
    });
    showBtn.addEventListener("click", () => {
      bar.classList.remove("collapsed");
      showBtn.classList.remove("show");
      if(app) app.classList.remove("player-collapsed");
    });
  }

  /* ------------------------------ Modals ---------------------------------- */
  function openModal(id){ document.getElementById(id).classList.add("open"); }
  function closeModal(id){ document.getElementById(id).classList.remove("open"); }
  window.openModal = openModal;
  window.closeModal = closeModal;

  function wireModals(){
    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });
    document.querySelectorAll(".modal").forEach(m => {
      m.addEventListener("click", (e) => { if(e.target === m) closeModal(m.id); });
    });
    window.addEventListener("keydown", (e) => {
      if(e.key === "Escape") document.querySelectorAll(".modal.open").forEach(m => closeModal(m.id));
    });

    /* In app replacement for window.confirm(), which blocks the whole page
       (and browser automation) while it is open. Usage:
       const ok = await window.confirmDialog("Delete this?"); if(!ok) return; */
    let confirmResolve = null;
    function settleConfirm(result){
      if(confirmResolve){ confirmResolve(result); confirmResolve = null; }
    }
    document.getElementById("confirmOkBtn").addEventListener("click", () => { closeModal("confirmModal"); settleConfirm(true); });
    window.confirmDialog = function(message, okLabel){
      document.getElementById("confirmMsg").textContent = message;
      document.getElementById("confirmOkLabel").textContent = okLabel || "Delete";
      openModal("confirmModal");
      return new Promise((resolve) => { confirmResolve = resolve; });
    };
    // any other way the confirm modal closes (Cancel, backdrop click,
    // Escape) resolves as "false" so an awaiting caller never hangs
    document.getElementById("confirmModal").addEventListener("click", (e) => {
      if(e.target.id === "confirmModal" || e.target.closest("#confirmCancelBtn")) settleConfirm(false);
    });
    window.addEventListener("keydown", (e) => {
      if(e.key === "Escape" && document.getElementById("confirmModal").classList.contains("open")) settleConfirm(false);
    });

    let noteMode = "note";
    window.openNoteModal = function(mode){
      noteMode = mode || "note";
      document.getElementById("noteModalTitle").textContent = noteMode === "prayer" ? "Write a Prayer" : "New Note";
      document.getElementById("noteBodyLabel").textContent = noteMode === "prayer" ? "Prayer" : "Reflection";
      document.getElementById("noteTitle").value = "";
      document.getElementById("noteScripture").value = "";
      document.getElementById("noteBody").value = "";
      openModal("noteModal");
    };

    document.getElementById("saveNoteBtn").addEventListener("click", () => {
      const title = document.getElementById("noteTitle").value.trim();
      const scripture = document.getElementById("noteScripture").value.trim();
      const body = document.getElementById("noteBody").value.trim();
      if(!title){ showToast("Please add a title", "alert-circle"); return; }

      if(noteMode === "prayer"){
        B.Store.addPrayer({ title, scripture, body });
        showToast("Prayer saved");
      } else {
        B.Store.addNote({ title, scripture, body });
        showToast("Note saved");
      }
      closeModal("noteModal");
      if(typeof window.onDataChanged === "function") window.onDataChanged();
    });

    let currentVerseRef = null;
    window.openVerseModal = function(ref){
      const v = B.getVerse(ref);
      currentVerseRef = v.ref;
      document.getElementById("verseModalRef").textContent = v.ref;
      document.getElementById("verseModalText").textContent = v.text;
      const btn = document.getElementById("verseBookmarkBtn");
      const bookmarked = B.Store.isBookmarked(v.ref);
      btn.classList.toggle("active", bookmarked);
      btn.querySelector("span").textContent = bookmarked ? "Bookmarked" : "Bookmark";
      openModal("verseModal");
    };

    document.getElementById("verseBookmarkBtn").addEventListener("click", () => {
      if(!currentVerseRef) return;
      const v = B.getVerse(currentVerseRef);
      B.Store.toggleBookmark({ type:"verse", ref:v.ref, title:v.ref, snippet:v.text.slice(0,80) });
      const bookmarked = B.Store.isBookmarked(v.ref);
      const btn = document.getElementById("verseBookmarkBtn");
      btn.classList.toggle("active", bookmarked);
      btn.querySelector("span").textContent = bookmarked ? "Bookmarked" : "Bookmark";
      showToast(bookmarked ? "Verse bookmarked" : "Removed bookmark");
    });

    document.getElementById("verseCopyBtn").addEventListener("click", () => {
      if(!currentVerseRef) return;
      const v = B.getVerse(currentVerseRef);
      const text = v.text + " — " + v.ref;
      if(navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{});
      showToast("Verse copied");
    });
  }

  /* -------------------------------- Init ----------------------------------- */
  const Layout = {
    init(activeKey, opts){
      opts = opts || {};
      const user = B.Auth.requireAuth();
      if(!user) return null;

      document.getElementById("sidebarMount").innerHTML = sidebarHTML(activeKey, user);
      document.getElementById("topbarMount").innerHTML = topbarHTML();
      document.getElementById("playerMount").innerHTML = playerHTML();
      document.body.insertAdjacentHTML("beforeend", fsPlayerHTML());
      document.body.insertAdjacentHTML("beforeend", playerTabHTML());
      document.body.insertAdjacentHTML("beforeend", modalsHTML());

      /* Home has its own full sized player in the hero, so the bottom bar
         (and its hide/show tab) would just be a redundant duplicate there. */
      if(opts.hidePlayer){
        document.getElementById("playerMount").style.display = "none";
        const app = document.querySelector(".app");
        if(app) app.classList.add("no-player");
      }

      const slot = document.getElementById("topActionSlot");
      if(opts.topAction === false){
        // no button
      } else if(opts.topAction){
        slot.innerHTML = '<button class="primary-btn" id="topActionBtn"><i data-lucide="' + opts.topAction.icon + '"></i><span>' + opts.topAction.label + '</span></button>';
        document.getElementById("topActionBtn").addEventListener("click", opts.topAction.onClick);
      } else {
        slot.innerHTML = '<button class="primary-btn" id="topActionBtn"><i data-lucide="plus"></i><span>New Note</span></button>';
        document.getElementById("topActionBtn").addEventListener("click", () => window.openNoteModal("note"));
      }

      document.getElementById("profileToggle").addEventListener("click", (e) => {
        document.getElementById("profileMenu").classList.toggle("open");
        e.stopPropagation();
      });
      document.addEventListener("click", () => document.getElementById("profileMenu").classList.remove("open"));
      document.getElementById("signOutBtn").addEventListener("click", () => {
        clearPersistedPlayback();
        B.Auth.logout();
        location.href = "index.html";
      });

      wireModals();
      wireSearch();
      wirePlayer();
      wireFullscreen();
      wirePlayerVisibility();

      if(window.lucide) lucide.createIcons();
      return user;
    },
    showToast, fmtTime
  };

  window.BBLayout = Layout;
})();
