/* PRIME VOCAL · single page interactions */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- theme toggle ---------- */
  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var root = document.documentElement;
      var toDark = root.getAttribute('data-theme') !== 'dark';
      if (toDark) { root.setAttribute('data-theme', 'dark'); }
      else { root.removeAttribute('data-theme'); }
      try { localStorage.setItem('pv-theme', toDark ? 'dark' : ''); } catch (e) {}
    });
  }

  /* ---------- year ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- nav hairline + shrink ---------- */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('stuck', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---------- staggered scroll reveal ----------
     Each .rv inside a section gets an incremental delay so blocks
     drift up one after another instead of snapping in together. */
  var rvs = document.querySelectorAll('.rv');
  document.querySelectorAll('section').forEach(function (sec) {
    sec.querySelectorAll('.rv').forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i * 90, 420) + 'ms';
    });
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    document.documentElement.classList.add('no-io');
  } else {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });
    rvs.forEach(function (el) { obs.observe(el); });
  }

  /* failsafe: anything already on screen reveals itself even if the
     observer is slow to fire, so the page can never sit blank */
  function inView(el, slack) {
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight * (slack || 1) && r.bottom > 0;
  }
  function revealVisible() {
    document.querySelectorAll('.rv:not(.in)').forEach(function (el) {
      if (inView(el, 0.95)) el.classList.add('in');
    });
  }
  window.addEventListener('load', revealVisible);
  setTimeout(revealVisible, 1400);

  /* Lara's avatar. Primary path is ./lara-avatar.png next to index.html; a few
     common alternates are tried so the file works whatever it gets saved as.
     If none resolve the <img> is dropped and the parent gets .avatar-missing,
     which restores the green disc and mark instead of a broken-image icon. */
  document.querySelectorAll('.chat-av img, .ph-avatar img').forEach(function (img) {
    var tries = [
      './lara-avatar.png', './lara-avatar.jpg', './lara-avatar.jpeg', './lara-avatar.webp',
      './assets/lara-avatar.png', './assets/lara.png'
    ];
    var i = 0;
    function fail() {
      i++;
      if (i < tries.length) { img.src = tries[i]; return; }
      if (img.parentElement) img.parentElement.classList.add('avatar-missing');
      img.remove();
    }
    img.addEventListener('error', fail);
    if (img.complete && img.naturalWidth === 0) fail();
  });

  /* ==========================================================
     SECTION 01 · James on the street
     One scroll driver for the whole beat: it pins the stage,
     publishes 0..1 progress to the Three.js module, switches the
     floating story text, and ticks the CCTV clock. The 3D layer
     is optional — everything here works without it.
     ========================================================== */
  var street = document.getElementById('problem');
  if (street) {
    var stage = street.querySelector('.street-stage');
    var beats = street.querySelectorAll('.beat');
    var recTime = document.getElementById('recTime');
    var hint = document.getElementById('streetHint');
    var BEATS = beats.length;                 /* 7 */
    var streetTicking = false;
    var autoPlaying = false;

    /* where each beat owns the screen, as a fraction of the scroll */
    var BEAT_AT = [0.00, 0.15, 0.42, 0.59, 0.68, 0.78, 0.90];

    function sizeStreet() {
      if (isCompact() || reduceMotion) { street.style.height = ''; return; }
      /* one screen to read each beat, plus a screen of run-off */
      street.style.height = Math.round(window.innerHeight * (BEATS * 0.85 + 1)) + 'px';
    }
    function isCompact() { return window.innerWidth <= 860; }

    function paint(p) {
      /* which beat is speaking */
      var idx = 0;
      for (var i = 0; i < BEAT_AT.length; i++) if (p >= BEAT_AT[i]) idx = i;
      beats.forEach(function (b, i) { b.classList.toggle('on', i === idx); });
      street.dataset.beat = String(idx + 1);

      /* CCTV clock ticks 9:00 PM → 9:14 PM across the story */
      if (recTime) {
        var mins = Math.floor(p * 14);
        recTime.textContent = '09:' + String(mins).padStart(2, '0') + ' PM';
      }
      if (hint) hint.style.opacity = p > 0.04 ? '0' : '';

      if (window.pvStreet && window.pvStreet.ready) window.pvStreet.update(p);
    }

    function onStreetScroll() {
      streetTicking = false;
      if (isCompact() || reduceMotion || autoPlaying) return;
      var travel = street.offsetHeight - window.innerHeight;
      if (travel <= 0) { paint(0); return; }
      var p = Math.min(Math.max(-street.getBoundingClientRect().top / travel, 0), 1);
      paint(p);
    }
    function requestStreet() {
      if (streetTicking) return;
      streetTicking = true;
      requestAnimationFrame(onStreetScroll);
    }

    /* small screens don't scroll-jack — the story auto-plays once over 10s */
    function autoPlay() {
      if (autoPlaying) return;
      autoPlaying = true;
      var t0 = null;
      (function step(ts) {
        if (t0 === null) t0 = ts;
        var p = Math.min((ts - t0) / 10000, 1);
        paint(p);
        if (p < 1) requestAnimationFrame(step);
      })();
    }

    sizeStreet();
    paint(0);
    window.addEventListener('scroll', requestStreet, { passive: true });
    /* iOS can withhold scroll events mid-drag, so drive off the touch too */
    window.addEventListener('touchmove', requestStreet, { passive: true });
    window.addEventListener('touchend', requestStreet, { passive: true });
    window.addEventListener('resize', function () { sizeStreet(); requestStreet(); });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { sizeStreet(); requestStreet(); }, 120);
    });

    if (reduceMotion) {
      paint(1);                                  /* land on the closing frame */
    } else if (isCompact() && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, o) {
        entries.forEach(function (e) { if (e.isIntersecting) { autoPlay(); o.disconnect(); } });
      }, { threshold: 0.35 }).observe(street);
    }
    window.addEventListener('load', function () {
      sizeStreet();
      if (isCompact() && !reduceMotion && inView(street, 0.9)) autoPlay();
      else requestStreet();
    });

    /* ---- 2D fallback ----------------------------------------------------
       Section 01 went blank on phones whenever the WebGL layer never came up:
       import maps are unsupported on older iOS Safari, the CDN can be blocked,
       and low-power mode refuses WebGL contexts. If nothing has registered
       itself shortly after load, draw the same story with a 2D context so the
       section is never an empty gradient. */
    var canvas = document.getElementById('streetCanvas');
    var fallback2D = null;

    function build2D() {
      if (!canvas || window.pvStreet) return;        /* 3D won — leave it alone */
      var ctx;
      try { ctx = canvas.getContext('2d'); } catch (e) { return; }
      if (!ctx) return;                              /* a GL context already owns it */

      var W = 1000, H = 570, prog = 0;

      function fit() {
        var r = canvas.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (r.width < 2 || r.height < 2) return;
        canvas.width = Math.round(r.width * dpr);
        canvas.height = Math.round(r.height * dpr);
      }

      function draw() {
        fit();
        if (!canvas.width) { requestAnimationFrame(draw); return; }
        var cw = canvas.width, ch = canvas.height;
        /* contain the 1000x570 stage inside the canvas */
        var s = Math.min(cw / W, ch / H) * 0.95;
        var ox = (cw - W * s) / 2, oy = (ch - H * s) / 2;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#0b140d';
        ctx.fillRect(0, 0, cw, ch);
        ctx.setTransform(s, 0, 0, s, ox, oy);

        var p = prog;
        var cream = 'rgba(242,239,230,';
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';

        /* ground */
        ctx.strokeStyle = cream + '.25)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(40, 400); ctx.lineTo(960, 400); ctx.stroke();

        /* three clinics */
        var B = [
          { x: 90,  w: 200, h: 165, name: 'BRIGHT SMILE', lit: false },
          { x: 400, w: 210, h: 185, name: 'CITY DENTAL',  lit: true  },
          { x: 715, w: 200, h: 210, name: 'PARKVIEW',     lit: true, pv: true }
        ];
        B.forEach(function (b, bi) {
          var top = 400 - b.h;
          var answered = b.pv && p > 0.66;
          ctx.strokeStyle = cream + (answered ? '.95)' : '.6)');
          ctx.lineWidth = 1.6;
          ctx.strokeRect(b.x, top, b.w, b.h);
          ctx.beginPath(); ctx.moveTo(b.x - 8, top); ctx.lineTo(b.x + b.w + 8, top); ctx.stroke();

          /* windows */
          for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
            var wx = b.x + 16 + c * (b.w - 32) / 3, wy = top + 20 + r * 52;
            var ww = (b.w - 32) / 3 - 12, wh = 36;
            ctx.fillStyle = b.lit ? (answered ? 'rgba(111,185,143,.22)' : cream + '.13)') : cream + '.03)';
            ctx.fillRect(wx, wy, ww, wh);
            ctx.strokeStyle = cream + '.35)'; ctx.lineWidth = 1;
            ctx.strokeRect(wx, wy, ww, wh);
          }
          /* door */
          ctx.strokeStyle = cream + '.4)';
          ctx.strokeRect(b.x + b.w / 2 - 22, 400 - 54, 44, 54);
          /* signage */
          ctx.fillStyle = answered ? 'rgba(140,230,185,.95)' : cream + '.5)';
          ctx.font = '600 13px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(b.name, b.x + b.w / 2, top - 12);

          if (bi === 0) {                              /* CLOSED plate */
            ctx.fillStyle = 'rgba(139,32,32,.35)';
            ctx.fillRect(b.x + b.w / 2 - 34, top + 128, 68, 22);
            ctx.fillStyle = '#F2EFE6';
            ctx.font = '600 11px "IBM Plex Mono", monospace';
            ctx.fillText('CLOSED', b.x + b.w / 2, top + 143);
          }
          if (b.pv && answered) {                      /* PRIME VOCAL badge */
            ctx.fillStyle = 'rgba(30,91,63,.95)';
            ctx.fillRect(b.x + b.w / 2 - 58, top - 52, 116, 26);
            ctx.fillStyle = '#EAFBF1';
            ctx.font = '600 12px "IBM Plex Mono", monospace';
            ctx.fillText('PRIME VOCAL', b.x + b.w / 2, top - 34);
          }
        });

        /* James walks left to right */
        var jx = p < 0.13 ? 150 : p < 0.30 ? 190 : p < 0.42 ? 190 + (p - 0.30) / 0.12 * 315
               : p < 0.57 ? 505 : p < 0.66 ? 505 + (p - 0.57) / 0.09 * 310 : 815;
        var bob = Math.abs(Math.sin(p * 60)) * 3;
        ctx.strokeStyle = cream + '.95)'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(jx, 452 - bob, 15, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(jx, 467 - bob); ctx.lineTo(jx, 508 - bob);
        ctx.moveTo(jx, 508 - bob); ctx.lineTo(jx - 14, 545);
        ctx.moveTo(jx, 508 - bob); ctx.lineTo(jx + 14, 545);
        ctx.moveTo(jx, 478 - bob); ctx.lineTo(jx - 18, 494 - bob);
        ctx.moveTo(jx, 476 - bob); ctx.lineTo(jx + 16, 462 - bob);
        ctx.stroke();
        ctx.fillStyle = '#0b140d';
        ctx.fillRect(jx + 13, 452 - bob, 10, 16);
        ctx.strokeStyle = 'rgba(111,185,143,.9)'; ctx.lineWidth = 1.4;
        ctx.strokeRect(jx + 13, 452 - bob, 10, 16);

        /* call line to whichever clinic he is on */
        var tgt = p < 0.30 ? 0 : p < 0.57 ? 1 : 2;
        var ringing = (p > 0.15 && p < 0.26) || (p > 0.42 && p < 0.53) || (p > 0.66 && p < 0.76);
        if (p > 0.15) {
          var t = B[tgt], tx = t.x + t.w / 2, ty = 400 - t.h - 70;
          ctx.strokeStyle = tgt === 2 ? 'rgba(140,230,185,.9)' : 'rgba(242,239,230,.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(jx + 20, 450 - bob);
          ctx.quadraticCurveTo((jx + tx) / 2, ty - 40, tx, ty);
          ctx.stroke();

          if (ringing) {                                /* expanding pulses */
            for (var k = 0; k < 3; k++) {
              var kk = ((p * 26 + k / 3) % 1);
              ctx.strokeStyle = (tgt === 2 ? 'rgba(140,230,185,' : 'rgba(242,239,230,') + (1 - kk) * 0.6 + ')';
              ctx.lineWidth = 1.5;
              ctx.beginPath(); ctx.arc(tx, ty, 8 + kk * 42, 0, Math.PI * 2); ctx.stroke();
            }
          }
          /* outcome marker */
          var failed = (tgt === 0 && p > 0.26) || (tgt === 1 && p > 0.53);
          if (failed) {
            ctx.strokeStyle = '#8B2020'; ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(tx - 13, ty - 13); ctx.lineTo(tx + 13, ty + 13);
            ctx.moveTo(tx + 13, ty - 13); ctx.lineTo(tx - 13, ty + 13);
            ctx.stroke();
          }
          if (tgt === 2 && p > 0.76) {
            ctx.strokeStyle = '#6FD3A2'; ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(tx - 14, ty); ctx.lineTo(tx - 4, ty + 11); ctx.lineTo(tx + 15, ty - 12);
            ctx.stroke();
          }
        }

        /* booking card drops in */
        if (p > 0.78) {
          var k2 = Math.min((p - 0.78) / 0.08, 1);
          var cy = 40 + k2 * 40;
          ctx.fillStyle = '#FBFAF5';
          ctx.fillRect(700, cy, 230, 86);
          ctx.fillStyle = '#1E5B3F';
          ctx.fillRect(700, cy, 230, 26);
          ctx.fillStyle = '#EAF6EF';
          ctx.font = '600 12px "IBM Plex Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText('BOOKED', 712, cy + 18);
          ctx.fillStyle = '#17150F';
          ctx.font = '400 22px Fraunces, Georgia, serif';
          ctx.fillText('James', 754, cy + 56);
          ctx.fillStyle = '#807B69';
          ctx.font = '400 12px "IBM Plex Mono", monospace';
          ctx.fillText('THU 9 JAN · 9:00AM', 754, cy + 74);
          ctx.strokeStyle = '#1E5B3F'; ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(714, cy + 52); ctx.lineTo(726, cy + 64); ctx.lineTo(744, cy + 44);
          ctx.stroke();
        }

        requestAnimationFrame(draw);
      }

      requestAnimationFrame(draw);
      document.documentElement.classList.add('street-2d');
      return { update: function (v) { prog = v; } };
    }

    setTimeout(function () {
      if (window.pvStreet) return;                 /* WebGL is running */
      fallback2D = build2D();
      if (fallback2D) {
        window.pvStreet = { update: fallback2D.update, ready: true, mode: '2d' };
        /* replay from the top now that something can actually draw */
        if (isCompact() && !reduceMotion) { autoPlaying = false; autoPlay(); }
        else requestStreet();
      }
    }, 1800);
  }

  /* ---------- hero card: Voice / SMS ----------
     Drop real recordings at the data-src paths (assets/audio/*.mp3)
     and they play for real. Until then playback is simulated. */
  var vcSwitch = document.querySelector('.vc-switch');
  var vcTabs = document.querySelectorAll('.vc-tab');
  var vcPanes = document.querySelectorAll('.vc-pane');
  var vcWave = document.getElementById('vcWave');
  var vcStatus = document.getElementById('vcStatus');
  var samples = document.querySelectorAll('.sample');
  var stopPlayback = function () {};

  if (vcWave && samples.length) {
    var audio = new Audio();
    var simTimer = null;
    var current = null;

    stopPlayback = function () {
      audio.pause();
      if (simTimer) { clearTimeout(simTimer); simTimer = null; }
      vcWave.classList.remove('playing');
      samples.forEach(function (s) { s.classList.remove('on'); });
      current = null;
      vcStatus.textContent = 'Pick a call to hear it';
    };

    samples.forEach(function (sample) {
      sample.addEventListener('click', function () {
        if (current === sample) { stopPlayback(); return; }
        stopPlayback();
        current = sample;
        sample.classList.add('on');
        vcWave.classList.add('playing');
        var label = sample.querySelector('.s-name').firstChild.textContent.trim();
        vcStatus.textContent = 'Playing: ' + label;
        var dur = (parseInt(sample.dataset.dur, 10) || 30) * 1000;

        audio.src = sample.dataset.src;
        var attempt = audio.play();
        if (attempt && attempt.then) {
          attempt.then(function () { audio.onended = stopPlayback; })
                 .catch(function () { simTimer = setTimeout(stopPlayback, dur); });
        } else {
          simTimer = setTimeout(stopPlayback, dur);
        }
      });
    });
  }

  /* chat playback */
  var chatBubbles = document.querySelectorAll('#chatBody .bub');
  var chatTimers = [];
  function resetChat() {
    chatTimers.forEach(clearTimeout);
    chatTimers = [];
    chatBubbles.forEach(function (b) { b.classList.remove('in'); });
  }
  function playChat() {
    resetChat();
    if (reduceMotion) {
      chatBubbles.forEach(function (b) { if (!b.classList.contains('typing')) b.classList.add('in'); });
      return;
    }
    var delay = 260;
    chatBubbles.forEach(function (b, i) {
      var isTyping = b.classList.contains('typing');
      chatTimers.push(setTimeout(function () {
        b.classList.add('in');
        if (isTyping) {
          chatTimers.push(setTimeout(function () { b.classList.remove('in'); }, 2200));
        }
      }, delay + i * 900));
    });
    chatTimers.push(setTimeout(playChat, delay + chatBubbles.length * 900 + 3600));
  }

  vcTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var mode = tab.dataset.mode;
      stopPlayback();
      vcTabs.forEach(function (t) {
        var isOn = t === tab;
        t.classList.toggle('on', isOn);
        t.setAttribute('aria-selected', String(isOn));
      });
      if (vcSwitch) vcSwitch.classList.toggle('sms', mode === 'sms');
      vcPanes.forEach(function (pane) {
        var isOn = pane.dataset.pane === mode;
        pane.hidden = !isOn;
        pane.classList.toggle('on', isOn);
      });
      if (mode === 'sms') playChat(); else resetChat();
    });
  });

  /* ---------- hero "Talk to AI" → phone demo ---------- */
  var talkBtn = document.getElementById('talkToAi');
  if (talkBtn) {
    talkBtn.addEventListener('click', function () {
      var target = document.getElementById('hear');
      if (!target) return;
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      setTimeout(function () {
        var nameField = document.getElementById('dName');
        if (nameField && !nameField.value) nameField.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 700);
    });
  }

  /* ==========================================================
     ALWAYS ON · clock + randomised booking cards
     Hands run continuously on rAF. Cards are shuffled every
     loop and land in a random slot around the dial; when one
     appears the hands sweep to that booking's hour, so the
     dial and the label always agree.
     ========================================================== */
  var clockSec = document.getElementById('always');
  var handH = document.getElementById('handH');
  var handM = document.getElementById('handM');
  var handS = document.getElementById('handS');
  var clkDig = document.getElementById('clkDig');
  var clkCards = document.getElementById('clkCards');

  var BOOKINGS = [
    { h: 2,    label: '2:00 AM',  who: 'HVAC emergency', what: 'No heating' },
    { h: 4,    label: '4:00 AM',  who: 'Plumbing',       what: 'Burst pipe' },
    { h: 6.5,  label: '6:30 AM',  who: 'Dental',         what: 'Early appointment' },
    { h: 8,    label: '8:00 AM',  who: 'Real estate',    what: 'Property enquiry' },
    { h: 10,   label: '10:00 AM', who: 'Legal',          what: 'Consultation request' },
    { h: 12,   label: '12:00 PM', who: 'Med spa',        what: 'Booking rescheduled' },
    { h: 14,   label: '2:00 PM',  who: 'HVAC',           what: 'Maintenance call' },
    { h: 17,   label: '5:00 PM',  who: 'Dental',         what: 'After-hours enquiry' },
    { h: 20,   label: '8:00 PM',  who: 'Real estate',    what: 'Late viewing' },
    { h: 23,   label: '11:00 PM', who: 'Plumbing',       what: 'Emergency callout' }
  ];
  var SLOTS = ['pos-n','pos-ne','pos-e','pos-se','pos-s','pos-sw','pos-w','pos-nw'];

  if (clockSec && handH && handM && clkDig && clkCards) {
    var HOUR_MS = 2100;        /* one simulated hour */
    var CARD_IN = 3400;        /* card holds for ~3s once faded in */
    var CARD_SLOT = 4300;      /* one card every 2 sim-hours */

    var simHour = 2;
    var seek = null;
    var lastTs = null;
    var clockLive = false;
    var cardTimers = [];
    var queue = [];
    var lastSlot = -1;

    var card = document.createElement('div');
    card.className = 'clk-card';
    card.innerHTML =
      '<span class="clk-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' +
      '<span class="clk-txt"><strong></strong><span class="mono"></span></span>' +
      '<span class="clk-mini" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
    clkCards.appendChild(card);
    var cardWho = card.querySelector('strong');
    var cardSub = card.querySelector('.mono');

    function shuffle(list) {
      var a = list.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }

    function place() {
      var s;
      do { s = Math.floor(Math.random() * SLOTS.length); } while (s === lastSlot && SLOTS.length > 1);
      lastSlot = s;
      card.className = 'clk-card ' + SLOTS[s];
    }

    function nextCard() {
      if (!clockLive) return;
      if (!queue.length) queue = shuffle(BOOKINGS);
      var b = queue.shift();

      cardWho.textContent = b.who;
      cardSub.textContent = b.label + ' · ' + b.what + ' · Booked';
      place();

      /* sweep the hands forward to this booking's hour */
      var to = b.h;
      while (to < simHour) to += 24;
      var dist = to - simHour;
      seek = { from: simHour, to: to, start: performance.now(),
               dur: Math.max(450, Math.min(1100, dist * 90)) };

      /* a timer, not rAF — rAF is throttled in background tabs and the
         card would silently never fade in */
      cardTimers.push(setTimeout(function () { card.classList.add('show'); }, 40));

      cardTimers.push(setTimeout(function () { card.classList.remove('show'); }, CARD_IN));
      cardTimers.push(setTimeout(nextCard, CARD_SLOT));
    }

    function render(ts) {
      var h12 = (simHour % 12) * 30;
      handH.style.transform = 'rotate(' + h12 + 'deg)';
      handM.style.transform = 'rotate(' + (((simHour * 60) % 60) * 6) + 'deg)';
      /* second hand keeps real time — a calm hairline sweep */
      if (handS) handS.style.transform = 'rotate(' + (((ts / 1000) % 60) * 6) + 'deg)';

      var hh = Math.floor(simHour) % 24;
      var mm = Math.floor((simHour - Math.floor(simHour)) * 60);
      clkDig.textContent = ((hh % 12) || 12) + ':' + String(mm).padStart(2, '0') +
                           ' ' + (hh < 12 ? 'AM' : 'PM');
    }

    function frame(ts) {
      if (!clockLive) return;
      var dt = lastTs === null ? 0 : (ts - lastTs);
      lastTs = ts;

      if (seek) {
        var p = Math.min((ts - seek.start) / seek.dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        simHour = seek.from + (seek.to - seek.from) * eased;
        if (p >= 1) { seek = null; simHour = simHour % 24; }
      } else {
        simHour = (simHour + dt / HOUR_MS) % 24;
      }

      render(ts);
      requestAnimationFrame(frame);
    }

    function startClock() {
      if (clockLive) return;
      clockLive = true;
      lastTs = null;
      requestAnimationFrame(frame);
      nextCard();
    }
    function stopClock() {
      clockLive = false;
      cardTimers.forEach(clearTimeout);
      cardTimers = [];
      card.classList.remove('show');
    }

    if (reduceMotion) {
      render(0);
      cardWho.textContent = BOOKINGS[0].who;
      cardSub.textContent = BOOKINGS[0].label + ' · ' + BOOKINGS[0].what + ' · Booked';
      card.className = 'clk-card pos-ne show';
    } else if ('IntersectionObserver' in window) {
      render(0);
      new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) startClock(); else stopClock();
        });
      }, { threshold: 0.15 }).observe(clockSec);
      window.addEventListener('load', function () { if (inView(clockSec)) startClock(); });
    } else {
      startClock();
    }
  }

  /* ---------- phone + demo form ----------
     TODO before launch: post this to a serverless function that triggers the
     outbound call (Vapi: POST /call { phoneNumberId, customer:{number},
     assistantId } · Retell: POST /v2/create-phone-call). Never put the key here. */
  var form = document.getElementById('demoForm');
  var successBox = document.getElementById('demoSuccess');
  var phone = document.getElementById('phone');
  var phRings = document.getElementById('phRings');
  var phName = document.getElementById('phName');
  var phSub = document.getElementById('phSub');
  var phStatus = document.getElementById('phStatus');
  var phClock = document.getElementById('phClock');

  var CONNECT_AFTER = 8000;    /* ring for 8s, then connect */
  var CALL_LENGTH = 150;       /* hang up at 2:30 */
  var connectTimer = null, tickTimer = null, elapsed = 0;

  function phoneClock() {
    if (!phClock) return;
    var d = new Date();
    var h = d.getHours() % 12 || 12;
    phClock.textContent = h + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  phoneClock();
  setInterval(phoneClock, 20000);

  function fmt(s) {
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function resetPhone() {
    clearTimeout(connectTimer); clearInterval(tickTimer);
    connectTimer = tickTimer = null;
    elapsed = 0;
    if (!phone) return;
    phone.dataset.state = 'idle';
    phRings.classList.remove('ringing');
    phStatus.textContent = 'Incoming call';
    phName.textContent = 'Lara';
    phSub.textContent = 'Waiting for your request';
  }

  function connectCall() {
    if (!phone) return;
    phone.dataset.state = 'connected';
    phRings.classList.remove('ringing');
    phStatus.textContent = 'Connected';
    phSub.textContent = 'Connected · 0:00';
    elapsed = 0;
    tickTimer = setInterval(function () {
      elapsed += 1;
      phSub.textContent = 'Connected · ' + fmt(elapsed);
      if (elapsed >= CALL_LENGTH) endCall();
    }, 1000);
  }

  function endCall() {
    clearTimeout(connectTimer); clearInterval(tickTimer);
    if (phone) {
      phone.dataset.state = 'ended';
      phStatus.textContent = 'Call ended';
      phSub.textContent = elapsed ? 'Lasted ' + fmt(elapsed) : 'Declined';
      phRings.classList.remove('ringing');
    }
    setTimeout(function () {
      resetPhone();
      if (form && successBox) { form.hidden = false; successBox.hidden = true; }
    }, 2200);
  }

  function startCall(name) {
    clearTimeout(connectTimer); clearInterval(tickTimer);
    if (!phone) return;
    phone.dataset.state = 'ringing';
    phStatus.textContent = 'Calling';
    phName.textContent = name || 'Lara';
    phSub.textContent = 'Ringing you now…';
    phRings.classList.add('ringing');
    connectTimer = setTimeout(connectCall, CONNECT_AFTER);
  }

  var phAccept = document.getElementById('phAccept');
  var phDecline = document.getElementById('phDecline');
  var phEnd = document.getElementById('phEnd');
  if (phAccept) phAccept.addEventListener('click', function () {
    if (phone.dataset.state === 'ringing') { clearTimeout(connectTimer); connectCall(); }
    else { startCall('Lara'); }
  });
  if (phDecline) phDecline.addEventListener('click', endCall);
  if (phEnd) phEnd.addEventListener('click', endCall);

  if (form && successBox) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      form.querySelectorAll('input[required]').forEach(function (input) {
        var valid = input.value.trim().length > 0;
        if (input.type === 'tel') valid = input.value.replace(/\D/g, '').length >= 7;
        input.closest('.f').classList.toggle('invalid', !valid);
        if (!valid) ok = false;
      });
      if (!ok) return;

      /* first name only on the call screen */
      var first = document.getElementById('dName').value.trim().split(/\s+/)[0];
      form.hidden = true;
      successBox.hidden = false;
      startCall(first);
    });
    form.querySelectorAll('input').forEach(function (input) {
      input.addEventListener('input', function () {
        input.closest('.f').classList.remove('invalid');
      });
    });
  }

  /* ---------- ROI calculator (tweened output, filled tracks) ---------- */
  var rCalls = document.getElementById('rCalls');
  if (rCalls) {
    var rMiss = document.getElementById('rMiss');
    var rValue = document.getElementById('rValue');
    var outM = document.getElementById('roiM');
    var outY = document.getElementById('roiY');
    var showM = 0, showY = 0, targM = 0, targY = 0, tweening = false;

    var money = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };

    var paintRange = function (input) {
      var p = (input.value - input.min) / (input.max - input.min) * 100;
      input.style.background =
        'linear-gradient(to right, var(--green) ' + p + '%, var(--line-2) ' + p + '%)';
    };

    var tween = function () {
      if (reduceMotion) {
        showM = targM; showY = targY;
        outM.textContent = money(showM);
        outY.textContent = money(showY);
        tweening = false;
        return;
      }
      showM += (targM - showM) * 0.18;
      showY += (targY - showY) * 0.18;
      outM.textContent = money(showM);
      outY.textContent = money(showY);
      if (Math.abs(targM - showM) > 1 || Math.abs(targY - showY) > 1) {
        requestAnimationFrame(tween);
      } else {
        showM = targM; showY = targY;
        outM.textContent = money(showM);
        outY.textContent = money(showY);
        tweening = false;
      }
    };

    var recalc = function () {
      var calls = Number(rCalls.value);
      var miss = Number(rMiss.value) / 100;
      var value = Number(rValue.value);

      document.getElementById('rCallsVal').textContent = calls;
      document.getElementById('rMissVal').textContent = rMiss.value + '%';
      document.getElementById('rValueVal').textContent = '$' + Number(rValue.value).toLocaleString('en-US');
      [rCalls, rMiss, rValue].forEach(paintRange);

      /* half of missed callers assumed to have booked */
      var weekly = calls * miss * 0.5 * value;
      targM = weekly * 4.33;
      targY = weekly * 52;
      if (!tweening) { tweening = true; requestAnimationFrame(tween); }
    };

    [rCalls, rMiss, rValue].forEach(function (input) {
      input.addEventListener('input', recalc);
    });
    recalc();
  }

  /* ---------- faq: one open at a time ---------- */
  var faqItems = document.querySelectorAll('.faq details');
  faqItems.forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      faqItems.forEach(function (other) { if (other !== d) other.open = false; });
    });
  });

})();
