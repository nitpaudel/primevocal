/* ==========================================================
   PRIME VOCAL · Section 01 · James on the street
   Scroll-driven 3D street built with Three.js.

   main.js owns the scroll maths and the DOM story text; it
   calls window.pvStreet.update(p) with 0..1 progress. This
   module only draws the world, so if the CDN is unreachable
   the section still tells the story over the gradient.
   ========================================================== */
import * as THREE from 'three';

const CREAM  = 0xF2EFE6;
const RED    = 0x8B2020;
const GREEN  = 0x1E5B3F;
const GLOW   = 0x4E9A6E;   /* lifted green — #1E5B3F alone reads black on #0F0D08 */
/* mid-tone of the section gradient (#080f0a → #0f1a10 → #080c09) so the
   WebGL street matches the CSS around it — the canvas paints over it */
const NIGHT  = 0x0B140D;

const canvas = document.getElementById('streetCanvas');

/* Phones get the real 3D street, same as desktop — the camera adapts to the
   viewport rather than the scene being swapped out. The only guard left is
   whether something has already claimed the canvas. */
if (canvas && !window.pvStreet) boot();

function boot() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (e) {
    return;                       /* no WebGL — CSS gradient carries the section */
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.fog = new THREE.Fog(NIGHT, 34, 96);

  const camera = new THREE.PerspectiveCamera(42, 2, 0.1, 200);
  /* raised and swung off-axis so the street reads with depth, not flat side-on */
  camera.position.set(0, 7.5, 27);

  scene.add(new THREE.AmbientLight(0x6a6250, 0.55));
  const moon = new THREE.DirectionalLight(0xbfc8d8, 0.35);
  moon.position.set(-12, 26, 16);
  scene.add(moon);

  /* ---------- shared helpers ---------- */
  const texLoaderCache = new Map();

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function texFrom(c) {
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  }

  /* Draw a stick figure into a 2D context — same vocabulary as the rest
     of the site so the staff read as "people at work", not blobs. */
  function stick(ctx, x, y, s, pose) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = '#F2EFE6';
    ctx.lineWidth = 2.1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(0, -26, 6.4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -19); ctx.lineTo(0, -4);          /* torso */
    if (pose === 'type') {
      ctx.moveTo(0, -15); ctx.lineTo(-9, -7);
      ctx.moveTo(0, -15); ctx.lineTo(9, -7);
    } else if (pose === 'files') {
      ctx.moveTo(0, -15); ctx.lineTo(10, -12);
      ctx.moveTo(0, -12); ctx.lineTo(10, -9);
    } else if (pose === 'phone') {
      ctx.moveTo(0, -15); ctx.lineTo(8, -23);
    } else {
      ctx.moveTo(0, -15); ctx.lineTo(-8, -8);
      ctx.moveTo(0, -15); ctx.lineTo(8, -8);
    }
    ctx.moveTo(0, -4); ctx.lineTo(-6, 12);          /* legs */
    ctx.moveTo(0, -4); ctx.lineTo(6, 12);
    ctx.stroke();
    if (pose === 'files') { ctx.strokeRect(10, -15, 11, 8); }
    ctx.restore();
  }

  /* ---------- facade textures ----------
     Buildings are 3D boxes; the architectural detail lives in a canvas
     texture on the front face, which keeps the thin cream line work and
     the visible staff that pure box geometry would lose. */
  function facade(opts) {
    const W = 512, H = 512;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#12100A';
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(242,239,230,.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(242,239,230,.28)';
    ctx.strokeRect(26, 26, W - 52, H - 52);
    ctx.beginPath(); ctx.moveTo(26, 96); ctx.lineTo(W - 26, 96); ctx.stroke();   /* cornice */
    ctx.beginPath(); ctx.moveTo(26, 300); ctx.lineTo(W - 26, 300); ctx.stroke(); /* string course */

    /* signage */
    ctx.fillStyle = opts.signColor || 'rgba(242,239,230,.72)';
    ctx.font = '600 27px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(opts.name, W / 2, 68);

    /* windows */
    const winY = [130, 200];
    const winX = [56, 190, 324];
    winY.forEach((wy, row) => {
      winX.forEach((wx, col) => {
        const lit = opts.lit && opts.lit(row, col);
        ctx.fillStyle = lit ? (opts.litFill || 'rgba(242,239,230,.16)') : 'rgba(242,239,230,.04)';
        ctx.fillRect(wx, wy, 132, 58);
        ctx.strokeStyle = 'rgba(242,239,230,.45)';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(wx, wy, 132, 58);
        ctx.strokeStyle = 'rgba(242,239,230,.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx + 66, wy); ctx.lineTo(wx + 66, wy + 58);
        ctx.moveTo(wx, wy + 29); ctx.lineTo(wx + 132, wy + 29);
        ctx.stroke();
      });
    });

    /* ground floor: glazing + door */
    ctx.strokeStyle = 'rgba(242,239,230,.45)';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(56, 318, 400, 150);
    ctx.strokeRect(220, 360, 76, 108);              /* door */
    ctx.beginPath(); ctx.moveTo(220, 384); ctx.lineTo(296, 384); ctx.stroke();
    ctx.beginPath(); ctx.arc(286, 418, 3, 0, Math.PI * 2); ctx.stroke();

    if (opts.draw) opts.draw(ctx, W, H);

    return texFrom(c);
  }

  const facadeA = facade({
    name: 'BRIGHT SMILE DENTAL',
    lit: () => false,
    draw(ctx) {
      /* CLOSED sign hanging on the door */
      ctx.fillStyle = 'rgba(139,32,32,.35)';
      ctx.fillRect(214, 398, 88, 30);
      ctx.strokeStyle = 'rgba(200,90,80,.9)';
      ctx.lineWidth = 1.6;
      ctx.strokeRect(214, 398, 88, 30);
      ctx.fillStyle = '#F2EFE6';
      ctx.font = '600 17px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CLOSED', 258, 419);
    }
  });

  const facadeB = facade({
    name: 'CITY DENTAL CARE',
    lit: () => true,
    litFill: 'rgba(242,239,230,.2)',
    draw(ctx) {
      /* staff visible through the lit ground floor */
      stick(ctx, 120, 440, 1.5, 'files');
      stick(ctx, 380, 440, 1.4, 'type');
      ctx.strokeStyle = 'rgba(242,239,230,.3)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(340, 448); ctx.lineTo(420, 448); ctx.stroke();
      /* upstairs */
      stick(ctx, 122, 254, 1.0, 'type');
      stick(ctx, 390, 186, 0.95, 'work');
    }
  });

  const facadeC = facade({
    name: 'PARKVIEW DENTAL',
    signColor: 'rgba(120,220,170,.95)',
    lit: () => true,
    litFill: 'rgba(78,154,110,.18)',
    draw(ctx) {
      stick(ctx, 120, 440, 1.5, 'type');
      stick(ctx, 384, 440, 1.4, 'files');
      stick(ctx, 122, 254, 1.0, 'work');
      stick(ctx, 390, 254, 1.0, 'type');
    }
  });

  /* receptionist for building B lives on its own plane so she can
     glance at the phone and turn back */
  function receptionistTex(glancing) {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    stick(ctx, 64, 104, 2.2, glancing ? 'phone' : 'type');
    return texFrom(c);
  }

  function faceTex(mood) {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = '#F2EFE6';
    ctx.fillStyle = '#F2EFE6';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    /* eyes */
    if (mood === 'tired' || mood === 'frustrated') {
      ctx.beginPath(); ctx.moveTo(38, 52); ctx.lineTo(56, 52);
      ctx.moveTo(72, 52); ctx.lineTo(90, 52); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(47, 52, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(81, 52, 5, 0, Math.PI * 2); ctx.fill();
    }
    /* mouth */
    ctx.beginPath();
    if (mood === 'happy')            ctx.arc(64, 74, 18, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (mood === 'relieved')    ctx.arc(64, 76, 14, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (mood === 'sad')         ctx.arc(64, 98, 18, 1.15 * Math.PI, 1.85 * Math.PI);
    else if (mood === 'frustrated')  { ctx.moveTo(48, 88); ctx.lineTo(80, 82); }
    else                             { ctx.moveTo(48, 84); ctx.lineTo(80, 84); }
    ctx.stroke();
    return texFrom(c);
  }

  /* ---------- world ---------- */
  const world = new THREE.Group();
  scene.add(world);

  /* road + pavement */
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 60),
    new THREE.MeshStandardMaterial({ color: 0x14110B, roughness: 1 })
  );
  road.rotation.x = -Math.PI / 2;
  world.add(road);

  const kerb = new THREE.Mesh(
    new THREE.BoxGeometry(400, 0.35, 0.4),
    new THREE.MeshBasicMaterial({ color: CREAM, transparent: true, opacity: 0.18 })
  );
  kerb.position.set(0, 0.18, 7.2);
  world.add(kerb);

  const BUILDINGS = [
    { x: -26, tex: facadeA, w: 15, h: 15, key: 'a' },
    { x:   0, tex: facadeB, w: 16, h: 17, key: 'b' },
    { x:  26, tex: facadeC, w: 16, h: 18, key: 'c' }
  ];
  const bmesh = {};

  BUILDINGS.forEach(b => {
    const g = new THREE.Group();
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x191509, roughness: .95 });
    const frontMat = new THREE.MeshStandardMaterial({
      map: b.tex, emissive: 0xffffff, emissiveMap: b.tex, emissiveIntensity: 0.42, roughness: 1
    });
    /* BoxGeometry face order: +x, -x, +y, -y, +z, -z — front is +z */
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(b.w, b.h, 12),
      [sideMat, sideMat, sideMat, sideMat, frontMat, sideMat]
    );
    box.position.y = b.h / 2;
    g.add(box);
    g.position.set(b.x, 0, -4);
    world.add(g);
    bmesh[b.key] = { group: g, front: frontMat, h: b.h };
  });

  /* receptionist plane in front of City Dental's window */
  const recepMat = new THREE.MeshBasicMaterial({
    map: receptionistTex(false), transparent: true, opacity: 0
  });
  const recepTexIdle = recepMat.map;
  const recepTexGlance = receptionistTex(true);
  const recep = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), recepMat);
  recep.position.set(2.6, 2.4, 2.2);
  world.add(recep);

  /* ringing desk phone next to her */
  const deskPhone = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.28, 0.34),
    new THREE.MeshBasicMaterial({ color: CREAM, transparent: true, opacity: 0 })
  );
  deskPhone.position.set(4.0, 1.9, 2.3);
  world.add(deskPhone);

  /* Prime Vocal badge over Parkview's entrance */
  const badgeCanvas = makeCanvas(256, 96);
  (function () {
    const ctx = badgeCanvas.getContext('2d');
    const badgeGrad = ctx.createLinearGradient(0, 0, 256, 96);
    badgeGrad.addColorStop(0, '#1E5B3F');
    badgeGrad.addColorStop(1, '#2d7a55');
    ctx.fillStyle = badgeGrad;
    ctx.strokeStyle = 'rgba(140,230,185,.95)';
    ctx.lineWidth = 3;
    const r = 26;
    ctx.beginPath();
    ctx.moveTo(r, 6); ctx.lineTo(250 - r, 6);
    ctx.quadraticCurveTo(250, 6, 250, 6 + r);
    ctx.lineTo(250, 90 - r);
    ctx.quadraticCurveTo(250, 90, 250 - r, 90);
    ctx.lineTo(r, 90);
    ctx.quadraticCurveTo(6, 90, 6, 90 - r);
    ctx.lineTo(6, 6 + r);
    ctx.quadraticCurveTo(6, 6, r, 6);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#EAFBF1';
    ctx.font = '600 30px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PRIME VOCAL', 128, 58);
  })();
  const badgeMat = new THREE.MeshBasicMaterial({ map: texFrom(badgeCanvas), transparent: true, opacity: 0 });
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.4), badgeMat);
  badge.position.set(26, 8.4, 2.3);
  world.add(badge);

  /* street lamps + glow pools on the ground */
  const lamps = [];
  [-38, -13, 13, 38].forEach(x => {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 9, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a2418, roughness: 1 })
    );
    post.position.set(x, 4.5, 7.6);
    world.add(post);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xFFE9B8 })
    );
    head.position.set(x, 9.1, 7.6);
    world.add(head);

    const light = new THREE.PointLight(0xFFD79A, 26, 22, 2);
    light.position.set(x, 8.4, 6.4);
    world.add(light);

    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(4.4, 28),
      new THREE.MeshBasicMaterial({
        color: 0xFFD79A, transparent: true, opacity: 0.07,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.03, 6.6);
    world.add(pool);

    lamps.push({ head, light, pool, x });
  });

  /* parallax skyline — moves at 0.3x the camera pan */
  const far = new THREE.Group();
  for (let i = -9; i <= 9; i++) {
    const h = 12 + ((i * 7919) % 17);
    const w = 9 + ((i * 6151) % 7);
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 4),
      new THREE.MeshBasicMaterial({ color: 0x171308 })
    );
    m.position.set(i * 13, h / 2, -46);
    far.add(m);
  }
  scene.add(far);

  /* dust */
  const DUST = 260;
  const dustGeo = new THREE.BufferGeometry();
  const dpos = new Float32Array(DUST * 3);
  const dseed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dpos[i * 3]     = (Math.random() - 0.5) * 150;
    dpos[i * 3 + 1] = Math.random() * 22;
    dpos[i * 3 + 2] = (Math.random() - 0.5) * 30 + 2;
    dseed[i] = Math.random() * 6.28;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xF2EFE6, size: 0.11, transparent: true, opacity: 0.3,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  scene.add(dust);

  /* ---------- James ---------- */
  const james = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xF2EFE6, roughness: .8, emissive: 0x2a2618, emissiveIntensity: .5 });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.25, 6, 12), skin);
  torso.position.y = 2.05;
  james.add(torso);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.56, 20, 16), skin);
  headMesh.position.y = 3.15;
  james.add(headMesh);

  const faceMat = new THREE.MeshBasicMaterial({ map: faceTex('neutral'), transparent: true });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), faceMat);
  face.position.set(0, 3.17, 0.53);
  james.add(face);

  const legGeo = new THREE.CapsuleGeometry(0.17, 0.95, 4, 8);
  const legL = new THREE.Mesh(legGeo, skin);
  const legR = new THREE.Mesh(legGeo, skin);
  legL.position.set(-0.22, 0.72, 0); legR.position.set(0.22, 0.72, 0);
  legL.geometry.translate(0, -0.5, 0); legR.geometry.translate(0, -0.5, 0);
  legL.position.y = 1.28; legR.position.y = 1.28;
  james.add(legL, legR);

  const armGeo = new THREE.CapsuleGeometry(0.14, 0.8, 4, 8);
  armGeo.translate(0, -0.45, 0);
  const armFree = new THREE.Mesh(armGeo, skin);
  armFree.position.set(-0.5, 2.6, 0);
  james.add(armFree);

  const armPhone = new THREE.Group();
  const armP = new THREE.Mesh(armGeo, skin);
  armP.position.set(0, 0, 0);
  armPhone.add(armP);
  const phoneMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.56, 0.07),
    new THREE.MeshBasicMaterial({ color: 0x0b0a06 })
  );
  phoneMesh.position.set(0, -0.86, 0.1);
  armPhone.add(phoneMesh);
  const phoneGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.6),
    new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0 })
  );
  phoneGlow.position.set(0, -0.86, 0.15);
  armPhone.add(phoneGlow);
  armPhone.position.set(0.5, 2.6, 0);
  james.add(armPhone);

  /* he is the protagonist — sized and pulled forward so he reads
     against three-storey buildings instead of disappearing at their base */
  james.scale.setScalar(1.5);
  james.position.set(-30, 0, 7.5);
  world.add(james);

  /* ---------- call pulses ---------- */
  function ringSet(color) {
    const g = new THREE.Group();
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.02, 40),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
      );
      g.add(m); rings.push(m);
    }
    world.add(g);
    return { group: g, rings };
  }
  const pulseA = ringSet(CREAM);
  const pulseB = ringSet(CREAM);
  const pulseC = ringSet(GLOW);
  pulseA.group.position.set(-26, 11, 3);
  pulseB.group.position.set(0, 12, 3);
  pulseC.group.position.set(26, 12.5, 3);

  /* red ✕ markers */
  function cross(x, y) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0 });
    const a = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 0.1), mat);
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.34, 0.1), mat);
    a.rotation.z = Math.PI / 4; b.rotation.z = -Math.PI / 4;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.9, 28),
      new THREE.MeshBasicMaterial({ color: 0x2A0B0B, transparent: true, opacity: 0 })
    );
    disc.position.z = -0.06;
    g.add(disc, a, b);
    g.position.set(x, y, 3.4);
    g.scale.setScalar(0.4);
    world.add(g);
    return { group: g, mat, disc };
  }
  const crossA = cross(-26, 11);
  const crossB = cross(0, 12);

  /* green conversation waveform bouncing between James and Parkview */
  const waveBars = [];
  const waveGroup = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 1, 0.22),
      new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0 })
    );
    m.position.x = (i - 4) * 0.62;
    waveGroup.add(m);
    waveBars.push(m);
  }
  waveGroup.position.set(23.5, 6.2, 4);
  world.add(waveGroup);

  /* booking card */
  const cardCanvas = makeCanvas(512, 288);
  (function () {
    const ctx = cardCanvas.getContext('2d');
    ctx.fillStyle = '#FBFAF5';
    ctx.fillRect(0, 0, 512, 288);
    const cardGrad = ctx.createLinearGradient(0, 0, 512, 74);
    cardGrad.addColorStop(0, '#1E5B3F');
    cardGrad.addColorStop(1, '#2d7a55');
    ctx.fillStyle = cardGrad;
    ctx.fillRect(0, 0, 512, 74);
    ctx.fillStyle = '#EAF6EF';
    ctx.font = '600 26px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('BOOKED', 30, 48);
    /* tick */
    ctx.strokeStyle = '#1E5B3F';
    ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(44, 168); ctx.lineTo(78, 202); ctx.lineTo(140, 138); ctx.stroke();
    ctx.fillStyle = '#17150F';
    ctx.font = '400 40px Fraunces, Georgia, serif';
    ctx.fillText('James', 172, 168);
    ctx.fillStyle = '#807B69';
    ctx.font = '400 24px "IBM Plex Mono", monospace';
    ctx.fillText('THU 9 JAN · 9:00AM', 172, 208);
  })();
  const cardMat = new THREE.MeshBasicMaterial({ map: texFrom(cardCanvas), transparent: true, opacity: 0 });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 4.05), cardMat);
  card.position.set(26, 24, 4.2);
  world.add(card);

  /* ---------- beat helpers ---------- */
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const ease = t => t * t * (3 - 2 * t);

  let mood = 'neutral';
  function setMood(m) {
    if (m === mood) return;
    mood = m;
    const old = faceMat.map;
    faceMat.map = faceTex(m);
    faceMat.needsUpdate = true;
    if (old) old.dispose();
  }

  let glancing = false;
  function setGlance(on) {
    if (on === glancing) return;
    glancing = on;
    recepMat.map = on ? recepTexGlance : recepTexIdle;
    recepMat.needsUpdate = true;
  }

  function pulse(set, active, t, spread) {
    set.rings.forEach((r, i) => {
      if (!active) { r.material.opacity = 0; return; }
      const k = ((t * 0.55 + i / 3) % 1);
      r.scale.setScalar(0.6 + k * (spread || 5));
      r.material.opacity = (1 - k) * 0.55;
    });
  }

  /* ---------- render loop ---------- */
  let progress = 0, target = 0, walked = 0, time = 0;
  let camZ = 27;

  /* How much street to hold in frame, in world units.
     A phone in portrait is ~0.46 aspect: fitting the desktop's 44 units there
     would shove the camera ~125 units back and shrink the whole scene to
     nothing. Narrow screens instead frame tighter and let the camera track
     James, which reads far better on a small display. */
  function frameWidth(aspect) {
    if (aspect >= 1.4) return 44;          /* desktop / landscape */
    if (aspect <= 0.65) return 21;         /* phone portrait */
    /* tablets and in-between: ease between the two */
    const t = (aspect - 0.65) / (1.4 - 0.65);
    return 21 + t * (44 - 21);
  }
  const isPortrait = () => camera.aspect < 0.9;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    /* a zero-size container would make camera.aspect NaN and blank the view */
    if (w < 2 || h < 2) return;
    if (canvas.width !== w * renderer.getPixelRatio() || canvas.height !== h * renderer.getPixelRatio()) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
      camZ = Math.max(20, (frameWidth(camera.aspect) / 2) / (Math.tan(halfFov) * camera.aspect));
      camera.updateProjectionMatrix();
    }
  }

  function frame(ms) {
    time = ms / 1000;
    resize();

    /* ease toward the scroll target so the camera never snaps */
    progress += (target - progress) * 0.09;
    const p = progress;

    /* ---- James walks: -30 → -26 → 0 → 26 → 40 ---- */
    let x;
    if (p < 0.13)      x = -30 + seg(p, 0, 0.13) * 4;
    else if (p < 0.30) x = -26;
    else if (p < 0.40) x = -26 + ease(seg(p, 0.30, 0.40)) * 26;
    else if (p < 0.57) x = 0;
    else if (p < 0.66) x = ease(seg(p, 0.57, 0.66)) * 24;
    else if (p < 0.90) x = 24;
    else               x = 24 + ease(seg(p, 0.90, 1)) * 16;

    const prevX = james.position.x;
    james.position.x = x;
    walked += Math.abs(x - prevX);

    const moving = Math.abs(x - prevX) > 0.004;
    const stride = moving ? Math.sin(walked * 1.5) : 0;
    legL.rotation.x = stride * 0.75;
    legR.rotation.x = -stride * 0.75;
    armFree.rotation.x = -stride * 0.5;
    james.position.y = moving ? Math.abs(Math.sin(walked * 3)) * 0.07 : 0;
    james.rotation.y = 0.32;

    /* phone raised while calling */
    const calling = (p > 0.15 && p < 0.30) || (p > 0.42 && p < 0.57) || (p > 0.66 && p < 0.86);
    armPhone.rotation.z = THREE.MathUtils.lerp(armPhone.rotation.z, calling ? -2.15 : -0.05, 0.1);
    phoneGlow.material.opacity = calling ? 0.5 + Math.sin(time * 6) * 0.3 : 0.12;

    /* ---- camera follows horizontally ----
       clamped at the end so Parkview stays in shot for the closing line
       while James carries on walking out of frame */
    /* Portrait frames tighter, so it tracks James almost exactly and sits a
       little lower and closer to him; the wide desktop frame leads him
       instead and stops before it runs past Parkview. */
    const port = isPortrait();
    const camX = port ? x + 0.5 : Math.min(x + 3, 29);
    camera.position.x += (camX - camera.position.x) * (port ? 0.09 : 0.06);
    const camY = port ? (p > 0.87 ? 7.4 : 6.4) : (p > 0.87 ? 8.8 : 7.5);
    camera.position.y += (camY - camera.position.y) * 0.05;
    camera.position.z += (camZ - camera.position.z) * 0.08;
    camera.lookAt(camera.position.x - (port ? 0.5 : 2.4), port ? 4.6 : 5.2, 0);

    /* parallax: skyline drifts at 0.3x the camera */
    far.position.x = camera.position.x * 0.7;

    /* ---- beat states ---- */
    const b2 = p > 0.15 && p < 0.30;      /* ringing A */
    const b3 = p > 0.42 && p < 0.57;      /* ringing B */
    const b5 = p > 0.66 && p < 0.90;      /* Parkview answers */

    pulse(pulseA, b2 && p < 0.26, time, 5);
    pulse(pulseB, b3 && p < 0.53, time, 5);
    pulse(pulseC, b5 && p < 0.74, time, 4);

    /* red crosses */
    [[crossA, seg(p, 0.255, 0.30)], [crossB, seg(p, 0.525, 0.57)]].forEach(([c, k]) => {
      const fade = k * (1 - seg(p, 0.885, 0.95));
      c.mat.opacity = fade;
      c.disc.material.opacity = fade * 0.75;
      c.group.scale.setScalar(0.4 + ease(k) * 0.62);
    });

    /* City Dental: staff visible, receptionist glances then returns */
    const bShow = seg(p, 0.33, 0.42);
    recepMat.opacity = bShow;
    deskPhone.material.opacity = bShow;
    if (b3) {
      const shake = Math.sin(time * 26) * 0.05;
      deskPhone.position.y = 1.9 + Math.abs(shake);
      deskPhone.rotation.z = shake;
      setGlance(p > 0.455 && p < 0.50);
      recep.rotation.z = (p > 0.455 && p < 0.50) ? 0.18 : 0;
    } else {
      setGlance(false);
      deskPhone.rotation.z = 0;
    }

    /* Parkview glows green as it answers */
    const glowK = seg(p, 0.63, 0.72) * (1 - seg(p, 0.95, 1));
    bmesh.c.front.emissiveIntensity = 0.42 + glowK * 0.75;
    badgeMat.opacity = glowK;
    badge.position.y = 8.4 + Math.sin(time * 2.4) * 0.09;
    badge.scale.setScalar(1 + glowK * Math.sin(time * 3) * 0.02);

    /* conversation waveform bounces between James and the building */
    const waveK = seg(p, 0.70, 0.76) * (1 - seg(p, 0.86, 0.9));
    waveBars.forEach((bar, i) => {
      bar.material.opacity = waveK * 0.9;
      const amp = 0.5 + Math.abs(Math.sin(time * 4 + i * 0.7)) * 2.4;
      bar.scale.y = amp;
    });
    waveGroup.position.x = (x + 26) / 2 + 1;

    /* booking card springs down from above */
    const cardK = seg(p, 0.76, 0.86);
    const overshoot = Math.sin(cardK * Math.PI * 1.15) * 1.1;
    cardMat.opacity = clamp(cardK * 1.6, 0, 1) * (1 - seg(p, 0.95, 1));
    card.position.y = 24 - ease(cardK) * 10.2 - overshoot * 0.5;
    card.rotation.z = (1 - ease(cardK)) * 0.14;

    /* moods */
    if (p < 0.14)      setMood('neutral');
    else if (p < 0.31) setMood('sad');
    else if (p < 0.47) setMood('neutral');
    else if (p < 0.57) setMood('frustrated');
    else if (p < 0.66) setMood('tired');
    else if (p < 0.80) setMood('relieved');
    else               setMood('happy');

    /* lamps flicker faintly; the whole street dims at the very end */
    lamps.forEach((l, i) => {
      const f = 0.92 + Math.sin(time * (1.7 + i * 0.4) + i) * 0.06;
      l.light.intensity = 26 * f * (1 - seg(p, 0.9, 1) * 0.45);
      l.head.material.color.setHex(0xFFE9B8);
      l.pool.material.opacity = 0.07 * f * (1 - seg(p, 0.9, 1) * 0.5);
    });
    const dim = 1 - seg(p, 0.9, 1) * 0.4;
    [bmesh.a, bmesh.b].forEach(b => { b.front.emissiveIntensity = 0.42 * dim; });

    /* dust drift */
    const pa = dustGeo.attributes.position;
    for (let i = 0; i < DUST; i++) {
      const y = pa.array[i * 3 + 1] + 0.004 + Math.sin(time * 0.4 + dseed[i]) * 0.002;
      pa.array[i * 3 + 1] = y > 23 ? 0 : y;
      pa.array[i * 3] += Math.sin(time * 0.22 + dseed[i]) * 0.004;
    }
    pa.needsUpdate = true;

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  /* Size it up front and on every viewport change, not only inside the render
     loop — rAF is throttled on mobile (low-power mode, backgrounded tab), and
     without this the canvas keeps its default 300x150 backing store and the
     street renders blurry or not at all. */
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });
  window.addEventListener('load', resize);
  /* A deferred module can evaluate after load has already fired, in which case
     that listener never runs; and at boot the sticky stage may not have laid
     out yet, so the first resize() finds a zero-width canvas. Retry off timers
     so sizing never depends on rAF or on event ordering. */
  [60, 250, 800, 2000].forEach(function (ms) { setTimeout(resize, ms); });

  requestAnimationFrame(frame);

  /* main.js drives this */
  window.pvStreet = {
    update(p) { target = clamp(p, 0, 1); },
    ready: true
  };
  document.documentElement.classList.add('street-3d');
}
