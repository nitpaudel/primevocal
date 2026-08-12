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

  /* Lara's avatar. Primary path is assets/lara-avatar.jpg; only spellings of
     that same file are tried after it (including the doubled .jpg.jpg the file
     arrived with), never the old ./lara-avatar.png — that is a different face
     and falling back to it would quietly put the wrong person on the page.
     If none resolve the <img> is dropped and the parent gets .avatar-missing,
     which restores the green disc and the PV mark rather than a broken icon. */
  document.querySelectorAll('.imsg-av img, .chat-av img, .ph-avatar img').forEach(function (img) {
    var tries = [
      'assets/lara-avatar.jpg',
      'assets/lara-avatar.jpg.jpg',
      'assets/lara-avatar.jpeg',
      'assets/lara-avatar.webp'
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
    var maxP = 0;

    /* where each beat owns the screen, as a fraction of the scroll */
    var BEAT_AT = [0.00, 0.15, 0.42, 0.59, 0.68, 0.78, 0.90];

    function isCompact() { return window.innerWidth <= 860; }

    /* The stage is sticky, so the section's own height is the scroll runway.
       Measure the stage rather than window.innerHeight: on phones it is sized
       in svh, which does not track innerHeight while the browser chrome
       collapses, and mixing the two makes progress drift past 1 early. */
    function stageHeight() {
      return (stage && stage.offsetHeight) || window.innerHeight;
    }

    /* How many stage-heights of scrolling the story runs over. Phones get a
       shorter runway than desktop — same seven beats, less thumb work — and
       reduced-motion shorter still.

       This is the only lever on how long the section costs to scroll through,
       in both directions, and it has to stay fixed for the whole session so
       the document height never moves.

       WARNING: this must stay above 1.0. The stage inside is a full viewport
       tall, so a runway below 1 makes the section shorter than its own sticky
       child — travelCache goes negative, onStreetScroll bails to paint(0), and
       the story freezes on beat 1 and never plays. */
    function runway() {
      if (reduceMotion) return BEATS * 0.13 + 0.4;
      return isCompact() ? BEATS * 0.22 + 0.50 : BEATS * 0.26 + 0.60;
    }

    var travelCache = 0;

    /* The section's height is set once per layout and then left alone.
       It used to collapse to a single screen the moment the story finished,
       to give the dead runway back — but that removed ~4000px from the
       document in one frame, which is visible twice over: the scrollbar thumb
       jumps to its new, much larger size, and the scroll correction that keeps
       the stage still reads as the page shoving you upward. A stable document
       height is worth more than the reclaimed scrolling, so the runway is
       shorter instead (see runway() above) and never changes underfoot.

       Strictly read-then-write: measure the stage first, then set the height
       and derive the runway arithmetically. Reading offsetHeight back out
       after writing the height forces a synchronous reflow for a number we
       already know. */
    function sizeStreet() {
      var sh = stageHeight();
      var h = Math.round(sh * runway());
      street.style.height = h + 'px';
      travelCache = h - sh;
    }

    /* One-way ratchet.
       The story plays once, on the way down. Scrolling back up must not rewind
       it — it stays parked on the end frame (where scene.js keeps James
       breathing) — so progress is clamped to the furthest point reached and
       never given back. Everything downstream reads maxP, never the raw
       scroll position. */
    var lastBeat = -1, lastMins = -1, lastHint = -1;

    function paint(p) {
      if (p <= maxP) {
        /* already been here — nothing to repaint, and nothing to hand the
           renderer either, which is what keeps scrolling back up quiet */
        if (lastBeat !== -1) return;
      } else {
        maxP = p;
      }
      var dp = maxP;

      var idx = 0;
      for (var i = 0; i < BEAT_AT.length; i++) if (dp >= BEAT_AT[i]) idx = i;
      /* only touch the DOM when something actually changed — these run on
         every scroll frame, and redundant class/text writes are what makes a
         scroll-linked section feel gritty */
      if (idx !== lastBeat) {
        lastBeat = idx;
        beats.forEach(function (b, i) { b.classList.toggle('on', i === idx); });
        street.dataset.beat = String(idx + 1);
      }

      if (recTime) {
        var mins = Math.floor(dp * 14);
        if (mins !== lastMins) {
          lastMins = mins;
          recTime.textContent = '09:' + String(mins).padStart(2, '0') + ' PM';
        }
      }
      if (hint) {
        var h = dp > 0.04 ? 0 : 1;
        if (h !== lastHint) { lastHint = h; hint.style.opacity = h ? '' : '0'; }
      }

      if (window.pvStreet && window.pvStreet.ready) window.pvStreet.update(dp);
    }

    /* Nothing special happens at the end of the story: progress reaches 1 at
       exactly the moment the section's bottom edge reaches the bottom of the
       viewport, so the next pixel of scroll simply unsticks the stage and
       carries it away like any other section. Leaving the geometry alone is
       what makes that exit seamless — there is nothing to release. */
    function onStreetScroll() {
      streetTicking = false;
      if (travelCache <= 0) { paint(0); return; }
      var p = -street.getBoundingClientRect().top / travelCache;
      paint(p < 0 ? 0 : p > 1 ? 1 : p);
    }
    function requestStreet() {
      if (streetTicking) return;
      streetTicking = true;
      requestAnimationFrame(onStreetScroll);
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

    window.addEventListener('load', function () { sizeStreet(); requestStreet(); });
    /* mobile browser chrome collapsing on the first flick changes the stage
       height without firing resize, so re-measure a beat after first paint */
    setTimeout(function () { sizeStreet(); requestStreet(); }, 600);

    /* ---- the 2D street --------------------------------------------------
       The safety net when WebGL, import maps or the CDN are unavailable —
       every device that can run the 3D scene now gets the 3D scene. It tells the same seven beats as the Three.js scene —
       James walks past a closed clinic, is ignored by a busy one, then Prime
       Vocal answers and books him — on a plain 2D canvas. No WebGL, no import
       maps, no 600KB off a CDN, so it plays on any phone that can render a
       web page at all.

       On portrait screens it switches to a tracking camera: rather than
       shrinking a 1000-unit street into a 375px viewport until nothing is
       readable, it zooms in and pans along with James. */
    var canvas = document.getElementById('streetCanvas');
    var fallback2D = null;

    function build2D() {
      if (!canvas || window.pvStreet) return;        /* 3D won — leave it alone */
      var ctx;
      try { ctx = canvas.getContext('2d'); } catch (e) { return; }
      if (!ctx) return;                              /* a GL context already owns it */

      var W = 1000, H = 600, prog = 0;
      var CREAM = 'rgba(242,239,230,';
      var GREEN = 'rgba(140,230,185,';
      var GROUND = 400;

      var B = [
        { x: 90,  w: 200, h: 165, name: 'BRIGHT SMILE', lit: false },
        { x: 400, w: 210, h: 185, name: 'CITY DENTAL',  lit: true  },
        { x: 715, w: 200, h: 210, name: 'PARKVIEW',     lit: true, pv: true }
      ];
      var LAMPS = [30, 340, 650, 960];
      var STARS = [];
      for (var si = 0; si < 40; si++) {
        STARS.push({ x: (si * 137) % 1000, y: (si * 71) % 150, r: 0.6 + (si % 3) * 0.5, ph: si });
      }

      function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
      function seg(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
      function ease(t) { return t * t * (3 - 2 * t); }

      /* James's position mirrors the 3D walk exactly, so both renderers hit
         each beat at the same scroll offset */
      function jamesX(p) {
        if (p < 0.13) return 150 + seg(p, 0, 0.13) * 40;
        if (p < 0.30) return 190;
        if (p < 0.42) return 190 + ease(seg(p, 0.30, 0.42)) * 315;
        if (p < 0.57) return 505;
        if (p < 0.66) return 505 + ease(seg(p, 0.57, 0.66)) * 310;
        if (p < 0.92) return 815;
        return 815 + ease(seg(p, 0.92, 1)) * 150;
      }

      function fit() {
        var r = canvas.getBoundingClientRect();
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (r.width < 2 || r.height < 2) return false;
        var w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        return true;
      }

      /* portrait: zoom in and track James. landscape: fit the whole street. */
      function camera(cw, ch, focus) {
        if (cw / ch < 1.15) {
          var s = (ch * 0.74) / H;
          var visW = cw / s;
          var x = clamp(focus - visW * 0.5, -70, W + 70 - visW);
          /* pushed down the frame so the story text has clear sky above it */
          return { s: s, ox: -x * s, oy: (ch - H * s) * 0.86 };
        }
        var s2 = Math.min(cw / W, ch / H) * 0.95;
        return { s: s2, ox: (cw - W * s2) / 2, oy: (ch - H * s2) / 2 };
      }

      /* small stick figure — the staff behind the glass */
      function stick(x, y, s, pose, alpha) {
        ctx.save();
        ctx.translate(x, y); ctx.scale(s, s);
        ctx.strokeStyle = CREAM + alpha + ')';
        ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.arc(0, -26, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, -20); ctx.lineTo(0, -4);
        if (pose === 'phone') { ctx.moveTo(0, -15); ctx.lineTo(7, -22); ctx.moveTo(0, -15); ctx.lineTo(-8, -8); }
        else { ctx.moveTo(0, -15); ctx.lineTo(-8, -7); ctx.moveTo(0, -15); ctx.lineTo(8, -7); }
        ctx.moveTo(0, -4); ctx.lineTo(-6, 12);
        ctx.moveTo(0, -4); ctx.lineTo(6, 12);
        ctx.stroke();
        ctx.restore();
      }

      /* Painting a full-screen canvas while the section is nowhere near the
         viewport costs a frame budget the rest of the page needs. Skip the
         work when the stage is off-screen; the loop stays alive so it picks
         straight back up when it scrolls in. */
      var onScreen = true;
      if ('IntersectionObserver' in window && stage) {
        new IntersectionObserver(function (entries) {
          onScreen = entries[0].isIntersecting;
        }, { rootMargin: '120px 0px' }).observe(stage);
      }

      function draw(ms) {
        if (!onScreen || !fit()) { requestAnimationFrame(draw); return; }
        var t = ms / 1000;
        var cw = canvas.width, ch = canvas.height;
        var p = prog;
        var jx = jamesX(p);
        var cam = camera(cw, ch, jx);
        var dim = 1 - seg(p, 0.90, 1) * 0.45;      /* the street fades on the closing line */

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        var sky = ctx.createLinearGradient(0, 0, cw, ch);
        sky.addColorStop(0, '#080f0a'); sky.addColorStop(0.5, '#0f1a10'); sky.addColorStop(1, '#080c09');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, cw, ch);
        ctx.setTransform(cam.s, 0, 0, cam.s, cam.ox, cam.oy);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';

        /* stars */
        STARS.forEach(function (st) {
          ctx.fillStyle = CREAM + (0.10 + Math.abs(Math.sin(t * 0.6 + st.ph)) * 0.16) * dim + ')';
          ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
        });

        /* street lamps: pool of light first, so everything else sits on top */
        LAMPS.forEach(function (lx, i) {
          var f = 0.85 + Math.sin(t * (1.7 + i * 0.4) + i) * 0.12;
          var pool = ctx.createRadialGradient(lx, GROUND + 60, 4, lx, GROUND + 60, 130);
          pool.addColorStop(0, 'rgba(255,215,154,' + 0.11 * f * dim + ')');
          pool.addColorStop(1, 'rgba(255,215,154,0)');
          ctx.fillStyle = pool;
          ctx.fillRect(lx - 130, GROUND - 20, 260, 180);
          ctx.strokeStyle = CREAM + 0.22 * dim + ')'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(lx, GROUND + 40); ctx.lineTo(lx, GROUND - 130); ctx.stroke();
          ctx.fillStyle = 'rgba(255,233,184,' + 0.85 * f * dim + ')';
          ctx.beginPath(); ctx.arc(lx, GROUND - 136, 7, 0, Math.PI * 2); ctx.fill();
        });

        /* kerb */
        ctx.strokeStyle = CREAM + 0.25 * dim + ')'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(-80, GROUND); ctx.lineTo(1080, GROUND); ctx.stroke();

        /* ---- the three clinics ---- */
        B.forEach(function (b, bi) {
          var top = GROUND - b.h;
          var answered = b.pv && p > 0.66;
          var glow = b.pv ? seg(p, 0.63, 0.72) * (1 - seg(p, 0.95, 1)) : 0;

          if (glow > 0) {                            /* Parkview lights up green */
            var halo = ctx.createRadialGradient(b.x + b.w / 2, top + b.h / 2, 10, b.x + b.w / 2, top + b.h / 2, 220);
            halo.addColorStop(0, 'rgba(78,154,110,' + 0.20 * glow + ')');
            halo.addColorStop(1, 'rgba(78,154,110,0)');
            ctx.fillStyle = halo;
            ctx.fillRect(b.x - 180, top - 180, b.w + 360, b.h + 360);
          }

          ctx.strokeStyle = answered ? GREEN + 0.85 * dim + ')' : CREAM + 0.55 * dim + ')';
          ctx.lineWidth = 1.8;
          ctx.strokeRect(b.x, top, b.w, b.h);
          ctx.beginPath(); ctx.moveTo(b.x - 9, top); ctx.lineTo(b.x + b.w + 9, top); ctx.stroke();

          for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) {
            var wx = b.x + 16 + c * (b.w - 32) / 3, wy = top + 22 + r * 52;
            var ww = (b.w - 32) / 3 - 12, wh = 36;
            ctx.fillStyle = b.lit
              ? (answered ? 'rgba(111,185,143,' + 0.24 * dim + ')' : CREAM + 0.13 * dim + ')')
              : CREAM + 0.03 + ')';
            ctx.fillRect(wx, wy, ww, wh);
            ctx.strokeStyle = CREAM + 0.32 * dim + ')'; ctx.lineWidth = 1;
            ctx.strokeRect(wx, wy, ww, wh);
          }

          /* shopfront glazing + door */
          ctx.strokeStyle = CREAM + 0.36 * dim + ')'; ctx.lineWidth = 1.3;
          ctx.strokeRect(b.x + 12, GROUND - 78, b.w - 24, 78);
          ctx.strokeStyle = CREAM + 0.45 * dim + ')';
          ctx.strokeRect(b.x + b.w / 2 - 22, GROUND - 56, 44, 56);

          ctx.fillStyle = answered ? GREEN + 0.95 + ')' : CREAM + 0.5 * dim + ')';
          ctx.font = '600 13px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(b.name, b.x + b.w / 2, top - 14);

          if (bi === 0) {
            ctx.fillStyle = 'rgba(139,32,32,' + 0.4 * dim + ')';
            ctx.fillRect(b.x + b.w / 2 - 44, GROUND - 44, 88, 22);
            ctx.strokeStyle = 'rgba(200,90,80,' + 0.85 * dim + ')'; ctx.lineWidth = 1.3;
            ctx.strokeRect(b.x + b.w / 2 - 44, GROUND - 44, 88, 22);
            ctx.fillStyle = CREAM + 0.9 * dim + ')';
            ctx.font = '600 10px "IBM Plex Mono", monospace';
            ctx.fillText('OFF HOURS', b.x + b.w / 2, GROUND - 29);
          }

          if (bi === 1) {
            /* City Dental is open and busy. Her phone rings; she glances at
               it and goes back to her paperwork — beat 3. */
            var vis = seg(p, 0.30, 0.42) * dim;
            if (vis > 0.01) {
              var ringingB = p > 0.42 && p < 0.55;
              var glance = p > 0.455 && p < 0.50;
              stick(b.x + 52, GROUND - 8, 1.15, glance ? 'phone' : 'desk', 0.75 * vis);
              stick(b.x + 150, GROUND - 8, 1.05, 'desk', 0.5 * vis);
              /* the ringing desk phone */
              var shake = ringingB ? Math.sin(t * 26) * 2.2 : 0;
              ctx.fillStyle = CREAM + 0.75 * vis + ')';
              ctx.fillRect(b.x + 88, GROUND - 30 - Math.abs(shake), 18, 9);
              if (ringingB) {
                for (var rk = 0; rk < 2; rk++) {
                  var kb = ((t * 1.6 + rk / 2) % 1);
                  ctx.strokeStyle = CREAM + (1 - kb) * 0.4 * vis + ')';
                  ctx.lineWidth = 1.2;
                  ctx.beginPath(); ctx.arc(b.x + 97, GROUND - 28, 10 + kb * 20, -2.4, -0.7); ctx.stroke();
                }
              }
            }
          }

          if (b.pv && glow > 0.02) {                 /* PRIME VOCAL badge */
            var by = top - 62 + Math.sin(t * 2.4) * 2;
            ctx.fillStyle = 'rgba(30,91,63,' + 0.95 * glow + ')';
            ctx.fillRect(b.x + b.w / 2 - 62, by, 124, 28);
            ctx.strokeStyle = 'rgba(140,230,185,' + 0.9 * glow + ')'; ctx.lineWidth = 1.4;
            ctx.strokeRect(b.x + b.w / 2 - 62, by, 124, 28);
            ctx.fillStyle = 'rgba(234,251,241,' + glow + ')';
            ctx.font = '600 12px "IBM Plex Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('PRIME VOCAL', b.x + b.w / 2, by + 19);
          }
        });

        /* ---- James ---- */
        var walking = p < 0.13 || (p > 0.30 && p < 0.42) || (p > 0.57 && p < 0.66) || p > 0.92;
        var stride = walking ? Math.sin(jx * 0.32) : 0;
        var bob = walking ? Math.abs(Math.sin(jx * 0.32)) * 3 : 0;
        var calling = (p > 0.15 && p < 0.30) || (p > 0.42 && p < 0.57) || (p > 0.66 && p < 0.88);
        var hy = 452 - bob;

        ctx.strokeStyle = CREAM + 0.95 * dim + ')';
        ctx.lineWidth = 3.4;
        ctx.beginPath(); ctx.arc(jx, hy, 15, 0, Math.PI * 2); ctx.stroke();

        /* his face carries the beat: fed up, then relieved */
        ctx.fillStyle = CREAM + 0.95 * dim + ')';
        ctx.strokeStyle = CREAM + 0.95 * dim + ')';
        ctx.lineWidth = 2;
        var down = p < 0.66 && p > 0.14;
        if (down) {
          ctx.beginPath();
          ctx.moveTo(jx - 8, hy - 4); ctx.lineTo(jx - 2, hy - 4);
          ctx.moveTo(jx + 2, hy - 4); ctx.lineTo(jx + 8, hy - 4);
          ctx.stroke();
          ctx.beginPath(); ctx.arc(jx, hy + 12, 7, 1.15 * Math.PI, 1.85 * Math.PI); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(jx - 5, hy - 4, 2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(jx + 5, hy - 4, 2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath();
          if (p > 0.66) ctx.arc(jx, hy + 3, 7, 0.15 * Math.PI, 0.85 * Math.PI);
          else { ctx.moveTo(jx - 6, hy + 6); ctx.lineTo(jx + 6, hy + 6); }
          ctx.stroke();
        }

        ctx.strokeStyle = CREAM + 0.95 * dim + ')';
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(jx, hy + 15); ctx.lineTo(jx, hy + 56);                       /* torso */
        ctx.moveTo(jx, hy + 56); ctx.lineTo(jx - 14 + stride * 9, 545);          /* legs */
        ctx.moveTo(jx, hy + 56); ctx.lineTo(jx + 14 - stride * 9, 545);
        ctx.moveTo(jx, hy + 26); ctx.lineTo(jx - 17 - stride * 5, hy + 42);      /* free arm */
        ctx.stroke();

        /* phone arm: up at his ear while a call is live, down otherwise */
        ctx.beginPath();
        ctx.moveTo(jx, hy + 24);
        if (calling) ctx.lineTo(jx + 13, hy + 2); else ctx.lineTo(jx + 16, hy + 42);
        ctx.stroke();
        var px = calling ? jx + 13 : jx + 16, py = calling ? hy - 6 : hy + 44;
        ctx.fillStyle = '#0b140d';
        ctx.fillRect(px - 5, py - 8, 10, 16);
        ctx.strokeStyle = calling
          ? 'rgba(111,185,143,' + (0.6 + Math.sin(t * 6) * 0.3) * dim + ')'
          : 'rgba(111,185,143,' + 0.35 * dim + ')';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(px - 5, py - 8, 10, 16);

        /* ---- the call itself ---- */
        var tgt = p < 0.30 ? 0 : p < 0.57 ? 1 : 2;
        var ringing = (p > 0.15 && p < 0.26) || (p > 0.42 && p < 0.53) || (p > 0.66 && p < 0.74);
        if (p > 0.15) {
          var b2 = B[tgt], tx = b2.x + b2.w / 2, ty = GROUND - b2.h - 76;
          ctx.strokeStyle = tgt === 2 ? GREEN + 0.75 * dim + ')' : CREAM + 0.4 * dim + ')';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 7]);
          ctx.beginPath();
          ctx.moveTo(px + 6, py);
          ctx.quadraticCurveTo((px + tx) / 2, ty - 50, tx, ty);
          ctx.stroke();
          ctx.setLineDash([]);

          if (ringing) {
            for (var k = 0; k < 3; k++) {
              var kk = ((t * 0.9 + k / 3) % 1);
              ctx.strokeStyle = (tgt === 2 ? GREEN : CREAM) + (1 - kk) * 0.55 * dim + ')';
              ctx.lineWidth = 1.6;
              ctx.beginPath(); ctx.arc(tx, ty, 9 + kk * 46, 0, Math.PI * 2); ctx.stroke();
            }
          }

          /* nobody home / nobody cares */
          var failK = tgt === 0 ? seg(p, 0.26, 0.30) : tgt === 1 ? seg(p, 0.53, 0.57) : 0;
          if (failK > 0) {
            ctx.strokeStyle = 'rgba(163,61,42,' + failK * dim + ')';
            ctx.lineWidth = 5 * (0.6 + ease(failK) * 0.4);
            var d = 13 * (0.6 + ease(failK) * 0.4);
            ctx.beginPath();
            ctx.moveTo(tx - d, ty - d); ctx.lineTo(tx + d, ty + d);
            ctx.moveTo(tx + d, ty - d); ctx.lineTo(tx - d, ty + d);
            ctx.stroke();
          }

          /* Prime Vocal answers: tick, then a live conversation waveform */
          if (tgt === 2) {
            var okK = seg(p, 0.70, 0.76);
            if (okK > 0) {
              ctx.strokeStyle = 'rgba(111,211,162,' + okK * dim + ')';
              ctx.lineWidth = 5;
              ctx.beginPath();
              ctx.moveTo(tx - 14, ty); ctx.lineTo(tx - 4, ty + 11); ctx.lineTo(tx + 15, ty - 12);
              ctx.stroke();
            }
            /* the live conversation, hung on the call line between the two —
               low enough to clear the signage and the booking card above it */
            var waveK = seg(p, 0.70, 0.76) * (1 - seg(p, 0.86, 0.90));
            if (waveK > 0.01) {
              var mid = (jx + tx) / 2, wy = GROUND - 148;
              for (var wi = 0; wi < 9; wi++) {
                var amp = 5 + Math.abs(Math.sin(t * 4 + wi * 0.7)) * 22;
                ctx.strokeStyle = GREEN + waveK * 0.85 * dim + ')';
                ctx.lineWidth = 3.4;
                ctx.beginPath();
                ctx.moveTo(mid + (wi - 4) * 11, wy - amp / 2);
                ctx.lineTo(mid + (wi - 4) * 11, wy + amp / 2);
                ctx.stroke();
              }
            }
          }
        }

        /* ---- booked ---- */
        var cardK = seg(p, 0.78, 0.86) * (1 - seg(p, 0.95, 1));
        if (cardK > 0.01) {
          var cx = 700, cy = 30 + ease(seg(p, 0.78, 0.86)) * 46;
          ctx.globalAlpha = clamp(cardK * 1.5, 0, 1);
          ctx.fillStyle = '#FBFAF5';
          ctx.fillRect(cx, cy, 230, 92);
          ctx.fillStyle = '#1E5B3F';
          ctx.fillRect(cx, cy, 230, 28);
          ctx.fillStyle = '#EAF6EF';
          ctx.font = '600 12px "IBM Plex Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText('BOOKED', cx + 12, cy + 19);
          ctx.strokeStyle = '#1E5B3F'; ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(cx + 14, cy + 58); ctx.lineTo(cx + 26, cy + 70); ctx.lineTo(cx + 44, cy + 50);
          ctx.stroke();
          ctx.fillStyle = '#17150F';
          ctx.font = '400 22px Fraunces, Georgia, serif';
          ctx.fillText('James', cx + 58, cy + 62);
          ctx.fillStyle = '#807B69';
          ctx.font = '400 11px "IBM Plex Mono", monospace';
          ctx.fillText('THU 9 JAN · 9:00AM', cx + 58, cy + 80);
          ctx.globalAlpha = 1;
        }

        requestAnimationFrame(draw);
      }

      /* Size the buffer up front and on every viewport change, not only from
         inside the draw loop. rAF is throttled while the tab is backgrounded
         and in iOS low-power mode, and without this the canvas keeps its
         default 300x150 backing store stretched over a full-screen box, which
         is exactly what "the animation is broken on mobile" looks like. */
      fit();
      window.addEventListener('resize', fit);
      window.addEventListener('load', fit);
      window.addEventListener('orientationchange', function () { setTimeout(fit, 150); });
      /* build2D can run before the stylesheet has laid the canvas out, when
         fit() has no box to measure yet. Retry off timers rather than relying
         on the draw loop, which never gets a frame while rAF is throttled. */
      [60, 250, 800, 2000].forEach(function (ms) { setTimeout(fit, ms); });

      requestAnimationFrame(draw);
      document.documentElement.classList.add('street-2d');
      return { update: function (v) { prog = v; } };
    }

    function start2D() {
      if (window.pvStreet) return;
      fallback2D = build2D();
      if (fallback2D) {
        window.pvStreet = { update: fallback2D.update, ready: true, mode: '2d' };
        requestStreet();                             /* draw the current frame */
      }
    }

    /* Which renderer runs. Phones always take the 2D path: the Three.js scene
       needs WebGL, an ES-module import map and a CDN round trip, and any one of
       those missing used to leave the section frozen. Desktop still gets the 3D
       street, with 2D stepping in if it has not registered itself shortly. */
    function canRun3D() {
      /* Phones run the real 3D street too. The only disqualifiers are the
         genuine ones: no WebGL, or no import-map support to resolve "three". */
      try {
        var probe = document.createElement('canvas');
        if (!window.WebGLRenderingContext) return false;
        if (!(probe.getContext('webgl') || probe.getContext('experimental-webgl'))) return false;
      } catch (e) { return false; }
      /* import maps landed with HTMLScriptElement.supports — no supports(), no
         module resolution for "three", so do not sit waiting for it */
      return !!(window.HTMLScriptElement && HTMLScriptElement.supports &&
                HTMLScriptElement.supports('importmap'));
    }

    /* Hand off to 2D only when 3D genuinely cannot arrive — never on a short
       timer. Three.js is ~600KB from a CDN, which routinely takes longer than
       a second or two on mobile data; a 1.8s deadline meant phones on a normal
       connection were quietly downgraded to the 2D street even though WebGL
       was fine. Wait for the module to actually fail, or for a long stop. */
    if (canRun3D()) {
      var waited = 0;
      var poll = setInterval(function () {
        waited += 200;
        if (window.pvStreet) { clearInterval(poll); return; }   /* 3D arrived */
        if (window.__pvSceneFailed || waited >= 20000) {
          clearInterval(poll);
          start2D();
        }
      }, 200);
    } else {
      start2D();
    }
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

  /* ---------- SMS pane · auto-playing conversation ----------
     Nobody scrolls this: it deals itself out on timers, with a typing
     indicator in front of every one of Lara's replies, then holds the booking
     badge and starts again from an empty thread.

     `think` is how long the sender sits there before the bubble lands;
     `type`  is how long Lara's dots run before her bubble replaces them.
     The two add up to the gap the reader actually perceives, so every gap
     below lands between 1.5s and 2.5s — fast enough to hold attention, slow
     enough to read. Only the opening line comes in quicker, so the thread
     starts moving as soon as the tab is opened. */
  var imsgBody = document.getElementById('imsgBody');
  var chatTimers = [];
  var chatRun = 0;                    /* cancels a loop that is mid-flight */
  var CHAT_LOOP_PAUSE = 4000;         /* hold on the badge before replaying */

  var IMSG_SCRIPT = [
    { from: 'them', text: 'Hi is this Prime Vocal?', think: 800 },
    { from: 'us',   text: "Hey! Yes, I'm Lara. How can I help?", think: 500, type: 1300 },
    { from: 'them', text: 'We run a dental clinic and keep missing patient calls', think: 2100 },
    { from: 'us',   text: 'I can handle that. I answer every call and book them straight into your calendar.', think: 600, type: 1700 },
    { from: 'them', text: 'Even after hours?', think: 1600 },
    { from: 'us',   text: '24/7. No call goes unanswered.', think: 500, type: 1400 },
    { from: 'them', text: "Okay that's actually what we need. How do we get started?", think: 2400 },
    { from: 'us',   text: "Quick 15 min call and you're live within 72 - 96 hours. Tomorrow 10am work?", think: 600, type: 1900 },
    { from: 'them', text: 'Yeah 10am works', think: 1700 },
    { from: 'us',   text: 'Perfect. Booked for tomorrow 10am. Talk soon 👋', think: 500, type: 1800 },
    { from: 'card', text: '✓ Booking confirmed · Tomorrow, 10:00am', think: 1500 }
  ];

  function bubble(cls, text) {
    var el = document.createElement('div');
    el.className = 'imsg-bub ' + cls;
    el.textContent = text;
    imsgBody.appendChild(el);
    /* two frames: one to attach, one so the transition has a from-state */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('in'); });
    });
    return el;
  }

  function resetChat() {
    chatRun++;
    chatTimers.forEach(clearTimeout);
    chatTimers = [];
    if (imsgBody) imsgBody.innerHTML = '';
  }

  function playChat() {
    resetChat();
    if (!imsgBody) return;

    /* reduced motion: show the finished thread, no timers, no loop */
    if (reduceMotion) {
      IMSG_SCRIPT.forEach(function (m) {
        bubble(m.from + ' in', m.text);
      });
      return;
    }

    var run = chatRun;
    var at = 0;
    var after = function (ms, fn) {
      at += ms;
      chatTimers.push(setTimeout(function () { if (run === chatRun) fn(); }, at));
    };

    IMSG_SCRIPT.forEach(function (m) {
      if (m.from === 'us') {
        /* Lara: dots appear on her side, then swap for the reply */
        after(m.think, function () {
          var dots = document.createElement('div');
          dots.className = 'imsg-typing us';
          dots.innerHTML = '<i></i><i></i><i></i>';
          imsgBody.appendChild(dots);
          requestAnimationFrame(function () { dots.classList.add('in'); });
        });
        after(m.type, function () {
          var dots = imsgBody.querySelector('.imsg-typing');
          if (dots) dots.remove();
          bubble('us', m.text);
        });
      } else {
        after(m.think, function () { bubble(m.from === 'card' ? 'card' : 'them', m.text); });
      }
    });

    /* hold the confirmation, then run the whole thread again from empty */
    after(CHAT_LOOP_PAUSE, playChat);
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
  var phName = document.getElementById('phName');
  var phSub = document.getElementById('phSub');
  var phStatus = document.getElementById('phStatus');
  var phClock = document.getElementById('phClock');

  /* The screen has exactly two states, and data-state on .phone is what picks
     between them: "idle" is the incoming-call screen, "active" is the live
     call. Nothing runs on a timer to move between them — only the visitor
     does, by submitting the form, sliding to answer, or hitting End. */
  var CALL_STOP = 13;          /* the timer counts to 0:13 and then holds */
  var tickTimer = null, elapsed = 0;

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

  /* STATE 1 · the incoming-call screen */
  function resetPhone() {
    clearInterval(tickTimer);
    tickTimer = null;
    elapsed = 0;
    if (!phone) return;
    phone.dataset.state = 'idle';
    phStatus.textContent = 'Incoming call';   /* .mono uppercases it on screen */
    phName.textContent = 'Lara';
    phSub.textContent = 'Prime Vocal';
    /* the form comes back with the idle screen, so the demo can be run again */
    if (form && successBox) { form.hidden = false; successBox.hidden = true; }
  }

  /* STATE 2 · the live call. The timer counts a second at a time up to 0:13
     and then simply stops — long enough to read as a real connected call,
     short enough that it is never still climbing when the visitor looks back. */
  function startCall(name) {
    clearInterval(tickTimer);
    if (!phone) return;
    phone.dataset.state = 'active';
    phStatus.textContent = 'calling mobile...';
    phName.textContent = name || 'Lara';
    elapsed = 0;
    phSub.textContent = fmt(0);
    tickTimer = setInterval(function () {
      elapsed += 1;
      phSub.textContent = fmt(elapsed);
      if (elapsed >= CALL_STOP) { clearInterval(tickTimer); tickTimer = null; }
    }, 1000);
  }

  /* slide-to-answer takes the incoming screen straight to the live call */
  var phSlide = document.getElementById('phSlide');
  var phEnd = document.getElementById('phEnd');
  if (phSlide) phSlide.addEventListener('click', function () {
    if (phone && phone.dataset.state !== 'active') startCall('Lara');
  });
  if (phEnd) phEnd.addEventListener('click', resetPhone);

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

  /* ==========================================================
     FLOATING "TALK TO AI" BUTTON + MODAL
     ========================================================== */
  var fab = document.getElementById('talkFab');
  var modal = document.getElementById('talkModal');
  if (fab && modal) {
    var talkForm = document.getElementById('talkForm');
    var talkDone = document.getElementById('talkDone');
    var talkClose = document.getElementById('talkClose');
    var lastFocus = null;

    function openTalk() {
      lastFocus = document.activeElement;
      modal.hidden = false;
      /* next frame so the transition has a from-state to animate out of */
      requestAnimationFrame(function () { modal.classList.add('open'); });
      setTimeout(function () { modal.classList.add('open'); }, 30);
      document.body.style.overflow = 'hidden';
      setTimeout(function () {
        var f = document.getElementById('tkName');
        if (f) f.focus();
      }, 340);
    }
    function closeTalk() {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      setTimeout(function () {
        modal.hidden = true;
        /* reset so it opens clean next time */
        if (talkForm && talkDone) { talkForm.hidden = false; talkDone.hidden = true; }
      }, 340);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    fab.addEventListener('click', openTalk);
    if (talkClose) talkClose.addEventListener('click', closeTalk);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeTalk(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeTalk();
    });

    if (talkForm && talkDone) {
      talkForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = true;
        talkForm.querySelectorAll('input[required]').forEach(function (input) {
          var v = input.value.trim();
          var valid = v.length > 0;
          if (input.type === 'email') valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
          if (input.type === 'tel') valid = v.replace(/\D/g, '').length >= 7;
          input.closest('.talk-f').classList.toggle('invalid', !valid);
          if (!valid) ok = false;
        });
        if (!ok) return;
        /* TODO: post to the same serverless endpoint as the hero demo form
           before launch — this only shows the confirmation for now. */
        talkForm.hidden = true;
        talkDone.hidden = false;
      });
      talkForm.querySelectorAll('input').forEach(function (input) {
        input.addEventListener('input', function () {
          input.closest('.talk-f').classList.remove('invalid');
        });
      });
    }
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
