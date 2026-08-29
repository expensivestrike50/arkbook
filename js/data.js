/* ArkBook — shared data layer, auth, and storage
   Everything here is client side. Accounts, notes, prayers, bookmarks and
   channels are kept in this browser using localStorage and IndexedDB.
   Each signed in account only ever reads and writes keys namespaced with
   its own user id, so switching accounts in the same browser never shows
   one person's notes to another. */

(function(){

  const LS = window.localStorage;

  function uid(prefix){
    return (prefix || "id") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,9);
  }

  function escapeHtml(str){
    return String(str == null ? "" : str).replace(/[&<>"']/g, function(c){
      return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c];
    });
  }

  function fmtDate(d){
    const date = (d instanceof Date) ? d : new Date(d);
    return date.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" });
  }

  function readJSON(key, fallback){
    try{
      const raw = LS.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){
      return fallback;
    }
  }
  function writeJSON(key, value){
    LS.setItem(key, JSON.stringify(value));
  }

  /* ---------------- Password hashing (SHA-256, client side) ----------------
     This is a client only demo. Real production deployment needs a server
     that hashes and verifies passwords, never a browser alone. */
  async function hashPassword(password, salt){
    const enc = new TextEncoder();
    const data = enc.encode(salt + ":" + password);
    if(window.crypto && window.crypto.subtle){
      const buf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
    }
    // fallback simple hash if subtle crypto is unavailable
    let h = 0;
    const str = salt + ":" + password;
    for(let i=0;i<str.length;i++){ h = (Math.imul(31,h) + str.charCodeAt(i)) | 0; }
    return "fallback_" + Math.abs(h).toString(16);
  }

  /* ---------------------------- Auth ---------------------------- */
  const Auth = {
    USERS_KEY: "bb_users",
    SESSION_KEY: "bb_session",

    getUsers(){ return readJSON(this.USERS_KEY, []); },
    saveUsers(list){ writeJSON(this.USERS_KEY, list); },

    findByEmail(email){
      const e = String(email||"").trim().toLowerCase();
      return this.getUsers().find(u => u.email === e);
    },

    async signup({ name, email, password }){
      name = String(name||"").trim();
      email = String(email||"").trim().toLowerCase();
      password = String(password||"");

      if(!name) return { ok:false, error:"Please enter your name." };
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok:false, error:"Please enter a valid email." };
      if(password.length < 6) return { ok:false, error:"Password must be at least 6 characters." };
      if(this.findByEmail(email)) return { ok:false, error:"An account with this email already exists." };

      const id = uid("user");
      const salt = uid("salt");
      const passHash = await hashPassword(password, salt);
      const user = { id, name, email, salt, passHash, createdAt: Date.now() };

      const users = this.getUsers();
      users.push(user);
      this.saveUsers(users);
      this.setSession(id);
      return { ok:true, user };
    },

    async login({ email, password }){
      email = String(email||"").trim().toLowerCase();
      password = String(password||"");
      const user = this.findByEmail(email);
      if(!user) return { ok:false, error:"No account found with that email." };
      const hash = await hashPassword(password, user.salt);
      if(hash !== user.passHash) return { ok:false, error:"Incorrect password." };
      this.setSession(user.id);
      return { ok:true, user };
    },

    setSession(userId){ writeJSON(this.SESSION_KEY, { userId, at: Date.now() }); },
    logout(){ LS.removeItem(this.SESSION_KEY); },

    getCurrentUser(){
      const s = readJSON(this.SESSION_KEY, null);
      if(!s) return null;
      const user = this.getUsers().find(u => u.id === s.userId);
      return user || null;
    },

    isLoggedIn(){ return !!this.getCurrentUser(); },

    requireAuth(){
      if(!this.isLoggedIn()){
        const next = encodeURIComponent(location.pathname.split("/").pop());
        location.href = "signin.html?next=" + next;
        return null;
      }
      return this.getCurrentUser();
    },

    redirectIfLoggedIn(dest){
      if(this.isLoggedIn()) location.href = dest || "home.html";
    }
  };

  /* ------------------------ Per user data store ------------------------ */
  const Store = {
    key(name){
      const user = Auth.getCurrentUser();
      const scope = user ? user.id : "guest";
      return "bb_u_" + scope + "_" + name;
    },
    get(name, fallback){ return readJSON(this.key(name), fallback); },
    set(name, value){ writeJSON(this.key(name), value); },

    getNotes(){ return this.get("notes", []); },
    addNote(note){
      const notes = this.getNotes();
      notes.unshift(Object.assign({ id: uid("note"), createdAt: Date.now() }, note));
      this.set("notes", notes);
      return notes;
    },
    removeNote(id){
      this.set("notes", this.getNotes().filter(n => n.id !== id));
    },

    getPrayers(){ return this.get("prayers", []); },
    addPrayer(p){
      const prayers = this.getPrayers();
      prayers.unshift(Object.assign({ id: uid("prayer"), createdAt: Date.now(), answered:false }, p));
      this.set("prayers", prayers);
      return prayers;
    },
    togglePrayerAnswered(id){
      const prayers = this.getPrayers().map(p => p.id === id ? Object.assign({}, p, { answered: !p.answered }) : p);
      this.set("prayers", prayers);
    },
    removePrayer(id){
      this.set("prayers", this.getPrayers().filter(p => p.id !== id));
    },

    getBookmarks(){ return this.get("bookmarks", []); },
    isBookmarked(refOrId){
      return this.getBookmarks().some(b => b.ref === refOrId);
    },
    toggleBookmark(bookmark){
      const list = this.getBookmarks();
      const idx = list.findIndex(b => b.ref === bookmark.ref);
      if(idx >= 0){ list.splice(idx,1); }
      else { list.unshift(Object.assign({ id: uid("bm"), createdAt: Date.now() }, bookmark)); }
      this.set("bookmarks", list);
      return list;
    },
    removeBookmark(id){
      this.set("bookmarks", this.getBookmarks().filter(b => b.id !== id));
    },

    getDownloads(){ return this.get("downloads", []); },
    toggleDownload(episodeId){
      const list = this.getDownloads();
      const idx = list.indexOf(episodeId);
      if(idx >= 0) list.splice(idx,1); else list.unshift(episodeId);
      this.set("downloads", list);
      return list;
    },

    getStreak(){
      return this.get("streak", { days: 12, log: {} });
    },
    setStreak(v){ this.set("streak", v); }
  };

  /* --------------------------- Static content --------------------------- */

  const EPISODES = [
    { id:"ep1", title:"Don’t Be Discouraged Because You’re Not There Yet", verse:"Philippians 3:13–14", duration:"3:21", seconds:201, date:"2025-05-29", topic:"process", img:"sprout", desc:"You are not behind. You are exactly where the process has you, and the process is not finished.", audioUrl:"assets/audio/dont-be-discouraged-not-there-yet.mp3" },
    { id:"ep13", title:"Don’t Become What Hurt You", verse:"Romans 12:21", duration:"2:50", seconds:170, date:"2025-05-16", topic:"forgiveness", img:"cross", desc:"What happened to you should teach you, not turn you into someone you were never meant to become.", audioUrl:"assets/audio/dont-become-what-hurt-you.mp3" },
    { id:"ep2", title:"When God Makes You Wait", verse:"Psalm 27:14", duration:"2:11", seconds:131, date:"2025-05-27", topic:"waiting", img:"sprout", desc:"Waiting is not wasted time. It is where God builds what a rushed answer never could." },
    { id:"ep3", title:"Guard Your Heart", verse:"Proverbs 4:23", duration:"1:58", seconds:118, date:"2025-05-26", topic:"trust", img:"heart", desc:"Everything you do flows from your heart. Protecting it is not selfish, it is wise." },
    { id:"ep4", title:"Forgiveness Doesn’t Mean Access", verse:"Ephesians 4:31–32", duration:"2:07", seconds:127, date:"2025-05-25", topic:"forgiveness", img:"door", desc:"You can release someone from bitterness without reopening a door that hurt you." },
    { id:"ep5", title:"When God Feels Silent", verse:"Habakkuk 2:3", duration:"2:18", seconds:138, date:"2025-05-24", topic:"waiting", img:"mountain", desc:"Silence is not absence. The vision is still coming, even when it tarries." },
    { id:"ep6", title:"Trust The Process", verse:"Proverbs 3:5–6", duration:"2:45", seconds:165, date:"2025-05-23", topic:"trust", img:"sprout", desc:"Leaning on your own understanding will only take you so far. Trust carries you further." },
    { id:"ep7", title:"Anchored In Hope", verse:"Hebrews 11:1", duration:"3:02", seconds:182, date:"2025-05-22", topic:"growth", img:"mountain", desc:"Faith is not blind. It is the substance of what you are already sure of." },
    { id:"ep8", title:"He Restores", verse:"Psalm 147:3", duration:"2:20", seconds:140, date:"2025-05-21", topic:"healing", img:"heart", desc:"He does not just notice the broken hearted. He binds up every wound." },
    { id:"ep9", title:"Promise Keeper", verse:"Jeremiah 29:11", duration:"2:50", seconds:170, date:"2025-05-20", topic:"promises", img:"cross", desc:"Every plan He has for you leans toward hope, never toward harm." },
    { id:"ep10", title:"Slow To Heal Is Not Unhealed", verse:"Psalm 34:18", duration:"2:32", seconds:152, date:"2025-05-19", topic:"healing", img:"heart", desc:"He stays close to the broken hearted. Healing on His timeline is still healing." },
    { id:"ep11", title:"Rooted Before Fruitful", verse:"Colossians 2:6–7", duration:"2:41", seconds:161, date:"2025-05-18", topic:"growth", img:"sprout", desc:"Nothing grows tall before it grows deep. Let the roots take their time." },
    { id:"ep12", title:"He Does Not Forget", verse:"Deuteronomy 31:6", duration:"2:15", seconds:135, date:"2025-05-17", topic:"promises", img:"mountain", desc:"He goes before you and stays beside you. That has not changed." }
  ];

  const VERSES = {
    "Romans 12:17–21": { ref:"Romans 12:17–21", text:"Recompense to no man evil for evil. Provide things honest in the sight of all men. If it be possible, as much as lieth in you, live peaceably with all men. Dearly beloved, avenge not yourselves, but rather give place unto wrath: for it is written, Vengeance is mine; I will repay, saith the Lord. Therefore if thine enemy hunger, feed him; if he thirst, give him drink: for in so doing thou shalt heap coals of fire on his head. Be not overcome of evil, but overcome evil with good." },
    "Romans 12:21": { ref:"Romans 12:21", text:"Be not overcome of evil, but overcome evil with good." },
    "Genesis 50:19–21": { ref:"Genesis 50:19–21", text:"But Joseph said unto them, Fear not: for am I in the place of God? But as for you, ye thought evil against me; but God meant it unto good, to bring to pass, as it is this day, to save much people alive. Now therefore fear ye not: I will nourish you, and your little ones. And he comforted them, and spake kindly unto them." },
    "1 Samuel 24:6": { ref:"1 Samuel 24:6", text:"And he said unto his men, The LORD forbid that I should do this thing unto my master, the LORD's anointed, to stretch forth mine hand against him, seeing he is the anointed of the LORD." },
    "Hebrews 12:14–15": { ref:"Hebrews 12:14–15", text:"Follow peace with all men, and holiness, without which no man shall see the Lord: Looking diligently lest any man fail of the grace of God; lest any root of bitterness springing up trouble you, and thereby many be defiled." },
    "Ephesians 4:31–32": { ref:"Ephesians 4:31–32", text:"Let all bitterness, and wrath, and anger, and clamour, and evil speaking, be put away from you, with all malice: And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ's sake hath forgiven you." },
    "Proverbs 4:23": { ref:"Proverbs 4:23", text:"Keep thy heart with all diligence; for out of it are the issues of life." },

    "Psalm 147:3": { ref:"Psalm 147:3", text:"He healeth the broken in heart, and bindeth up their wounds." },
    "Jeremiah 17:14": { ref:"Jeremiah 17:14", text:"Heal me, O LORD, and I shall be healed; save me, and I shall be saved: for thou art my praise." },
    "Isaiah 53:5": { ref:"Isaiah 53:5", text:"But he was wounded for our transgressions, he was bruised for our iniquities: the chastisement of our peace was upon him; and with his stripes we are healed." },
    "Psalm 34:18": { ref:"Psalm 34:18", text:"The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit." },
    "James 5:16": { ref:"James 5:16", text:"Confess your faults one to another, and pray one for another, that ye may be healed. The effectual fervent prayer of a righteous man availeth much." },
    "Exodus 15:26": { ref:"Exodus 15:26", text:"And said, If thou wilt diligently hearken to the voice of the LORD thy God, and wilt do that which is right in his sight, and wilt give ear to his commandments, and keep all his statutes, I will put none of these diseases upon thee, which I have brought upon the Egyptians: for I am the LORD that healeth thee." },

    "Proverbs 3:5–6": { ref:"Proverbs 3:5–6", text:"Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths." },
    "Ecclesiastes 4:9–10": { ref:"Ecclesiastes 4:9–10", text:"Two are better than one; because they have a good reward for their labour. For if they fall, the one will lift up his fellow: but woe to him that is alone when he falleth; for he hath not another to help him up." },
    "Proverbs 27:17": { ref:"Proverbs 27:17", text:"Iron sharpeneth iron; so a man sharpeneth the countenance of his friend." },
    "1 Corinthians 13:4–7": { ref:"1 Corinthians 13:4–7", text:"Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up, doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil, rejoiceth not in iniquity but rejoiceth in the truth, beareth all things, believeth all things, hopeth all things, endureth all things." },
    "Romans 12:10": { ref:"Romans 12:10", text:"Be kindly affectioned one to another with brotherly love; in honour preferring one another." },
    "Psalm 118:8": { ref:"Psalm 118:8", text:"It is better to trust in the LORD than to put confidence in man." },

    "Hebrews 11:1": { ref:"Hebrews 11:1", text:"Now faith is the substance of things hoped for, the evidence of things not seen." },
    "2 Peter 3:18": { ref:"2 Peter 3:18", text:"But grow in grace, and in the knowledge of our Lord and Saviour Jesus Christ. To him be glory both now and for ever. Amen." },
    "Philippians 1:6": { ref:"Philippians 1:6", text:"Being confident of this very thing, that he which hath begun a good work in you will perform it until the day of Jesus Christ." },
    "James 1:2–4": { ref:"James 1:2–4", text:"My brethren, count it all joy when ye fall into divers temptations, knowing this, that the trying of your faith worketh patience. But let patience have her perfect work, that ye may be perfect and entire, wanting nothing." },
    "Romans 10:17": { ref:"Romans 10:17", text:"So then faith cometh by hearing, and hearing by the word of God." },
    "Colossians 2:6–7": { ref:"Colossians 2:6–7", text:"As ye have therefore received Christ Jesus the Lord, so walk ye in him, rooted and built up in him, and stablished in the faith, as ye have been taught, abounding therein with thanksgiving." },

    "Isaiah 40:31": { ref:"Isaiah 40:31", text:"But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint." },
    "Psalm 27:14": { ref:"Psalm 27:14", text:"Wait on the LORD: be of good courage, and he shall strengthen thine heart: wait, I say, on the LORD." },
    "Lamentations 3:25–26": { ref:"Lamentations 3:25–26", text:"The LORD is good unto them that wait for him, to the soul that seeketh him. It is good that a man should both hope and quietly wait for the salvation of the LORD." },
    "Psalm 37:7": { ref:"Psalm 37:7", text:"Rest in the LORD, and wait patiently for him: fret not thyself because of him who prospereth in his way, because of the man who bringeth wicked devices to pass." },
    "Micah 7:7": { ref:"Micah 7:7", text:"Therefore I will look unto the LORD; I will wait for the God of my salvation: my God will hear me." },
    "Habakkuk 2:3": { ref:"Habakkuk 2:3", text:"For the vision is yet for an appointed time, but at the end it shall speak, and not lie: though it tarry, wait for it; because it will surely come, it will not tarry." },

    "Jeremiah 29:11": { ref:"Jeremiah 29:11", text:"For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end." },
    "Romans 8:28": { ref:"Romans 8:28", text:"And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
    "Joshua 1:9": { ref:"Joshua 1:9", text:"Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest." },
    "Deuteronomy 31:6": { ref:"Deuteronomy 31:6", text:"Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee." },
    "2 Corinthians 1:20": { ref:"2 Corinthians 1:20", text:"For all the promises of God in him are yea, and in him Amen, unto the glory of God by us." },
    "Philippians 4:19": { ref:"Philippians 4:19", text:"But my God shall supply all your need according to his riches in glory by Christ Jesus." },

    "2 Timothy 1:7": { ref:"2 Timothy 1:7", text:"For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind." },
    "1 Corinthians 16:13": { ref:"1 Corinthians 16:13", text:"Watch ye, stand fast in the faith, quit you like men, be strong." },
    "Psalm 27:1": { ref:"Psalm 27:1", text:"The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?" },
    "Joshua 1:6": { ref:"Joshua 1:6", text:"Be strong and of a good courage: for unto this people shalt thou divide for an inheritance the land, which I sware unto their fathers to give them." },
    "Psalm 31:24": { ref:"Psalm 31:24", text:"Be of good courage, and he shall strengthen your heart, all ye that hope in the LORD." },

    "1 Thessalonians 5:18": { ref:"1 Thessalonians 5:18", text:"In every thing give thanks: for this is the will of God in Christ Jesus concerning you." },
    "Psalm 100:4": { ref:"Psalm 100:4", text:"Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name." },
    "Colossians 3:17": { ref:"Colossians 3:17", text:"And whatsoever ye do in word or deed, do all in the name of the Lord Jesus, giving thanks to God and the Father by him." },
    "Psalm 107:1": { ref:"Psalm 107:1", text:"O give thanks unto the LORD, for he is good: for his mercy endureth for ever." },
    "Ephesians 5:20": { ref:"Ephesians 5:20", text:"Giving thanks always for all things unto God and the Father in the name of our Lord Jesus Christ." },

    "Philippians 3:13–14": { ref:"Philippians 3:13–14", text:"Brethren, I count not myself to have apprehended: but this one thing I do, forgetting those things which are behind, and reaching forth unto those things which are before, I press toward the mark for the prize of the high calling of God in Christ Jesus." },
    "Philippians 3:12–14": { ref:"Philippians 3:12–14", text:"Not as though I had already attained, either were already perfect: but I follow after, if that I may apprehend that for which also I am apprehended of Christ Jesus. Brethren, I count not myself to have apprehended: but this one thing I do, forgetting those things which are behind, and reaching forth unto those things which are before, I press toward the mark for the prize of the high calling of God in Christ Jesus." },
    "Zechariah 4:10": { ref:"Zechariah 4:10", text:"For who hath despised the day of small things? for they shall rejoice, and shall see the plummet in the hand of Zerubbabel with those seven; they are the eyes of the LORD, which run to and fro through the whole earth." },
    "Mark 4:26–29": { ref:"Mark 4:26–29", text:"And he said, So is the kingdom of God, as if a man should cast seed into the ground; And should sleep, and rise night and day, and the seed should spring and grow up, he knoweth not how. For the earth bringeth forth fruit of herself; first the blade, then the ear, after that the full corn in the ear. But when the fruit is brought forth, immediately he putteth in the sickle, because the harvest is come." },
    "Proverbs 4:18": { ref:"Proverbs 4:18", text:"But the path of the just is as the shining light, that shineth more and more unto the perfect day." },
    "2 Corinthians 3:18": { ref:"2 Corinthians 3:18", text:"But we all, with open face beholding as in a glass the glory of the Lord, are changed into the same image from glory to glory, even as by the Spirit of the Lord." },
    "Galatians 6:9": { ref:"Galatians 6:9", text:"And let us not be weary in well doing: for in due season we shall reap, if we faint not." }
  };

  const TOPICS = [
    { id:"forgiveness", name:"Forgiveness", icon:"heart", color:"", img:"cross", count:7,
      desc:"Letting go of what wounded you, without pretending it did not happen.",
      verses:["Romans 12:17–21","Romans 12:21","Genesis 50:19–21","1 Samuel 24:6","Hebrews 12:14–15","Ephesians 4:31–32","Proverbs 4:23"] },
    { id:"healing", name:"Healing", icon:"heart-pulse", color:"teal", img:"heart", count:6,
      desc:"The slow, honest work of being mended, not rushed.",
      verses:["Psalm 147:3","Jeremiah 17:14","Isaiah 53:5","Psalm 34:18","James 5:16","Exodus 15:26"] },
    { id:"trust", name:"Trust & Relationships", icon:"heart", color:"red", img:"door", count:6,
      desc:"Leaning on people and on God when your own strength runs out.",
      verses:["Proverbs 3:5–6","Ecclesiastes 4:9–10","Proverbs 27:17","1 Corinthians 13:4–7","Romans 12:10","Psalm 118:8"] },
    { id:"growth", name:"Faith & Growth", icon:"church", color:"", img:"sprout", count:6,
      desc:"Believing before you can see it, and growing anyway.",
      verses:["Hebrews 11:1","2 Peter 3:18","Philippians 1:6","James 1:2–4","Romans 10:17","Colossians 2:6–7"] },
    { id:"waiting", name:"Waiting on God", icon:"timer-reset", color:"teal", img:"mountain", count:6,
      desc:"Standing still when everything in you wants to move first.",
      verses:["Isaiah 40:31","Psalm 27:14","Lamentations 3:25–26","Psalm 37:7","Micah 7:7","Habakkuk 2:3"] },
    { id:"promises", name:"God’s Promises", icon:"hand-heart", color:"orange", img:"cross", count:6,
      desc:"What He said He would do, long before you asked.",
      verses:["Jeremiah 29:11","Romans 8:28","Joshua 1:9","Deuteronomy 31:6","2 Corinthians 1:20","Philippians 4:19"] },
    { id:"courage", name:"Courage", icon:"shield", color:"", img:"mountain", count:5,
      desc:"Doing the right thing while your knees are still shaking.",
      verses:["2 Timothy 1:7","1 Corinthians 16:13","Psalm 27:1","Joshua 1:6","Psalm 31:24"] },
    { id:"gratitude", name:"Gratitude", icon:"sparkles", color:"", img:"heart", count:5,
      desc:"Naming what is good out loud, especially on the hard days.",
      verses:["1 Thessalonians 5:18","Psalm 100:4","Colossians 3:17","Psalm 107:1","Ephesians 5:20"] },
    { id:"process", name:"Pressing Forward", icon:"trending-up", color:"teal", img:"sprout", count:6,
      desc:"You are not behind. Growth that lasts is never instant.",
      verses:["Philippians 3:12–14","Zechariah 4:10","Mark 4:26–29","Proverbs 4:18","2 Corinthians 3:18","Galatians 6:9"] }
  ];

  /* ---------------------------- User networks -------------------------------
     Anyone signed in can start their own network (a custom topic) and add
     verse nodes to it, or add extra nodes onto a built in topic's network.
     Built in topics and their original nodes stay read only, the same way
     the built in episodes do; only nodes a person added themselves, or a
     whole network they created, can be edited or removed by them. */
  const UserNetworks = {
    KEY: "bb_user_networks",
    getAll(){ return readJSON(this.KEY, []); },
    saveAll(list){ writeJSON(this.KEY, list); },
    create({ name, desc, img }){
      const user = Auth.requireAuth();
      if(!user) return null;
      const net = {
        id: uid("net"), name: String(name||"Untitled network").trim(),
        desc: String(desc||"").trim(), img: img || "cross",
        ownerId: user.id, ownerName: user.name, custom:true, createdAt: Date.now()
      };
      const all = this.getAll();
      all.unshift(net);
      this.saveAll(all);
      return net;
    },
    update(id, patch){
      const all = this.getAll();
      const idx = all.findIndex(n => n.id === id);
      if(idx < 0) return;
      all[idx] = Object.assign({}, all[idx], patch);
      this.saveAll(all);
    },
    remove(id){
      this.saveAll(this.getAll().filter(n => n.id !== id));
      UserNodes.saveAll(UserNodes.getAll().filter(n => n.topicId !== id));
    },
    canEdit(net){
      const user = Auth.getCurrentUser();
      return !!(net && net.ownerId && user && net.ownerId === user.id);
    }
  };

  const UserNodes = {
    KEY: "bb_user_nodes",
    getAll(){ return readJSON(this.KEY, []); },
    saveAll(list){ writeJSON(this.KEY, list); },
    forTopic(topicId){ return this.getAll().filter(n => n.topicId === topicId); },
    add({ topicId, ref, text }){
      const user = Auth.requireAuth();
      if(!user) return null;
      const node = {
        id: uid("node"), topicId, ref: String(ref||"").trim(), text: String(text||"").trim(),
        ownerId: user.id, ownerName: user.name, createdAt: Date.now()
      };
      const all = this.getAll();
      all.unshift(node);
      this.saveAll(all);
      return node;
    },
    update(id, patch){
      const all = this.getAll();
      const idx = all.findIndex(n => n.id === id);
      if(idx < 0) return;
      all[idx] = Object.assign({}, all[idx], patch);
      this.saveAll(all);
    },
    remove(id){
      this.saveAll(this.getAll().filter(n => n.id !== id));
    },
    canEdit(node){
      const user = Auth.getCurrentUser();
      return !!(node && node.ownerId && user && node.ownerId === user.id);
    }
  };

  function getAllTopics(){
    const custom = UserNetworks.getAll().map(n => ({
      id:n.id, name:n.name, icon:"git-branch", color:"", img:n.img, desc:n.desc,
      custom:true, ownerId:n.ownerId, ownerName:n.ownerName,
      verses: [],
      count: UserNodes.forTopic(n.id).length
    }));
    return TOPICS.concat(custom);
  }

  function getTopicVerseRefs(topic){
    const own = (topic && topic.verses) || [];
    const added = topic ? UserNodes.forTopic(topic.id).map(n => n.ref) : [];
    return own.concat(added);
  }

  function getTopic(id){ return getAllTopics().find(t => t.id === id); }
  function getVerse(ref){
    if(VERSES[ref]) return VERSES[ref];
    const node = UserNodes.getAll().find(n => n.ref === ref);
    if(node) return { ref: node.ref, text: node.text, userNode:true, id: node.id, ownerId: node.ownerId };
    return { ref, text:"Text not available yet." };
  }

  /* ------------------------------ Scripture graph --------------------------
     Renders an Obsidian style node graph: a topic at the center, its verses
     as labeled dots around it, plus small unlabeled dots and extra threads
     for visual texture. Positions are deterministic per topic (seeded on
     the verse reference) so the layout does not reshuffle on every render. */
  function seededRand(seed){
    let h = 0;
    for(let i=0;i<seed.length;i++){ h = (Math.imul(31,h) + seed.charCodeAt(i)) | 0; }
    const x = Math.sin(h) * 10000;
    return x - Math.floor(x);
  }

  function renderGraph(container, topic, opts){
    opts = opts || {};
    const compact = !!opts.compact;
    const cx = 50, cy = 50;
    const rx = opts.rx || 40, ry = opts.ry || 37;
    const refs = getTopicVerseRefs(topic);
    const n = Math.max(refs.length, 1);

    const real = refs.map((ref, i) => {
      const baseAngle = -90 + i * (360/n);
      const jitterA = (seededRand(ref+"a") - 0.5) * (360/n) * 0.4;
      const angle = (baseAngle + jitterA) * Math.PI/180;
      const rJitter = 0.8 + seededRand(ref+"r") * 0.38;
      const size = 7 + seededRand(ref+"s") * 4;
      return {
        ref,
        l: Math.max(13, Math.min(87, cx + Math.cos(angle) * rx * rJitter)),
        t: Math.max(7, Math.min(93, cy + Math.sin(angle) * ry * rJitter)),
        size
      };
    });

    function line(x1,y1,x2,y2,deco){
      return '<line class="'+(deco?"deco":"")+'" x1="'+x1.toFixed(2)+'" y1="'+y1.toFixed(2)+'" x2="'+x2.toFixed(2)+'" y2="'+y2.toFixed(2)+'"/>';
    }

    let lines = "";
    real.forEach(p => { lines += line(cx, cy, p.l, p.t, false); });

    if(!compact){
      real.forEach((p,i) => {
        const q = real[(i+1) % real.length];
        if(seededRand(p.ref+"link") > 0.45) lines += line(p.l, p.t, q.l, q.t, true);
      });
    }

    let nodes = "";
    const decoCount = real.length ? (compact ? 5 : 13) : 0;
    for(let i=0;i<decoCount;i++){
      const seed = topic.id + "deco" + i;
      const ang = seededRand(seed+"ang") * 360 * Math.PI/180;
      const rad = 0.45 + seededRand(seed+"rad") * 1.0;
      const l = Math.max(2, Math.min(98, cx + Math.cos(ang) * rx * rad));
      const t = Math.max(4, Math.min(96, cy + Math.sin(ang) * ry * rad));
      const target = real[i % real.length];
      lines += line(l, t, target.l, target.t, true);
      const accent = seededRand(seed+"acc") > 0.72;
      nodes += '<div class="gnode deco'+(accent?" accent":"")+'" style="left:'+l.toFixed(2)+'%;top:'+t.toFixed(2)+'%"><span class="dot"></span></div>';
    }

    real.forEach(p => {
      const side = p.l >= cx ? "right" : "left";
      nodes += '<div class="gnode '+side+'" data-ref="'+escapeHtml(p.ref)+'" style="left:'+p.l.toFixed(2)+'%;top:'+p.t.toFixed(2)+'%">' +
        '<span class="dot" style="width:'+p.size.toFixed(1)+'px;height:'+p.size.toFixed(1)+'px"></span>' +
        '<span class="label">'+escapeHtml(p.ref)+'</span>' +
      '</div>';
    });

    nodes += '<div class="gnode center" style="left:'+cx+'%;top:'+cy+'%"><span class="dot"></span><span class="label">'+escapeHtml(topic.name)+'</span></div>';

    container.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">'+lines+'</svg>' + nodes;
    container.querySelectorAll(".gnode[data-ref]").forEach(el => {
      el.addEventListener("click", () => window.openVerseModal(el.dataset.ref));
    });
    if(window.lucide) lucide.createIcons();
  }

  /* ------------------------------ Channels ------------------------------
     Public channels are visible to everyone using this browser. Private
     channels are only visible and editable by the account that created
     them. Audio files are kept as Blobs in IndexedDB, referenced by id. */
  const Channels = {
    KEY: "bb_channels",

    _seed(){
      if(LS.getItem(this.KEY) !== null) return;
      const seed = [
        {
          id: uid("ch"), name:"Morning Prayers", description:"A quiet place for short spoken prayers to start the day. Add your own or listen along.",
          visibility:"public", ownerId:"system", ownerName:"ArkBook Team",
          links:[{ label:"Prayer guide", url:"https://example.com/prayer-guide" }],
          episodes: [], createdAt: Date.now() - 86400000*9
        },
        {
          id: uid("ch"), name:"Worship Instrumentals", description:"Gentle instrumental worship for reading, journaling or quiet reflection.",
          visibility:"public", ownerId:"system", ownerName:"ArkBook Team",
          links:[], episodes: [], createdAt: Date.now() - 86400000*4
        }
      ];
      writeJSON(this.KEY, seed);
    },

    getAll(){ this._seed(); return readJSON(this.KEY, []); },
    saveAll(list){ writeJSON(this.KEY, list); },

    getVisible(){
      const user = Auth.getCurrentUser();
      return this.getAll().filter(c => c.visibility === "public" || (user && c.ownerId === user.id));
    },
    getPublic(){ return this.getAll().filter(c => c.visibility === "public"); },
    getMine(){
      const user = Auth.getCurrentUser();
      if(!user) return [];
      return this.getAll().filter(c => c.ownerId === user.id);
    },
    getById(id){ return this.getAll().find(c => c.id === id); },

    canView(channel){
      if(!channel) return false;
      if(channel.visibility === "public") return true;
      const user = Auth.getCurrentUser();
      return !!(user && channel.ownerId === user.id);
    },
    canEdit(channel){
      const user = Auth.getCurrentUser();
      return !!(channel && user && channel.ownerId === user.id);
    },

    create({ name, description, visibility, links }){
      const user = Auth.requireAuth();
      if(!user) return null;
      const channel = {
        id: uid("ch"), name: String(name||"").trim(), description: String(description||"").trim(),
        visibility: visibility === "private" ? "private" : "public",
        ownerId: user.id, ownerName: user.name,
        links: (links||[]).filter(l => l.url), episodes: [], createdAt: Date.now()
      };
      const all = this.getAll();
      all.unshift(channel);
      this.saveAll(all);
      return channel;
    },

    remove(id){
      this.saveAll(this.getAll().filter(c => c.id !== id));
    },

    async addEpisode(channelId, { title, description, file }){
      const all = this.getAll();
      const channel = all.find(c => c.id === channelId);
      if(!channel) return null;
      const audioId = uid("audio");
      await Audio.store(audioId, file);
      const episode = {
        id: uid("cep"), title: String(title||"Untitled episode").trim(),
        description: String(description||"").trim(),
        audioId, mimeType: file.type || "audio/mpeg", fileName: file.name || "",
        createdAt: Date.now()
      };
      channel.episodes = channel.episodes || [];
      channel.episodes.unshift(episode);
      this.saveAll(all);
      return episode;
    },

    removeEpisode(channelId, episodeId){
      const all = this.getAll();
      const channel = all.find(c => c.id === channelId);
      if(!channel) return;
      channel.episodes = (channel.episodes||[]).filter(e => e.id !== episodeId);
      this.saveAll(all);
    },

    search(query){
      const q = String(query||"").trim().toLowerCase();
      if(!q) return [];
      return this.getVisible().filter(c =>
        c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
      );
    }
  };

  /* ------------------------- Audio blob storage ------------------------- */
  const Audio = {
    DB: "bb_audio_db",
    _open(){
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(this.DB, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore("files"); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },
    async store(id, blob){
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").put(blob, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    },
    async get(id){
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("files", "readonly");
        const r = tx.objectStore("files").get(id);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
    },
    async remove(id){
      const db = await this._open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction("files", "readwrite");
        tx.objectStore("files").delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  };

  /* --------------------------- Uploaded episodes ---------------------------
     Anyone signed in can add a new episode to the show with a real audio
     file. Uploaded episodes are stored alongside the built in ones (shared
     across accounts in this browser) and play through the bottom player
     using the actual audio, not the demo waveform. */
  function getAudioDuration(file){
    return new Promise((resolve) => {
      try{
        const url = URL.createObjectURL(file);
        const probe = new window.Audio();
        const done = (seconds) => { URL.revokeObjectURL(url); resolve(seconds); };
        probe.addEventListener("loadedmetadata", () => done(probe.duration || 0));
        probe.addEventListener("error", () => done(0));
        setTimeout(() => done(0), 4000);
        probe.src = url;
      }catch(e){ resolve(0); }
    });
  }

  const UserEpisodes = {
    KEY: "bb_user_episodes",
    getAll(){ return readJSON(this.KEY, []); },
    saveAll(list){ writeJSON(this.KEY, list); },

    async create({ title, verse, topic, description, img, file }){
      const user = Auth.requireAuth();
      if(!user) return null;
      const audioId = uid("audio");
      await Audio.store(audioId, file);
      const seconds = Math.round(await getAudioDuration(file));
      const episode = {
        id: uid("uep"),
        title: String(title||"Untitled episode").trim(),
        verse: String(verse||"").trim(),
        topic: topic || TOPICS[0].id,
        desc: String(description||"").trim(),
        img: img || "cross",
        audioId, mimeType: file.type || "audio/mpeg",
        seconds, duration: seconds ? fmtTime(seconds) : "--:--",
        date: new Date().toISOString().slice(0,10),
        ownerId: user.id, uploadedBy: user.name,
        createdAt: Date.now()
      };
      const all = this.getAll();
      all.unshift(episode);
      this.saveAll(all);
      return episode;
    },

    remove(id){
      this.saveAll(this.getAll().filter(e => e.id !== id));
    },

    canEdit(episode){
      const user = Auth.getCurrentUser();
      return !!(episode && episode.ownerId && user && episode.ownerId === user.id);
    }
  };

  function fmtTime(seconds){
    const m = Math.floor(seconds/60).toString().padStart(2,"0");
    const s = Math.floor(seconds%60).toString().padStart(2,"0");
    return m + ":" + s;
  }

  function getAllEpisodes(){
    const uploaded = UserEpisodes.getAll().map(e => Object.assign({ uploaded:true }, e));
    return uploaded.concat(EPISODES).sort((a,b) => new Date(b.date) - new Date(a.date));
  }

  /* -------------------------------- Search -------------------------------- */
  function searchAll(query){
    const q = String(query||"").trim().toLowerCase();
    if(!q) return { episodes:[], verses:[], topics:[], channels:[] };

    const episodes = getAllEpisodes().filter(e =>
      e.title.toLowerCase().includes(q) || e.verse.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q)
    ).slice(0,5);

    const verses = Object.values(VERSES).filter(v =>
      v.ref.toLowerCase().includes(q) || v.text.toLowerCase().includes(q)
    ).slice(0,5);

    const topics = getAllTopics().filter(t => t.name.toLowerCase().includes(q)).slice(0,5);

    const channels = Channels.search(q).slice(0,5);

    return { episodes, verses, topics, channels };
  }

  window.BB = {
    uid, escapeHtml, fmtDate,
    Auth, Store, Channels, Audio, UserEpisodes, UserNetworks, UserNodes,
    EPISODES, VERSES, TOPICS, getTopic, getVerse, getAllEpisodes,
    getAllTopics, getTopicVerseRefs,
    searchAll, renderGraph
  };

})();
