      const $ = (q) => document.querySelector(q),
        php = (n) => "₱" + Math.round(n).toLocaleString(),
        pad = (n) => String(n).padStart(2, "0"),
        fmt = (d) =>
          d.getFullYear() +
          "-" +
          pad(d.getMonth() + 1) +
          "-" +
          pad(d.getDate()),
        today = () => fmt(new Date()),
        esc = (s) =>
          String(s ?? "")
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;"),
        key = (a) => a.date + String(a.start).padStart(4, "0");
      const m2t = (m) => {
        const h = Math.floor(m / 60);
        return (h % 12 || 12) + ":" + pad(m % 60) + (h < 12 ? " AM" : " PM");
      };
      const durT = (m) =>
        m >= 60
          ? +(m / 60).toFixed(2) + (m === 60 ? " hr" : " hrs")
          : m + " min";

      const hsl = (h, s, l) => {
        s /= 100; l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = n => {
          const k = (n + h / 30) % 12;
          const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
          return Math.round(255 * c).toString(16).padStart(2, "0");
        };
        return "#" + f(0) + f(8) + f(4);
      };
      const svgArt = (s) => {
        const n = String(s.n || ""), g = String(s.g || "");
        const hue = (n.length * 37 + g.length * 11 + (Number(s.id) || 0) * 17) % 360;
        const colors = [
          hsl(hue, 68, 76), hsl((hue + 35) % 360, 62, 70),
          hsl((hue + 320) % 360, 58, 82), hsl((hue + 70) % 360, 55, 74),
          hsl((hue + 200) % 360, 50, 80)
        ];
        const bg = hsl(hue, 45, 94), skin = "#f2cdb8";
        const isGel = /Gel|BIAB|Soft|Luxury|Glam|Self-Care|Pamper/i.test(n);
        const isExtension = /Extension|BIAB|Luxury/i.test(n);
        const isFoot = /Pedi|Footspa/i.test(n) && !/Mani/i.test(n);
        const isRemoval = g === "Removal" || /Remov/i.test(n);
        const isKids = /Kids/i.test(n);
        const isPackage = g === "Packages" || /\+/.test(n);
        const star = (x, y, r) =>
          `<path d="M${x} ${y-r}L${x+r*.3} ${y-r*.3}L${x+r} ${y}L${x+r*.3} ${y+r*.3}L${x} ${y+r}L${x-r*.3} ${y+r*.3}L${x-r} ${y}L${x-r*.3} ${y-r*.3}Z" fill="#fff" opacity=".9"/>`;
        let art = `<rect width="160" height="120" fill="${bg}"/><circle cx="140" cy="18" r="30" fill="${colors[2]}" opacity=".5"/><circle cx="14" cy="108" r="26" fill="${colors[1]}" opacity=".35"/>`;
        if (isFoot) {
          art += `<ellipse cx="80" cy="88" rx="44" ry="26" fill="${skin}"/>`;
          art += [0,1,2,3,4].map(i => {
            const x = 44 + i * 18, y = 52 + Math.abs(i - 1) * 5 - (i === 0 ? 4 : 0);
            return `<circle cx="${x}" cy="${y}" r="${i===0?10:8}" fill="${skin}"/><circle cx="${x}" cy="${y-3}" r="${i===0?6:4.5}" fill="${colors[i%5]}"/>${isGel?`<circle cx="${x-2}" cy="${y-5}" r="1.6" fill="#fff" opacity=".8"/>`:""}`;
          }).join("");
          if (/Footspa/i.test(n)) art += `<path d="M10 100Q30 90 50 100T90 100T130 100T170 100V120H10Z" fill="#8ec9e6" opacity=".8"/>`;
        } else if (isRemoval) {
          art += `<rect x="64" y="40" width="32" height="64" rx="16" fill="${skin}"/><rect x="68" y="44" width="24" height="26" rx="10" fill="#f6e3d8"/><ellipse cx="108" cy="78" rx="22" ry="14" fill="#fff"/><path d="M40 30Q44 40 40 46Q36 40 40 30Z" fill="#7fc4e8"/>${star(122,38,7)}`;
        } else {
          const heights = [50,66,74,64,46];
          art += heights.map((height, i) => {
            const x = 18 + i * 28, y = 100 - height, nailHeight = (isExtension ? 36 : isKids ? 18 : 24) + (i === 2 ? 4 : 0);
            const color = colors[(i + (isKids ? 1 : 0)) % 5];
            return `<rect x="${x}" y="${y}" width="24" height="${height+24}" rx="12" fill="${skin}"/>${isExtension?`<path d="M${x+3} ${y+nailHeight} Q${x+3} ${y-10} ${x+12} ${y-14} Q${x+21} ${y-10} ${x+21} ${y+nailHeight}Z" fill="${color}"/>`:`<rect x="${x+3}" y="${y+4}" width="18" height="${nailHeight}" rx="8" fill="${color}"/>`}${isGel?`<rect x="${x+6}" y="${y+7}" width="3.5" height="${Math.max(8,nailHeight-8)}" rx="2" fill="#fff" opacity=".65"/>`:""}`;
          }).join("");
          if (isKids) art += star(132,26,9) + star(24,28,6);
        }
        if (isPackage) art += star(138,30,10) + star(22,24,7) + star(128,96,6);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">${art}</svg>`;
        return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      };
      const svImg = (s) => {
        const candidate = s.image_url || s.imageUrl || s.photo_url || s.img || "";
        return typeof candidate === "string" && /^(https?:\/\/|data:image\/)/i.test(candidate)
          ? candidate
          : svgArt(s);
      };
      function togglePassword(id, button) {
        const input = document.getElementById(id);
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
        if (button) button.textContent = input.type === "password" ? "Show" : "Hide";
      }

      /* ================= validation helpers (shared by sign-up, booking and account) ================= */
      const PH_RE = /^09\d{9}$/, // Philippine mobile: exactly 11 digits, starts with 09
        NAME_RE = /^[\p{L}][\p{L} .'-]{1,59}$/u,
        USER_RE = /^[A-Za-z0-9._]{3,20}$/,
        EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/,
        fmtPhone = (p) => (PH_RE.test(p || "") ? p.slice(0, 4) + " " + p.slice(4, 7) + " " + p.slice(7) : p || "");
      const hint = (id, text, cls = "") => {
        const h = document.getElementById(id + "_h");
        if (h) { h.className = "fhint " + cls; h.textContent = text; }
        const i = document.getElementById(id);
        if (i) i.classList.toggle("bad", cls === "err");
      };
      const shake = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove("shake"); requestAnimationFrame(() => el.classList.add("shake"));
      };
      // Numbers-only inputs (mobile number, ZIP). Letters/symbols are blocked as you type AND stripped from pastes.
      const numFld = (id, l, v, max, ph, help) =>
        `<label for="${id}">${l}</label><div class="numwrap"><input id="${id}" type="text" inputmode="numeric" autocomplete="${max === 11 ? "tel-national" : "postal-code"}" maxlength="${max}" placeholder="${ph}" value="${esc(v)}" data-max="${max}" onkeydown="numKey(event)" oninput="numInput(this)"><small class="cnt" id="${id}_c">${String(v || "").length}/${max}</small></div><small class="fhint" id="${id}_h">${help}</small>`;
      const phoneFld = (id, l, v) => numFld(id, l, v, 11, "09XXXXXXXXX", "11 digits, starts with 09. Numbers only.");
      function numKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return; // allow shortcuts, arrows, backspace, tab
        if (!/\d/.test(e.key)) { e.preventDefault(); hint(e.target.id, "Numbers only. Letters and special characters are not allowed.", "err"); shake(e.target.id); }
      }
      function numInput(el) {
        const max = +el.dataset.max, raw = el.value, v = raw.replace(/\D/g, "").slice(0, max);
        if (raw !== v) el.value = v;
        const c = document.getElementById(el.id + "_c");
        if (c) { c.textContent = v.length + "/" + max; c.classList.toggle("full", v.length === max); }
        if (/\D/.test(raw)) { hint(el.id, "Numbers only. Letters and special characters were removed.", "err"); shake(el.id); return; }
        if (max === 11) {
          if (!v) hint(el.id, "11 digits, starts with 09. Numbers only.");
          else if (!/^0(9\d*)?$/.test(v.slice(0, 2))) hint(el.id, "Mobile numbers start with 09.", "err");
          else if (v.length < 11) hint(el.id, 11 - v.length + " more digit" + (v.length === 10 ? "" : "s") + " to go.");
          else hint(el.id, "✓ Valid mobile number", "good");
        } else {
          hint(el.id, v.length === max ? "✓" : "4-digit ZIP code", v.length === max ? "good" : "");
        }
      }

      // Password rules for new accounts.
      const PWR = [
        ["At least 8 characters", (p) => p.length >= 8],
        ["One uppercase letter (A-Z)", (p) => /[A-Z]/.test(p)],
        ["One lowercase letter (a-z)", (p) => /[a-z]/.test(p)],
        ["One number (0-9)", (p) => /\d/.test(p)],
        ["One special character (! @ # $ % & * ? ...)", (p) => /[^A-Za-z0-9\s]/.test(p)],
        ["No spaces", (p) => p.length > 0 && !/\s/.test(p)],
        ["Does not contain your name or email", (p, ctx) => p.length > 0 && !ctx.some((w) => w.length >= 3 && p.toLowerCase().includes(w))],
      ];
      const pwCtx = () => {
        const n = ($("#su_n") || {}).value || "", e = ($("#su_e") || {}).value || "";
        return [...n.toLowerCase().split(/\s+/), e.toLowerCase().split("@")[0]].filter(Boolean);
      };
      const pwResults = (p) => PWR.map(([t, f]) => [t, f(p, pwCtx())]);
      function pwCheck() {
        const p = ($("#su_w") || {}).value || "", p2 = ($("#su_w2") || {}).value || "", R = pwResults(p),
          passed = R.filter((r) => r[1]).length, score = p ? Math.min(4, Math.floor((passed / R.length) * 3 + (p.length >= 12 ? 1 : 0))) : 0,
          L = ["", "Weak", "Fair", "Good", "Strong"];
        const list = $("#pwl");
        if (list) list.innerHTML = R.map(([t, ok]) => `<li class="${ok ? "ok" : ""}">${ok ? "✓" : "•"} ${t}</li>`).join("");
        const m = $("#pwm");
        if (m) { m.dataset.s = passed === R.length ? Math.max(3, score) : Math.min(score, 2); m.querySelector("b").textContent = p ? L[m.dataset.s] : ""; }
        if ($("#su_w2_h")) {
          if (!p2) hint("su_w2", "Type the same password again.");
          else hint("su_w2", p2 === p ? "✓ Passwords match" : "Passwords do not match yet.", p2 === p ? "good" : "err");
        }
      }

      // Address: stored in profiles.address as "Street, Brgy. X, City, Province, 1234" and split back into fields.
      const PROVINCES = "Metro Manila,Abra,Agusan del Norte,Agusan del Sur,Aklan,Albay,Antique,Apayao,Aurora,Basilan,Bataan,Batanes,Batangas,Benguet,Biliran,Bohol,Bukidnon,Bulacan,Cagayan,Camarines Norte,Camarines Sur,Camiguin,Capiz,Catanduanes,Cavite,Cebu,Cotabato,Davao de Oro,Davao del Norte,Davao del Sur,Davao Occidental,Davao Oriental,Dinagat Islands,Eastern Samar,Guimaras,Ifugao,Ilocos Norte,Ilocos Sur,Iloilo,Isabela,Kalinga,La Union,Laguna,Lanao del Norte,Lanao del Sur,Leyte,Maguindanao del Norte,Maguindanao del Sur,Marinduque,Masbate,Misamis Occidental,Misamis Oriental,Mountain Province,Negros Occidental,Negros Oriental,Northern Samar,Nueva Ecija,Nueva Vizcaya,Occidental Mindoro,Oriental Mindoro,Palawan,Pampanga,Pangasinan,Quezon,Quirino,Rizal,Romblon,Samar,Sarangani,Siquijor,Sorsogon,South Cotabato,Southern Leyte,Sultan Kudarat,Sulu,Surigao del Norte,Surigao del Sur,Tarlac,Tawi-Tawi,Zambales,Zamboanga del Norte,Zamboanga del Sur,Zamboanga Sibugay".split(","),
        NCR = "Quezon City,Manila,Caloocan,Las Piñas,Makati,Malabon,Mandaluyong,Marikina,Muntinlupa,Navotas,Parañaque,Pasay,Pasig,Pateros,San Juan,Taguig,Valenzuela".split(",");
      const parseAddr = (s) => {
        s = (s || "").trim();
        const parts = s.split(",").map((x) => x.trim());
        if (parts.length >= 5 && /^\d{4}$/.test(parts[parts.length - 1])) {
          const zip = parts.pop(), prov = parts.pop(), city = parts.pop(), brgy = parts.pop().replace(/^(brgy\.?|barangay)\s*/i, "");
          return { street: parts.join(", "), brgy, city, prov, zip };
        }
        return { street: s, brgy: "", city: "", prov: "", zip: "" };
      };
      const fmtAddr = (a) => (a.street || a.brgy || a.city || a.prov || a.zip ? `${a.street}, Brgy. ${a.brgy}, ${a.city}, ${a.prov}, ${a.zip}` : "");
      const ADDR_CHECK = {
        street: (v) => (/^(?=.*\p{L})[\p{L}\d .,'#/()-]{5,120}$/u.test(v) ? "" : "Enter your house/unit number and street (at least 5 characters)."),
        brgy: (v) => (/^(?=.*[\p{L}\d])[\p{L}\d .'-]{1,60}$/u.test(v) ? "" : "Enter your barangay (letters and numbers only)."),
        city: (v) => (/^[\p{L}][\p{L} .'-]{2,59}$/u.test(v) ? "" : "Enter your city or municipality (letters only)."),
        prov: (v) => (/^[\p{L}][\p{L} .'-]{2,59}$/u.test(v) ? "" : "Enter your province (letters only)."),
        zip: (v) => (/^\d{4}$/.test(v) ? "" : "ZIP codes are exactly 4 numbers."),
      };

      // Confirmation dialog helper: every important action asks first.
      const ask = (title, body, yesLabel, yesCall, noLabel = "Cancel") =>
        modal(`<div class="dlg"><h3>${title}</h3>${body}${MF(`<button class="btn w" onclick="modal()">${noLabel}</button><button class="btn" id="dlg_yes" onclick="${yesCall}">${yesLabel}</button>`)}</div>`);
      const tick = '<svg class="tick" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg>';

      const GR = [
          "Basic Care",
          "Gel Services",
          "Relaxation",
          "Nail Enhancements",
          "Packages",
          "Removal",
          "Nail Art Add-Ons",
          "Per Nail Add-Ons",
        ],
        GN = {
          "Per Nail Add-Ons":
            "Price per nail. Only applies if you prefer not to get a full set of nail art.",
        };
      const SV = [],
        TE0 = [];
      
      // In-memory view of server data (hydrated by boot()). Nothing is persisted in localStorage.
      let DB = {
        SV, TE: TE0, hours: { o: 600, c: 1110, ls: 720, le: 780 }, openDays: [1, 2, 3, 4, 5, 6],
        owner: null, sms: [], off: [], appts: [], q: [], users: [], staff: [], backup: null,
        deposit: 250, test: true,
      };
      const TE = DB.TE;
      const save = () => {};
      
      
      
      function sms(a, type, msg) {
        DB.sms = DB.sms || [];
        DB.sms.push({ t: Date.now(), to: a.phone, code: a.code, type, msg });
        if (DB.sms.length > 200) DB.sms.splice(0, DB.sms.length - 200);
        save();
      }
      const SVA = () => DB.SV.filter((s) => s.on !== false),
        DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const openTxt = () => {
        const d = [...DB.openDays].sort((a, b) => a - b),
          r = [];
        d.forEach((x) => {
          const l = r[r.length - 1];
          if (l && l[1] === x - 1) l[1] = x;
          else r.push([x, x]);
        });
        return (
          r
            .map(([a, b]) =>
              a === b
                ? DN[a]
                : b === a + 1
                  ? DN[a] + " and " + DN[b]
                  : DN[a] + " to " + DN[b],
            )
            .join(", ") || "by appointment"
        );
      };
      
      
      const sess = () => null;

      
      let V = "customer",
        P = "home",
        U = null,
        ST = null,
        B = { step: 0 },
        tab = GR[0],
        MT = "Upcoming",
        F = { q: "", s: "", k: "time", c: "" };
      V = "customer";
      P = "home";
      {
        const SS = sess();
        if (SS && SS.role === "customer")
          U = DB.users.find((x) => x.id === SS.id) || null;
        const hp = location.hash.slice(1);
        if (["home", "services", "gallery", "about", "login", "signup", "forgot", "book", "mine", "acct"].includes(hp)) P = hp;
      }
      const te = (id) => (TE.find((x) => x.id === id) || { n: "Unassigned" }).n,
        LB = {
          pending: "Awaiting payment",
          verifying: "Waiting for confirmation",
          expired: "Expired",
          confirmed: "Confirmed",
          waiting: "Waiting",
          service: "In service",
          completed: "Completed",
          cancelled: "Cancelled",
          noshow: "No-show",
          refunded: "Refunded",
          voided: "Voided",
        };
      const pill = (s) => `<span class="pill ${s}">${LB[s]}</span>`;
      const modal = (h) => {
        document.body.classList.remove("rcp");
        $("#md").innerHTML = h
          ? `<div class="mb" onclick="if(event.target===this)modal()"><div class="mc">${h}</div></div>`
          : "";
      };
      const MF = (c) =>
        `<p class="row" style="justify-content:flex-end;margin-bottom:0">${c}</p>`;
      // Set while the live catalog is still loading behind an already-visible public page (see boot()).
      const QUICK = ["home", "gallery", "about"];
      let BOOTED = false, BOOT_P = null;
      function go(p) {
        if (!BOOTED && BOOT_P && !QUICK.includes(p)) { // this page needs live data: wait for it behind the loading screen
          const w = BOOT_P;
          (window.Loader ? Loader.run("Gathering services & prices…", () => w) : w).then(() => (BOOTED ? go(p) : ((P = p), boot())));
          return;
        }
        P = p;
        if (p === "book" && B.done) B = { step: 0 };
        render();
        scrollTo(0, 0);
        if (p === "gallery") refreshGallery();
      }
      const prs = (s) =>
          s.px ? php(s.p) + " to " + php(s.px) : s.p ? php(s.p) : "FREE",
        dus = (s) =>
          (s.dx ? durT(s.d) + " to " + durT(s.dx) : durT(s.d)) +
          (s.x ? " · " + s.x : "");
      const fld = (id, l, t = "text", v = "") =>
        `<label>${l}</label><input id="${id}" type="${t}" value="${esc(v)}">`;
      const IMG = {
        florals:
          "img/florals.jpg",
        dark: "img/dark.jpg",
        lace: "img/lace.jpg",
        emerald:
          "img/emerald.jpg",
        blue: "img/blue.jpg",
        fruit:
          "img/fruit.jpg",
        star: "img/star.jpg",
      };
      // Photos come from the owner portal (FN.loadGallery). If that is unavailable, the bundled defaults keep the page working.
      const GAL_DEFAULT = [["florals", "3D florals"], ["dark", "Dark embellished"], ["lace", "Lace & florals"], ["emerald", "Emerald & gold"], ["blue", "Deep blue"], ["fruit", "Fruit salad"], ["star", "Star nails"]]
        .map(([k, title]) => ({ url: IMG[k], title, focus: "center" }));
      let GAL = null;
      // Home-page collage keeps using the bundled photos directly.
      let phN = 0; // the first hero photos are the largest thing on screen: load them first, as small WebP files
      const ph = (k, l, c) =>
        `<div class="ph ${c}"><picture><source srcset="img/${k}.webp" type="image/webp"><img src="${IMG[k]}" alt="${l} nail art" width="271" height="${c === "t1" ? 320 : 230}" ${phN++ < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture><span>▣ ${l}</span></div>`;
      const TILE = ["a", "b", "a", "b", "c", "c", "c"]; // staggered tile shapes; any photo is cropped to fit its tile
      const galTile = (g, i) =>
        `<div class="ph ${TILE[i % TILE.length]}"><img src="${esc(g.url)}" alt="${esc(g.title)} nail art" loading="lazy" style="object-position:center ${g.focus || "center"}"><span>▣ ${esc(g.title)}</span></div>`;
      const galTiles = () => {
        const list = GAL || GAL_DEFAULT;
        return list.length ? list.map(galTile).join("") : '<p class="mute" style="grid-column:1/-1">New photos are coming soon.</p>';
      };
      async function refreshGallery() { // pick up photo changes made in the owner portal
        try { GAL = await FN.loadGallery(); if (P === "gallery" && !$("#md").innerHTML) render(); } catch (e) { /* keep what we have */ }
      }
      const gallery = () =>
        `<section class="sec" style="padding-bottom:1rem"><div class="wrap"><small style="letter-spacing:.14em;border-bottom:1px solid var(--ink)">GALLERY</small><h2 style="margin-top:.6rem">Recent nail art</h2><p class="mute" style="max-width:32rem;margin:0 0 1.4rem">Cat-eye, chrome, 3D florals, fruit sets and more, all hand-made, one set at a time.</p><div class="gal">${galTiles()}</div><p style="margin-top:1.6rem"><a class="btn o" style="display:inline-block;text-decoration:none" href="https://www.facebook.com/" target="_blank" rel="noopener">See more on Facebook</a></p></div></section>`;
      const home =
        () => (phN = 0, `<section class="hero"><div class="wrap two"><div><span class="tag"><span style="color:var(--red)">✦</span> HOME-BASED NAIL STUDIO</span><h1>Nails with a little bit of <em>magic</em>.</h1><p style="max-width:30rem">Gel care, soft-gel extensions and hand-crafted nail art. Choose your services, pick a time, and book your slot online.</p><p><button class="btn o" onclick="go('services')">See services &amp; prices</button></p></div><div class="hp"><div>${ph("florals", "3D florals", "t1")}${ph("lace", "Lace & florals", "t3")}</div><div>${ph("dark", "Dark embellished", "t3")}${ph("emerald", "Emerald & gold", "t1")}</div></div></div></section>${gallery()}
<section class="sec"><div class="wrap"><small>OUR FAVORITES</small><div class="row"><h2>Pick your little luxury</h2><a class="pr" href="#services" onclick="event.preventDefault();go('services')">View all services →</a></div><div class="cards">${[
          [
            "Basic Care",
            "var(--sage)",
            "❀",
            "Basic Care",
            "The classics, made special",
          ],
          [
            "Gel Services",
            "var(--pink)",
            "♡",
            "Gel Services",
            "Glossy color that lasts",
          ],
          [
            "Nail Art Add-Ons",
            "var(--beige)",
            "✦",
            "Nail Art Add-Ons",
            "Tiny works of art, for you",
          ],
        ]
          .map(
            (c) =>
              `<button class="fav" style="background:${c[1]}" onclick="svJump('${c[3]}')"><span class="ic">${c[2]}</span><span><h3 style="margin:0">${c[3]}</h3><small>${c[4]}</small><br>${(() => { const L = SVA().filter((s) => s.g === c[3] && s.p > 0).map((s) => s.p); return L.length ? `<b class="pr" style="font-size:.8rem">from ${php(Math.min(...L))}</b>` : ""; })()}</span></button>`,
          )
          .join("")}</div></div></section>
<section class="band"><small style="color:#dfe8d4;letter-spacing:.12em">EASY AS 1-2-3-4</small><h2>Your appointment, made simple</h2><div class="wrap steps4">${[
          ["Choose a service", "Browse services and pick what feels right."],
          ["Pick a time", "Find a date and slot that fits your day."],
          [
            "Pay the ₱" + DB.deposit + " reservation",
            "Pay the deposit online to hold your slot.",
          ],
          ["Get confirmed", "We'll send all the details straight to you."],
        ]
          .map(
            (s, i) =>
              `<div><b>0${i + 1}</b><h3>${s[0]}</h3><p>${s[1]}</p></div>`,
          )
          .join("")}</div></section>`);
      const W = (x, w = 680) =>
        `<section class="sec"><div class="wrap" style="max-width:${w}px">${x}</div></section>`;
      /* ---------- forgot password: email a reset link, then choose a new password ---------- */
      let FG = {}, RS = null; // FG: { sent, err, busy }  RS: "reset" | "expired" | "done"
      const forgot = () =>
        W(FG.sent
          ? `<div class="card auth"><h2>Check your email</h2><p>If an account uses <b>${esc(FG.email)}</b>, we've sent it a link to reset your password. The link works once and expires after about an hour.</p><p class="mute">Not there after a few minutes? Check your spam or promotions folder, or <a class="pr" style="cursor:pointer" onclick="FG={email:FG.email};render()">send it again</a>.</p><p><button class="btn" style="width:100%" onclick="go('login')">Back to log in</button></p></div>`
          : `<div class="card auth"><h2>Forgot your password?</h2><p class="mute">Enter the email (or username) on your account and we'll send you a link to set a new password.</p><label for="fg_e">Email or username</label><input id="fg_e" type="text" autocomplete="username" autocapitalize="none" placeholder="you@example.com" value="${esc(FG.email || "")}" onkeydown="if(event.key==='Enter')doForgot()">${FG.err ? `<div class="msg">${esc(FG.err)}</div>` : ""}<p><button class="btn" style="width:100%" ${FG.busy ? "disabled" : ""} onclick="doForgot()">${FG.busy ? "Sending..." : "Send reset link"}</button></p><small>Remembered it? <a class="pr" href="#login" onclick="event.preventDefault();go('login')">Log in</a></small></div>`,
          460);
      async function doForgot() {
        const e = (($("#fg_e") || {}).value || "").trim();
        FG.email = e;
        if (!e) { FG.err = "Enter your email address."; return render(); }
        FG.busy = true; FG.err = ""; render();
        try { await FN.sendPasswordReset(e); FG.sent = true; }
        catch (x) { FG.err = x.message; }
        FG.busy = false; render();
      }
      const reset = () => {
        if (RS === "done")
          return W(`<div class="card auth"><h2>Password updated</h2><p>Your new password is saved and you're logged in.</p><p><button class="btn" style="width:100%" onclick="RS=null;go('mine')">Go to my appointments</button></p></div>`, 460);
        if (RS !== "reset")
          return W(`<div class="card auth"><h2>This link has expired</h2><p>Password reset links work only once and expire after about an hour. Please ask for a new one.</p><p><button class="btn" style="width:100%" onclick="RS=null;FG={};go('forgot')">Send a new link</button></p></div>`, 460);
        return W(`<div class="card auth"><h2>Choose a new password</h2><p class="mute">Pick a strong password you haven't used before.</p><label for="su_w">New password</label><div class="pwrow"><input id="su_w" type="password" autocomplete="new-password" placeholder="Create a strong password" maxlength="72" oninput="pwCheck()"><button class="eye" type="button" onclick="togglePassword('su_w',this)">Show</button></div><div class="pwm" id="pwm" data-s="0"><i></i><i></i><i></i><i></i><b></b></div><ul class="pwl" id="pwl">${PWR.map(([t]) => `<li>• ${t}</li>`).join("")}</ul><label for="su_w2">Confirm new password</label><div class="pwrow"><input id="su_w2" type="password" autocomplete="new-password" placeholder="Type it again" maxlength="72" oninput="pwCheck()" onkeydown="if(event.key==='Enter')doReset()"><button class="eye" type="button" onclick="togglePassword('su_w2',this)">Show</button></div><small class="fhint" id="su_w2_h">Type the same password again.</small><div id="ae"></div><p><button class="btn" style="width:100%" onclick="doReset()">Save new password</button></p></div>`, 460);
      };
      async function doReset() {
        const w = $("#su_w").value, w2 = $("#su_w2").value, failed = pwResults(w).filter((r) => !r[1]).map((r) => r[0]);
        if (failed.length) { err("Your password still needs: " + failed.map((t) => t[0].toLowerCase() + t.slice(1)).join(", ") + "."); shake("su_w"); pwCheck(); return; }
        if (w !== w2) { err("The two passwords do not match."); shake("su_w2"); return; }
        try {
          await FN.updatePassword(w);
          RS = "done";
          if (!(await startSession())) { RS = null; return go("login"); } // staff/owner account: sign in through their page
          render();
        } catch (e) { err(e.message); }
      }
      const login = () =>
        W(
          `<div class="card auth"><h2>Welcome back</h2><p class="mute">Log in to manage your appointments and bookings.</p><label for="li_u">Email or username</label><input id="li_u" type="text" autocomplete="username" autocapitalize="none" placeholder="you@example.com"><label for="li_p">Password</label><div class="pwrow"><input id="li_p" type="password" autocomplete="current-password" placeholder="Enter your password" onkeydown="if(event.key==='Enter')doLogin()"><button class="eye" type="button" onclick="togglePassword('li_p',this)">Show</button></div><p style="margin:.4rem 0 0;text-align:right"><a class="pr" href="#forgot" onclick="event.preventDefault();FG={};go('forgot')"><small>Forgot password?</small></a></p><div id="ae"></div><p><button class="btn" style="width:100%" onclick="doLogin()">Log in</button></p><small>New here? <a class="pr" href="#signup" onclick="event.preventDefault();go('signup')">Create an account</a></small></div>`,
          460,
        );
      const gate = () =>
        W(
          `<h2>Log in to continue</h2><p class="mute">Create an account or log in to book and manage appointments.</p><button class="btn" onclick="go('login')">Log in</button> <button class="btn w" onclick="go('signup')">Sign up</button>`,
          420,
        );
      /* ---------- Services & Prices: regular services, packages, nail art and add-ons ---------- */
      let SVT = "All";
      const FAM = [
        ["Services", (g) => !/package|add-on|nail art/i.test(g), "Manicures, pedicures, gel, spa, extensions and removal"],
        ["Packages", (g) => /package/i.test(g), "Bundles at a better price than booking each one separately"],
        ["Nail Art & Add-Ons", (g) => /add-on|nail art/i.test(g), "Designs and extras added on top of a manicure or gel service"],
      ];
      const famOf = (g) => (FAM.find((f) => f[1](g)) || FAM[0])[0];
      const perNail = (s) => /per nail/i.test(s.g || "");
      const prs2 = (s) => prs(s) + (perNail(s) && s.p ? '<small class="unit"> / nail</small>' : "");
      function svJump(g) { SVT = famOf(g); go("services"); setTimeout(() => { const el = document.getElementById("g-" + g.replace(/\W+/g, "-")); el && el.scrollIntoView({ block: "start" }); }, 60); }
      function bookWith(id) {
        const s = DB.SV.find((x) => x.id === id);
        B = { step: 0, sel: [id], cat: s ? s.g : undefined };
        go("book");
      }
      // "Includes: A + B + C (save ₱101)" -> ["A","B","C"], "save ₱101"
      const pkgParts = (x) => {
        const save = ((x || "").match(/\(([^)]*save[^)]*)\)/i) || [])[1] || "";
        const inc = (x || "").replace(/\([^)]*\)/g, "").replace(/^\s*includes?:\s*/i, "");
        return { items: /\+/.test(inc) ? inc.split("+").map((t) => t.trim()).filter(Boolean) : inc.trim() ? [inc.trim()] : [], save };
      };
      const svcRow = (s) =>
        `<div class="svrow"><span class="svr"><img class="svt" src="${svImg(s)}" alt="Illustration for ${esc(s.n)}" loading="lazy"><span><b>${esc(s.n)}</b>${s.x ? `<br><small>${esc(s.x)}</small>` : ""}<br><small class="dur">⏱ ${s.dx ? durT(s.d) + " to " + durT(s.dx) : durT(s.d)}</small></span></span><span class="svbuy"><b class="pr">${prs2(s)}</b><button class="btn sm w" onclick="bookWith(${s.id})">Book</button></span></div>`;
      const pkgCard = (s) => {
        const { items, save } = pkgParts(s.x);
        return `<div class="pkg"><div class="pkg-top"><span class="pkg-tag">PACKAGE</span>${save ? `<span class="pkg-save">${esc(save)}</span>` : ""}</div><img class="pkg-img" src="${svImg(s)}" alt="" loading="lazy"><h3>${esc(s.n)}</h3>${items.length ? `<ul>${items.map((i) => `<li>✦ ${esc(i)}</li>`).join("")}</ul>` : ""}<div class="pkg-foot"><span><b class="pr big">${prs(s)}</b><br><small>⏱ ${s.dx ? durT(s.d) + " to " + durT(s.dx) : durT(s.d)}</small></span><button class="btn sm" onclick="bookWith(${s.id})">Book this package</button></div></div>`;
      };
      const artTile = (s) =>
        `<div class="art"><img class="svt" src="${svImg(s)}" alt="" loading="lazy"><div><b>${esc(s.n)}</b>${s.x ? `<small>${esc(s.x)}</small>` : ""}</div><div class="art-f"><b class="pr">${prs2(s)}</b><button class="btn sm w" onclick="bookWith(${s.id})">Add</button></div></div>`;
      const groupBlock = (g) => {
        const L = SVA().filter((s) => s.g === g);
        if (!L.length) return "";
        const fam = famOf(g), id = "g-" + g.replace(/\W+/g, "-");
        const body = fam === "Packages" ? `<div class="pkgs">${L.map(pkgCard).join("")}</div>`
          : fam === "Nail Art & Add-Ons" ? `<div class="arts">${L.map(artTile).join("")}</div>`
          : `<div class="card list">${L.map(svcRow).join("")}</div>`;
        return `<div class="grp" id="${id}"><div class="grp-h">${g.toLowerCase() === fam.toLowerCase() ? "<span></span>" : `<h3>${esc(g)}</h3>`}<small>${L.length} option${L.length > 1 ? "s" : ""} · from ${php(Math.min(...L.map((s) => s.p)))}${perNail(L[0]) ? " / nail" : ""}</small></div>${GN[g] ? `<p class="mute grp-note">${esc(GN[g])}</p>` : ""}${body}</div>`;
      };
      const services = () => {
        const fams = SVT === "All" ? FAM : FAM.filter((f) => f[0] === SVT);
        return W(
          `<h2>Services &amp; Prices</h2><p class="mute">Prices in Philippine pesos. A ₱${DB.deposit} reservation deposit holds your slot and is deducted from your bill. Nail art prices are confirmed after the salon reviews your reference design.</p>
<div class="svnav" role="tablist">${["All", ...FAM.map((f) => f[0])].map((t) => `<button role="tab" class="chip ${SVT === t ? "on" : ""}" onclick="SVT='${t}';render()">${t}${t === "All" ? "" : ` <small>(${SVA().filter((s) => FAM.find((f) => f[0] === t)[1](s.g || "")).length})</small>`}</button>`).join("")}</div>
${fams.map(([name, test, blurb]) => {
            const groups = GR.filter(test).map(groupBlock).join("");
            return `<section class="fam"><div class="fam-h"><h2>${name}</h2><small>${blurb}</small></div>${groups || `<div class="card mute">No ${name.toLowerCase()} are listed yet. Please check back soon.</div>`}</section>`;
          }).join("")}
`,
          900,
        );
      };
      const about = () =>
        W(
          `<h2>About us</h2><div class="card"><p>A cozy salon in Quezon City with 7 stations and 8 technicians.</p><p class="mute">Open ${openTxt()}, ${m2t(DB.hours.o)} to ${m2t(DB.hours.c)}. Lunch break ${m2t(DB.hours.ls)} to ${m2t(DB.hours.le)}. Follow us on Instagram: @fairytalenails</p></div>`,
        );
      const signup = () =>
        W(
          `<div class="card auth"><h2>Create your account</h2><p class="mute">Create an account to book appointments and manage your visits.</p><label for="su_n">Full name</label><input id="su_n" autocomplete="name" placeholder="e.g. Maria Santos" maxlength="60" oninput="pwCheck()"><label for="su_e">Email address</label><input id="su_e" type="email" autocomplete="email" placeholder="you@example.com" oninput="pwCheck()">${phoneFld("su_p", "Mobile number", "")}<label for="su_w">Password</label><div class="pwrow"><input id="su_w" type="password" autocomplete="new-password" placeholder="Create a strong password" maxlength="72" oninput="pwCheck()"><button class="eye" type="button" onclick="togglePassword('su_w',this)">Show</button></div><div class="pwm" id="pwm" data-s="0"><i></i><i></i><i></i><i></i><b></b></div><ul class="pwl" id="pwl">${PWR.map(([t]) => `<li>• ${t}</li>`).join("")}</ul><label for="su_w2">Confirm password</label><div class="pwrow"><input id="su_w2" type="password" autocomplete="new-password" placeholder="Type it again" maxlength="72" oninput="pwCheck()" onkeydown="if(event.key==='Enter')doSignup()"><button class="eye" type="button" onclick="togglePassword('su_w2',this)">Show</button></div><small class="fhint" id="su_w2_h">Type the same password again.</small><div id="ae"></div><p><button class="btn" style="width:100%" onclick="doSignup()">Create account</button></p><small>Already have an account? <a class="pr" href="#login" onclick="event.preventDefault();go('login')">Log in</a></small></div>`,
          480,
        );
      /* booking */
      // Topics a service or a technician's specialty covers, used to recommend technicians.
      const TOPIC = { gel: /gel|biab/i, ext: /extension|biab|polygel|enhancement/i, pedi: /pedi/i, mani: /mani/i, spa: /spa|massage|paraffin|relax/i, art: /\bart\b|design|chrome|ombre|french|rhinestone|charm|sticker|decal|flower|floral|character|glitter|portrait|3d/i, basic: /basic|classic|regular|kids|cleaning/i, removal: /removal/i };
      const TW = { ext: 2, spa: 2, art: 2, removal: 2 }; // specialist skills count more than general ones
      const topics = (txt) => Object.keys(TOPIC).filter((k) => TOPIC[k].test(txt));
      function techFit(t, svcs) {
        const tt = topics(t.sp || "");
        let n = 0; const names = [];
        for (const s of svcs) { const hit = topics(s.n + " " + (s.g || "")).filter((k) => tt.includes(k)).reduce((x, k) => x + (TW[k] || 1), 0); if (hit) { n += hit; names.push(s.n); } }
        return { n, names };
      }
      const sel = () => DB.SV.filter((s) => (B.sel || []).includes(s.id)),
        sm = (k, k2) =>
          sel().reduce((t, s) => t + (k2 ? s[k2] || s[k] : s[k]), 0);
      const dmax = () => sm("d", "dx"),
        prr = () =>
          sm("p") === sm("p", "px")
            ? php(sm("p"))
            : php(sm("p")) + " to " + php(sm("p", "px")),
        dur = () =>
          sm("d") === dmax()
            ? durT(dmax())
            : durT(sm("d")) + " to " + durT(dmax());
      
      function tg(id) {
        B.sel = B.sel || [];
        B.sel = B.sel.includes(id)
          ? B.sel.filter((x) => x !== id)
          : [...B.sel, id];
        B.slot = null;
        render();
      }
      function cal() {
        const n = new Date(),
          m = new Date(n.getFullYear(), n.getMonth() + (B.mo || 0), 1),
          dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(),
          t0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
        let c = "<span></span>".repeat(m.getDay());
        for (let d = 1; d <= dim; d++) {
          const dt = new Date(m.getFullYear(), m.getMonth(), d),
            iso = fmt(dt);
          c += `<button ${dt < t0 || !DB.openDays.includes(dt.getDay()) || DB.off.includes(iso) ? "disabled" : ""} class="${B.date === iso ? "on" : ""}" onclick="B.date='${iso}';B.slot=null;render()">${d}</button>`;
        }
        return `<div class="row" style="max-width:360px"><button class="btn sm w" ${B.mo ? "" : "disabled"} onclick="B.mo=0;render()">‹</button><b>${m.toLocaleString("en", { month: "long", year: "numeric" })}</b><button class="btn sm w" onclick="B.mo=1;render()">›</button></div><div class="cal">${["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((x) => `<b>${x}</b>`).join("")}${c}</div>`;
      }
      const bfl = (d) =>
          new Date(d + "T00:00").toLocaleDateString("en", {
            weekday: "short",
            month: "short",
            day: "numeric",
          }),
        BLB = {
          svc: "Services",
          tech: "Tech",
          time: "Time",
          review: "Review",
          confirm: "Confirm",
        };
      // Services -> technician (or "any available") -> time. Picking "any" covers the old "book by time" path.
      const bord = () => ["svc", "tech", "time", "review", "confirm"],
        bidx = (k) => bord().indexOf(k);
      const bsum = () =>
        `<div class="card" style="position:sticky;top:90px"><b>Your booking</b>${
          sel().length
            ? sel()
                .map(
                  (s) =>
                    `<div class="row" style="padding:.35rem 0;border-bottom:1px solid var(--line)"><span>${s.n}<br><small>${dus(s)}</small></span><b class="pr">${prs(s)}</b></div>`,
                )
                .join("")
            : '<p class="mute">No services selected yet.</p>'
        }${B.tech || bidx("tech") < B.step ? `<p style="margin:.7rem 0 0"><small>Technician</small><br><b>${B.tech ? esc(te(B.tech)) : "Any available technician"}</b></p>` : ""}${B.slot != null ? `<p style="margin:.5rem 0 0"><small>Date and time</small><br><b>${bfl(B.date)} at ${m2t(B.slot)}</b></p>` : ""}${sel().length ? `<div class="row" style="margin-top:.8rem"><small>Estimated duration</small><b>${dur()}</b></div><div class="row"><small>Estimated total</small><b class="pr">${prr()}</b></div>` : ""}<small>The salon confirms final nail art prices.</small></div>`;
      // Changing technician clears the chosen time, since each technician has different free slots.
      function pickT(id) {
        if ((B.tech || 0) !== id) { B.slot = null; B.warn = ""; }
        B.tech = id;
        render();
      }
      function book() {
        if (!U) return gate();
        if (PAY) return payView();
        if (B.done) {
          const a = B.done;
          return W(
            `<h2>${a.status === "confirmed" ? "Booking confirmed" : "Booking received"}</h2><div class="card"><p>Confirmation number <b>${a.code}</b></p><p>${a.svc}<br>${a.staff ? "with " + esc(te(a.staff)) + " · " : ""}${bfl(a.date)} at ${m2t(a.start)} · ${a.estD}<br>Estimated ${a.estP}</p><p><b>Status: ${a.status === "confirmed" ? "Confirmed" : "Awaiting deposit"}.</b> ${a.status === "confirmed" ? "Your ₱" + DB.deposit + " deposit was recorded and your time slot is reserved." : "Your time slot is held for a few minutes. Open My Appointments to pay the deposit."}</p></div><p><button class="btn" onclick="B={step:0};go(U?'mine':'home')">${U ? "View my appointments" : "Done"}</button></p>`,
          );
        }
        const o = bord(),
          k = o[B.step],
          tm = false,
          tid = tm ? 0 : B.tech || 0,
          rs = tm ? "B.tech=0;" : "";
        const prog = `<div class="stepper" role="list">${o.map((x, i) => `<div class="stp ${i < B.step ? "done" : i === B.step ? "cur" : ""}" role="listitem"><span class="dot">${i < B.step ? "✓" : i + 1}</span><small>${BLB[x]}</small></div>${i < o.length - 1 ? `<i class="ln ${i < B.step ? "done" : ""}"></i>` : ""}`).join("")}</div>`;
        let h = "",
          ok = true,
          cont = true;
        if (k === "svc") {
          ok = !!sel().length;
          const gs = GR.filter((g) => SVA().some((s) => s.g === g)),
            cat = gs.includes(B.cat) ? B.cat : gs[0];
          h = `<h3>Select services</h3><small>You can pick more than one.</small><div class="tabs" style="flex-wrap:wrap">${gs.map((g) => `<button class="${cat === g ? "on" : ""}" onclick="B.cat='${g}';render()">${g}</button>`).join("")}</div>${GN[cat] ? `<small>${GN[cat]}</small>` : ""}<div class="sg" style="margin-top:.6rem">${SVA()
            .filter((s) => s.g === cat)
            .map(
              (s) =>
                `<button class="opt ${(B.sel || []).includes(s.id) ? "on" : ""}" onclick="tg(${s.id})"><span class="svr"><img class="svt" src="${svImg(s)}" alt="" loading="lazy"><span><b>${esc(s.n)}</b><br><small>${dus(s)}</small></span></span><b class="pr">${prs(s)}</b></button>`,
            )
            .join(
              "",
            )}</div>${sel().some((s) => /Add-Ons/.test(s.g)) ? `<div class="msg ok">The final nail art price is confirmed after the salon reviews your reference design.</div><label>Reference photo (optional)</label><input type="file" accept="image/*" onchange="B.refFile=this.files[0]||null;B.ref=this.files[0]?this.files[0].name:'';render()">${B.ref ? `<small>Selected: ${esc(B.ref)}</small>` : ""}` : ""}`;
        }
        if (k === "tech") {
          const L0 = tm ? TE.filter((t) => free(B.date, dmax(), 0, t.id).includes(B.slot)) : TE;
          // Rank technicians by how many of the chosen services match their specialty; the top ones are highlighted.
          const picked = sel(), sc = Object.fromEntries(L0.map((t) => [t.id, techFit(t, picked)]));
          const top = Math.max(0, ...Object.values(sc).map((x) => x.n));
          const L = [...L0].sort((x, y) => sc[y.id].n - sc[x.id].n);
          const best = L.filter((t) => top > 0 && sc[t.id].n === top), good = L.filter((t) => !best.includes(t) && sc[t.id].n > 0), rest = L.filter((t) => !sc[t.id].n);
          const card = (t, b) => `<button class="opt ${B.tech === t.id ? "on" : ""}${b === 2 ? " best" : ""}" onclick="pickT(${t.id})"><span>${b === 2 ? '<span class="bestTag">★ Best match</span><br>' : ""}<b>${esc(t.n)}</b><br><small>${esc(t.sp)}${tm ? "" : " · day off " + DN[t.off]}</small>${b ? `<br><small class="bestWhy">${b === 2 ? "Great" : "Good"} for ${esc(sc[t.id].names.join(", "))}</small>` : ""}</span></button>`;
          h = `<h3>${tm ? "Technicians available at " + m2t(B.slot) : "Choose a technician"}</h3>${best.length ? `<p class="mute" style="margin:.2rem 0 .6rem">Recommended for your services</p><div class="sg">${best.map((t) => card(t, 2)).join("")}</div>${good.length ? `<h3 style="font-size:1rem;margin:1.1rem 0 .4rem">Also a good fit</h3><div class="sg">${good.map((t) => card(t, 1)).join("")}</div>` : ""}<h3 style="font-size:1rem;margin:1.1rem 0 .4rem">Other technicians</h3>` : ""}<div class="sg"><button class="opt ${!B.tech ? "on" : ""}" onclick="pickT(0)"><span><b>Any available technician</b><br><small>We will assign the best fit</small></span></button>${(best.length ? rest : L).map((t) => card(t, 0)).join("")}</div>`;
        }
        if (k === "time") {
          ok = B.slot != null;
          const t0 = new Date();
          t0.setHours(0, 0, 0, 0);
          const days = [...Array(7)].map((_, i) => {
              const d = new Date(t0);
              d.setDate(d.getDate() + (B.ds || 0) * 7 + i);
              return d;
            }),
            f = B.date ? free(B.date, dmax(), 0, tid) : [],
            grp = [
              ["Morning", (x) => x < 720],
              ["Afternoon", (x) => x >= 720 && x < 1020],
              ["Evening", (x) => x >= 1020],
            ];
          h = `<h3>Select date and time</h3><small>Estimated duration: ${dur()}${tid ? " · with " + esc(te(tid)) : ""}</small><div class="row" style="margin-top:.6rem"><button class="btn sm w" ${B.ds ? "" : "disabled"} onclick="B.ds--;render()" aria-label="Previous week">‹</button><b>${bfl(fmt(days[0]))} to ${bfl(fmt(days[6]))}</b><button class="btn sm w" ${(B.ds || 0) >= 7 ? "disabled" : ""} onclick="B.ds=(B.ds||0)+1;render()" aria-label="Next week">›</button></div><div class="dstrip">${days
            .map((d) => {
              const iso = fmt(d);
              return `<button class="chip ${B.date === iso ? "on" : ""}" ${free(iso, dmax(), 0, tid).length ? "" : "disabled"} onclick="${rs}B.date='${iso}';B.slot=null;render()"><small>${DN[d.getDay()]}</small><br><b>${d.getDate()}</b></button>`;
            })
            .join(
              "",
            )}</div>${B.warn ? `<div class="msg">${B.warn}</div>` : ""}${
            B.date
              ? grp
                  .map(([n, fn]) => {
                    const L = f.filter(fn);
                    return L.length
                      ? `<h3 style="font-size:1rem;margin:.8rem 0 .2rem">${n}</h3><div class="chips" style="margin-top:0">${L.map((t) => `<button class="chip ${B.slot === t ? "on" : ""}" onclick="${rs}B.slot=${t};B.warn='';render()">${m2t(t)}</button>`).join("")}</div>`
                      : "";
                  })
                  .join("") ||
                '<div class="msg">No times left that day. Pick another day.</div>'
              : '<p class="mute">Pick a day to see the available times.</p>'
          }`;
        }
        if (k === "review") {
          const n = B.name ?? (U ? U.name : ""), p = B.phone ?? (U ? U.phone : ""), e = B.email ?? (U ? U.email : ""),
            ed = B.editC, sN = ed || !NAME_RE.test((n || "").trim()), sP = ed || !PH_RE.test(p || ""), sE = ed || !EMAIL_RE.test(e || ""), known = !sN && !sP && !sE;
          h = `<h3>Review and your details</h3><small>Check the summary${known ? "." : ", then fill in the missing details."}</small>${known ? `<div class="card" style="margin:.8rem 0"><div class="row"><span><b>Booking for ${esc(n)}</b><br><small>${esc(fmtPhone(p))} · ${esc(e)}</small></span><a class="pr" style="cursor:pointer" onclick="B.editC=1;render()">Change</a></div></div>` : ""}${sN && !ed && !(n || "").trim() ? `<div class="msg ok">We don't have your name on file yet. Enter it once and we will remember it for your next bookings.</div>` : ""}${!ed && p && !PH_RE.test(p) ? `<div class="msg">Your saved mobile number "${esc(p)}" is not a complete 11-digit number. Please enter it again.</div>` : ""}${sN ? fld("b_n", "Name", "text", n) : ""}${sP ? phoneFld("b_p", "Mobile number", PH_RE.test(p || "") ? p : (p || "").replace(/\D/g, "").slice(0, 11)) : ""}${sE ? fld("b_e", "Email", "email", e) : ""}${fld("b_t", "Notes (optional)", "text", B.notes || "")}${B.err ? `<div class="msg">${B.err}</div>` : ""}`;
        }
        if (k === "confirm") {
          const lo = sm("p"), hi = sm("p", "px"), dn = lo > DB.deposit, opt = dn ? B.opt || "down" : (B.opt = "full");
          h = `<h3>How much would you like to pay now?</h3><small>You pay by GCash or Maya on the next screen.</small><div class="sg" style="margin-top:.6rem">${dn ? payOpt("down", opt, "Down payment", "Reserve your slot now and pay the rest at the salon.", DB.deposit, "B.opt") : ""}${payOpt("full", opt, "Full payment", lo === hi ? "Pay the whole estimated amount now." : "Pay the starting price now. Any difference is settled at the salon.", Math.max(lo, DB.deposit), "B.opt")}</div><div class="card" style="margin-top:.8rem"><p style="margin:0">After you confirm, we hold your slot for <b>${DB.hold} minutes</b> while you send the payment and upload a screenshot of your receipt. Your booking is confirmed once the salon has checked your payment.</p></div>${B.err ? `<div class="msg">${B.err}</div>` : ""}<p class="mute">The down payment is deducted from your final bill and may be forfeited if you cancel.</p>`;
        }
        const nav = `<p style="display:flex;gap:.6rem">${B.step ? '<button class="btn w" onclick="B.step--;render()">Back</button>' : ""}${!cont ? "" : k === "review" ? '<button class="btn" onclick="det()">Continue</button>' : k === "confirm" ? `<button class="btn" ${B.busy ? "disabled" : ""} onclick="askSubmit()">${B.busy ? "Please wait..." : "Confirm & continue to payment"}</button>` : `<button class="btn" ${ok ? "" : 'disabled style="opacity:.4"'} onclick="B.step++;render()">Continue</button>`}</p>`;
        return `<section class="sec"><div class="wrap" style="max-width:980px"><h2>Book an appointment</h2>${prog}<div class="bk"><div>${h}${nav}</div>${bsum()}</div></div></section>`;
      }
      function det() {
        const val = (id, cur) => { const el = $("#" + id); return (el ? el.value : cur || "").trim(); };
        B.name = val("b_n", B.name ?? (U ? U.name : ""));
        B.phone = val("b_p", B.phone ?? (U ? U.phone : ""));
        B.email = val("b_e", B.email ?? (U ? U.email : ""));
        B.notes = val("b_t", "");
        const bad = !NAME_RE.test(B.name) ? ["b_n", "Enter your name (letters only, at least 2 characters)."]
          : !PH_RE.test(B.phone) ? ["b_p", B.phone.length < 11 ? `Your mobile number must be complete: 11 digits (you entered ${B.phone.length}).` : "Mobile numbers start with 09 and use numbers only."]
          : !EMAIL_RE.test(B.email) ? ["b_e", "Enter a valid email address."] : null;
        if (bad) {
          B.editC = 1; B.err = bad[1]; render(); shake(bad[0]);
          const el = document.getElementById(bad[0]); el && el.focus();
          return;
        }
        B.err = "";
        // Security check: the customer confirms every detail before the slot is reserved.
        ask("Please confirm your booking details",
          `<p class="mute" style="margin-top:0">Make sure everything below is correct before you continue.</p><dl class="sumlist"><dt>Name</dt><dd>${esc(B.name)}</dd><dt>Mobile</dt><dd>${esc(fmtPhone(B.phone))}</dd><dt>Email</dt><dd>${esc(B.email)}</dd><dt>Services</dt><dd>${sel().map((s) => esc(s.n)).join(", ")}</dd><dt>Date &amp; time</dt><dd>${bfl(B.date)} at ${m2t(B.slot)}</dd><dt>Technician</dt><dd>${B.tech ? esc(te(B.tech)) : "Any available technician"}</dd><dt>Estimate</dt><dd>${prr()} · ${dur()}</dd>${B.notes ? `<dt>Notes</dt><dd>${esc(B.notes)}</dd>` : ""}</dl>`,
          "Yes, details are correct", "detOk()", "Edit details");
      }
      function detOk() {
        modal();
        // Older accounts without a saved name/phone (or an invalid one): remember it so we never ask again.
        if (U && (!U.name || !PH_RE.test(U.phone || ""))) {
          const patch = {};
          if (!U.name) patch.full_name = B.name;
          if (!PH_RE.test(U.phone || "")) patch.phone = B.phone;
          FN.raw.saveProfile(patch).then((r) => Object.assign(U, { name: r.full_name || U.name, phone: r.phone || U.phone })).catch(() => {});
        }
        B.editC = 0;
        B.step = bidx("confirm");
        render();
      }
      function askSubmit() {
        if (B.busy) return;
        const amt = (B.opt || "down") === "full" ? Math.max(sm("p"), DB.deposit) : DB.deposit;
        ask("Reserve this appointment?",
          `<p>${sel().map((s) => esc(s.n)).join(", ")}<br><b>${bfl(B.date)} at ${m2t(B.slot)}</b></p><label class="agree"><input type="checkbox" id="agree" onchange="$('#dlg_yes').disabled=!this.checked"> I will send ${php(amt)} and upload the receipt within ${DB.hold} minutes. I understand the down payment may be forfeited if I cancel.</label>`,
          "Reserve my slot", "modal();submitB()", "Not yet");
        $("#dlg_yes").disabled = true;
      }
      /* ---------- My Appointments: tabs + sort by date/time (or service, price, status) ---------- */
      let MS = ""; // chosen sort; "" = the natural order for the tab
      const SORTS = {
        "date-asc": ["Date & time: soonest first", (x, y) => key(x).localeCompare(key(y))],
        "date-desc": ["Date & time: latest first", (x, y) => key(y).localeCompare(key(x))],
        svc: ["Service name (A-Z)", (x, y) => x.svc.localeCompare(y.svc) || key(x).localeCompare(key(y))],
        "price-desc": ["Price: highest first", (x, y) => y.price - x.price || key(x).localeCompare(key(y))],
        "price-asc": ["Price: lowest first", (x, y) => x.price - y.price || key(x).localeCompare(key(y))],
        status: ["Status", (x, y) => (LB[x.status] || "").localeCompare(LB[y.status] || "") || key(x).localeCompare(key(y))],
      };
      const sortKey = () => MS || (MT === "Upcoming" ? "date-asc" : "date-desc");
      const dateBox = (a) => {
        const d = new Date(a.date + "T00:00");
        return `<div class="dbox"><small>${d.toLocaleDateString("en", { month: "short" }).toUpperCase()}</small><b>${d.getDate()}</b><small>${DN[d.getDay()]}</small></div>`;
      };
      function mine() {
        if (!U) return gate();
        if (RSC) return reschedView();
        const L = DB.appts.filter((a) => a.uid === U.id),
          T = {
            Upcoming: L.filter((a) => ["pending", "verifying", "confirmed", "waiting", "service"].includes(a.status)),
            Completed: L.filter((a) => a.status === "completed"),
            Cancelled: L.filter((a) => ["cancelled", "noshow", "expired", "refunded", "voided"].includes(a.status)),
          },
          sk = sortKey(),
          list = [...T[MT]].sort(SORTS[sk][1]);
        const nx = DB.appts.filter((a) => a.uid === U.id && ["pending", "verifying", "confirmed", "waiting"].includes(a.status) && a.date >= today()).sort((x, y) => key(x).localeCompare(key(y)))[0];
        return W(
          `<h2>Hello, ${esc(U.name || U.user)}</h2><div class="card next"><small>Next appointment</small>${nx ? `<h3 style="margin:.3rem 0">${esc(nx.svc)}</h3><p style="margin:0">${bfl(nx.date)} at ${m2t(nx.start)} ${pill(nx.status)}<br><small>Confirmation ${esc(nx.code)}</small></p>` : '<p class="mute" style="margin:.3rem 0 0">You have no upcoming appointments.</p>'}</div><h2 style="margin-top:1.4rem">My Appointments</h2><div class="tabs">${Object.keys(T).map((t) => `<button class="${MT === t ? "on" : ""}" onclick="MT='${t}';MS='';render()">${t} (${T[t].length})</button>`).join("")}</div>
<div class="sortbar"><label for="msort">Sort by</label><select id="msort" onchange="MS=this.value;render()">${Object.entries(SORTS).map(([k, [l]]) => `<option value="${k}" ${k === sk ? "selected" : ""}>${l}</option>`).join("")}</select><small>${list.length} appointment${list.length === 1 ? "" : "s"}</small></div>
${list.map((a) => `<div class="card appt">${dateBox(a)}<div class="appt-b"><div class="row"><b>${esc(a.svc)}</b>${pill(a.status)}</div><small>🕒 ${m2t(a.start)} to ${m2t(a.start + a.dur)} · ${a.estD}${a.staff ? " · with " + esc(te(a.staff)) : ""}</small><br><small>${a.estP || php(a.price)} · Confirmation <b>${esc(a.code)}</b></small>${apptActs(a)}</div></div>`).join("") || '<p class="mute">Nothing here yet.</p>'}`,
          720,
        );
      }

      /* ---------- Account Information ---------- */
      const acctInfo = () => {
        const a = parseAddr(U.addr);
        return { name: U.name || "", username: U.username || "", phone: U.phone || "", email: U.email || "", ...a };
      };
      const ACCT_LABEL = { name: "Full name", username: "Username", phone: "Mobile number", email: "Email", address: "Address" };
      function acct() {
        if (!U) return gate();
        const v = acctInfo(), opt = (L) => L.map((x) => `<option value="${esc(x)}">`).join("");
        const f = (id, l, val, attrs = "", help = "") => `<label for="${id}">${l}</label><input id="${id}" value="${esc(val)}" ${attrs}><small class="fhint" id="${id}_h">${help}</small>`;
        return W(
          `<h2>Account Information</h2><p class="mute">Update your details below, then press <b>Save changes</b>. You'll be asked to confirm before anything is saved.</p>
<div class="card acct"><h3>Profile</h3>
${f("a_n", "Full name", v.name, 'autocomplete="name" maxlength="60"', "Letters, spaces, dots, apostrophes and hyphens.")}
${f("a_u", "Username", v.username, 'autocomplete="username" autocapitalize="none" maxlength="20" onblur="checkUser()"', "3-20 letters, numbers, dots or underscores. You can log in with it.")}
</div>
<div class="card acct"><h3>Contact</h3>
${phoneFld("a_p", "Mobile number", v.phone.replace(/\D/g, "").slice(0, 11))}${v.phone && !PH_RE.test(v.phone) ? `<div class="msg">Your saved number "${esc(v.phone)}" is not a complete 11-digit mobile number. Please correct it.</div>` : ""}
${f("a_e", "Email", v.email, 'type="email" autocomplete="email" maxlength="120"', "Changing it sends a confirmation link to the new address.")}
${U.pendingEmail ? `<div class="msg ok">Waiting for you to confirm <b>${esc(U.pendingEmail)}</b>. Open the link we emailed, then log in again.</div>` : ""}
</div>
<div class="card acct"><h3>Address</h3><small class="mute">Optional, but if you add one, fill in every line.</small>
${f("a_st", "House / unit no. and street", v.street, 'autocomplete="address-line1" maxlength="120" placeholder="e.g. 12 Sampaguita St., Unit 3B"')}
<div class="two-col"><div>${f("a_bg", "Barangay", v.brgy, 'maxlength="60" placeholder="e.g. Teachers Village East"')}</div><div>${f("a_ct", "City / municipality", v.city, 'list="dl_city" autocomplete="address-level2" maxlength="60" placeholder="e.g. Quezon City"')}</div></div>
<div class="two-col"><div>${f("a_pv", "Province / region", v.prov, 'list="dl_prov" autocomplete="address-level1" maxlength="60" placeholder="e.g. Metro Manila"')}</div><div>${numFld("a_zip", "ZIP code", v.zip, 4, "1101", "4-digit ZIP code")}</div></div>
<datalist id="dl_city">${opt(NCR)}</datalist><datalist id="dl_prov">${opt(PROVINCES)}</datalist>
</div>
<div id="ae"></div><p class="savebar"><button class="btn" onclick="saveA()">Save changes</button> <button class="btn w" onclick="render()">Discard edits</button></p>`,
          560,
        );
      }
      async function checkUser() {
        const u = ($("#a_u").value || "").trim();
        if (!u || u === (U.username || "")) return hint("a_u", "3-20 letters, numbers, dots or underscores. You can log in with it.");
        if (!USER_RE.test(u)) return hint("a_u", "Use 3-20 letters, numbers, dots or underscores (no spaces).", "err");
        try { const ok = await FN.raw.usernameAvailable(u); hint("a_u", ok ? "✓ Username is available" : "That username is already taken.", ok ? "good" : "err"); } catch (e) { /* checked again on save */ }
      }
      // Reads + validates the form. Returns { errors: [[fieldId, message]], next, changes }.
      function readAcct() {
        const g = (id) => ($("#" + id).value || "").trim().replace(/\s+/g, " ");
        const next = { name: g("a_n"), username: g("a_u"), phone: g("a_p"), email: g("a_e").toLowerCase(), street: g("a_st"), brgy: g("a_bg"), city: g("a_ct"), prov: g("a_pv"), zip: g("a_zip") };
        const cur = acctInfo(), errors = [];
        if (!NAME_RE.test(next.name)) errors.push(["a_n", "Enter your full name (letters only, at least 2 characters)."]);
        if (next.username ? !USER_RE.test(next.username) : cur.username) errors.push(["a_u", next.username ? "Use 3-20 letters, numbers, dots or underscores (no spaces)." : "Enter a username."]);
        if (!PH_RE.test(next.phone)) errors.push(["a_p", /\D/.test(next.phone) ? "Numbers only." : next.phone.length !== 11 ? `Enter all 11 digits (you have ${next.phone.length}).` : "Mobile numbers start with 09."]);
        if (!EMAIL_RE.test(next.email)) errors.push(["a_e", "Enter a valid email address, e.g. you@example.com."]);
        const anyAddr = next.street || next.brgy || next.city || next.prov || next.zip;
        if (anyAddr) [["street", "a_st"], ["brgy", "a_bg"], ["city", "a_ct"], ["prov", "a_pv"], ["zip", "a_zip"]].forEach(([k, id]) => { const m = ADDR_CHECK[k](next[k]); if (m) errors.push([id, m]); });
        const addrNext = anyAddr ? fmtAddr(next) : "", addrCur = (U.addr || "").trim();
        const changes = [];
        if (next.name !== cur.name) changes.push(["name", cur.name, next.name]);
        if (next.username !== cur.username) changes.push(["username", cur.username, next.username]);
        if (next.phone !== cur.phone) changes.push(["phone", fmtPhone(cur.phone), fmtPhone(next.phone)]);
        if (next.email !== cur.email.toLowerCase()) changes.push(["email", cur.email, next.email]);
        if (addrNext !== addrCur && !(anyAddr === "" && !addrCur)) changes.push(["address", addrCur, addrNext]);
        return { errors, next, changes, addrNext };
      }
      let PEND = null;
      function saveA() {
        $("#ae").innerHTML = "";
        document.querySelectorAll(".acct .bad").forEach((el) => el.classList.remove("bad"));
        const r = readAcct();
        if (r.errors.length) {
          r.errors.forEach(([id, m]) => { hint(id, m, "err"); shake(id); });
          document.getElementById(r.errors[0][0]).focus();
          return err(`Please fix ${r.errors.length === 1 ? "the highlighted field" : r.errors.length + " highlighted fields"} before saving.`);
        }
        if (!r.changes.length)
          return modal(`<div class="dlg"><div class="dlg-ic">i</div><h3>No changes to save</h3><p>Everything is the same as what's already saved on your account.</p>${MF('<button class="btn" onclick="modal()">OK</button>')}</div>`);
        PEND = r;
        ask("Save these changes?",
          `<p class="mute" style="margin-top:0">Please review your changes:</p><dl class="sumlist chg">${r.changes.map(([k, o, n]) => `<dt>${ACCT_LABEL[k]}</dt><dd><s>${esc(o) || "<i>empty</i>"}</s><br>${esc(n) || "<i>removed</i>"}</dd>`).join("")}</dl>`,
          "Save changes", "doSaveA()", "Cancel");
      }
      async function doSaveA() {
        const r = PEND; PEND = null;
        modal();
        if (!r) return;
        const keys = r.changes.map((c) => c[0]), patch = {}, done = [], failed = [];
        let emailPending = false;
        try {
          // Uniqueness checks first, so nothing is half-saved.
          if (keys.includes("username") && r.next.username && !(await FN.usernameAvailable(r.next.username))) { hint("a_u", "That username is already taken.", "err"); shake("a_u"); return err("That username is already taken. Try another one."); }
          if (keys.includes("email") && (await FN.emailInUse(r.next.email)) === true) { hint("a_e", "That email is already used by another account.", "err"); shake("a_e"); return err("That email is already used by another account."); }
          if (keys.includes("name")) patch.full_name = r.next.name;
          if (keys.includes("username")) patch.username = r.next.username || null;
          if (keys.includes("phone")) patch.phone = r.next.phone;
          if (keys.includes("address")) patch.address = r.addrNext || null;
          if (Object.keys(patch).length) { await FN.saveProfile(patch); done.push(...keys.filter((k) => k !== "email")); }
        } catch (e) { failed.push(["Profile", e.message]); }
        if (keys.includes("email")) {
          try { emailPending = (await FN.changeEmail(r.next.email)).pending; done.push("email"); if (emailPending) U.pendingEmail = r.next.email; }
          catch (e) { failed.push(["Email", e.message]); }
        }
        // Re-read from the database so what you see is exactly what was stored (and what you'll see after a refresh).
        try { setU(await FN.myProfile()); } catch (e) { /* keep local copy */ }
        if (done.includes("phone") && U.phone !== r.next.phone) failed.push(["Mobile number", "We couldn't save your new number. Please try again."]);
        render();
        if (failed.length) {
          err(failed.map(([w, m]) => w + ": " + m).join(" "));
          if (!done.length) return;
        }
        const names = done.map((k) => ACCT_LABEL[k]);
        $("#ae").innerHTML += `<div class="msg ok">✓ Saved: ${names.join(", ")}.</div>`;
        modal(`<div class="dlg">${tick}<h3>Changes saved</h3><p>${names.join(", ")} ${names.length === 1 ? "was" : "were"} updated successfully.${emailPending ? `<br><br>We sent a confirmation link to <b>${esc(r.next.email)}</b>. Your login email changes after you open it.` : ""}</p>${MF('<button class="btn" onclick="modal()">Done</button>')}</div>`);
      }
      const PG = () => ({
        home,
        services,
        gallery: () => gallery(),
        about,
        login,
        signup,
        forgot,
        reset,
        book,
        mine,
        acct,
      });
      function render() {
        const y = window.scrollY;
        const logo =
          '<span class="logo" onclick="go(\'home\')"><span class="lg">f</span><span><i>fairytale</i><small>NAILS SALON</small></span></span>';
        const L = [
          ["home", "Home"],
          ["services", "Services & Prices"],
          ["gallery", "Gallery"],
        ].concat(
          U
            ? [
                ["mine", "My Appointments"],
                ["acct", "Account"],
              ]
            : [["about", "About us"]],
        );
        $("#app").innerHTML =
          `<header class="top noprint">${logo}<nav>${L.map(([k, l]) => `<a class="${P === k ? "on" : ""}" href="#${k}" onclick="event.preventDefault();go('${k}')">${l}</a>`).join("")}</nav><button class="btn" onclick="B={step:0};go('book')">Book Appointment</button> ${U ? `<button class="btn w sm" onclick="doLogout()">Log out</button>` : `<button class="btn w sm" onclick="go('login')">Log in</button> <button class="btn sm" onclick="go('signup')">Sign up</button>`}</header><main>${(PG()[P] || home)()}</main><footer class="foot noprint">${logo}<span class="mute">Open ${openTxt()}, ${m2t(DB.hours.o)} to ${m2t(DB.hours.c)}<br>Soft care, thoughtful details, and a little magic, every visit.</span><small>© 2026 Fairytale Nails Salon</small></footer>`;
        if (y) window.scrollTo(0, y); // same-page updates keep your place; go() scrolls to top on page changes
      }

      /* ================= Supabase data layer ================= */
      const SL = {}; // availability cache: "date|duration|tech" -> minutes[]
      function free(date, dur, skip, tid) {
        if (!date || !dur) return [];
        const k = date + "|" + dur + "|" + (tid || 0);
        if (SL[k]) return SL[k].v || [];
        SL[k] = { v: null };
        FN.getSlots(date, dur, tid || null)
          .then((v) => { SL[k].v = inHours(date, dur, v); if (!$("#md").innerHTML) render(); })
          .catch(() => { delete SL[k]; });
        return [];
      }
      // Opening hours guard: the whole service must fit between opening and closing time and must not overlap lunch.
      function inHours(date, dur, list) {
        const h = DB.hours, d = new Date(date + "T00:00"), now = new Date(), nowMin = date === today() ? now.getHours() * 60 + now.getMinutes() : -1;
        if (!DB.openDays.includes(d.getDay()) || DB.off.includes(date)) return [];
        return (list || []).filter((t) => t >= h.o && t + dur <= h.c && !(t < h.le && t + dur > h.ls) && t > nowMin);
      }
      const clearSlots = () => Object.keys(SL).forEach((k) => delete SL[k]);
      const manila = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
      function mapAppt(r) {
        const p = Object.fromEntries(manila.formatToParts(new Date(r.start_at)).map((x) => [x.type, x.value]));
        const dur = Math.round((new Date(r.end_at) - new Date(r.start_at)) / 6e4),
          it = r.appointment_items || [],
          lo = it.reduce((t, i) => t + +i.unit_price, 0),
          hi = it.reduce((t, i) => t + +(i.price_max || i.unit_price), 0),
          sale = Array.isArray(r.sales) ? r.sales[0] : r.sales;
        return {
          id: r.id, code: r.code, uid: r.customer_id, name: r.customer_name,
          svc: it.map((i) => i.name).join(", "),
          date: `${p.year}-${p.month}-${p.day}`, start: +p.hour * 60 + +p.minute, dur,
          price: lo, estP: sale && sale.status === "paid" ? php(sale.total) : lo === hi ? php(lo) : php(lo) + " to " + php(hi),
          estD: durT(dur), notes: r.notes || "", startISO: r.start_at,
          paid: (r.payments || []).filter((x) => ["paid", "partially_refunded"].includes(x.status)).reduce((t, x) => t + +x.amount, 0),
          req: reqOf(r),
          sent: (r.payments || []).filter((x) => x.provider === "manual" && x.status === "pending").reduce((t, x) => t + +x.amount, 0),
          status: r.status === "held" ? (receiptSent(r) ? "verifying" : "pending") : r.status, exp: r.status === "held" && !receiptSent(r) ? r.hold_expires_at : null, staff: r.technician_id || 0, hist: [],
        };
      }
      // A held booking whose receipt is with staff: pending manual payment (or the old marker, an empty/endless expiry).
      const receiptSent = (r) => (r.payments || []).some((p) => p.provider === "manual" && p.status === "pending") || !r.hold_expires_at || r.hold_expires_at === "infinity";
      // The customer's latest reschedule request for a booking (pending, or the latest declined one to explain it).
      function reqOf(r) {
        const L = [...(r.reschedule_requests || [])].sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
        const q = L[0];
        if (!q || !["pending", "declined"].includes(q.status)) return null;
        const p = Object.fromEntries(manila.formatToParts(new Date(q.new_start)).map((x) => [x.type, x.value]));
        return { id: q.id, status: q.status, reason: q.reason || "", tech: q.new_tech || 0, date: `${p.year}-${p.month}-${p.day}`, start: +p.hour * 60 + +p.minute };
      }
      async function loadAppts(quiet) {
        if (!U) { DB.appts = []; return; }
        DB.appts = (await (quiet ? FN.raw || FN : FN).myAppointments()).map(mapAppt);
      }
      let unwatch = null;
      function setU(p) {
        const keep = U && U.id === p.id ? U.pendingEmail : null;
        U = { id: p.id, name: p.full_name || "", username: p.username || "", user: p.username || p.email, phone: p.phone || "", email: p.email || "", addr: p.address || "" };
        if (keep && keep.toLowerCase() !== U.email.toLowerCase()) U.pendingEmail = keep;
      }
      async function startSession() {
        const ok = await FN.requirePortalRole("customer");
        if (!ok) return false;
        setU(await FN.myProfile());
        await loadAppts();
        if (unwatch) unwatch();
        unwatch = FN.watchMyBookings(U.id, async () => {
          await loadAppts(true); // background refresh: no loading screen
          if (!$("#md").innerHTML && P !== "book" && P !== "acct" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) render();
        });
        return true;
      }
      async function boot() {
        // Public pages (home, gallery, about) work with the bundled defaults, so show them right away and
        // fetch the live catalog silently in the background. Pages that need live data keep the loading screen.
        let done;
        BOOT_P = new Promise((r) => (done = r));
        try {
          const rec = await (FN.raw || FN).recoveryFromUrl().catch(() => "expired");
          if (rec) { RS = rec; P = "reset"; }
          await loadStart();
        } finally { done(); }
      }
      async function loadStart() {
        const quick = QUICK.includes(P), api = quick && FN.raw ? FN.raw : FN;
        if (quick) { render(); window.Loader && Loader.endInitial(true); }
        else $("#app").innerHTML = ""; // the loading screen is already covering the page
        try {
          const c = await api.loadCatalog();
          GAL = await Promise.resolve().then(() => api.loadGallery()).catch(() => null); // never blocks the site if the gallery isn't set up
          GR.splice(0, GR.length, ...c.GR);
          Object.keys(GN).forEach((k) => delete GN[k]);
          Object.assign(GN, c.GN);
          DB.SV = c.SV; TE.splice(0, TE.length, ...c.TE);
          DB.hours = c.hours; DB.openDays = c.openDays; DB.off = c.off; DB.deposit = c.depositAmount; DB.test = c.testMode; DB.hold = c.holdMinutes || 5; DB.pay = c.pay || {};
          tab = GR[0];
          if (P !== "reset" && (await api.currentUser())) { await startSession(); await resumePayment(); }
        } catch (e) {
          console.error(e);
          if (quick) return; // the page is already showing the bundled defaults
          $("#app").innerHTML = '<p style="text-align:center;padding:5rem 1rem">Could not reach the salon system. <a class="pr" style="cursor:pointer" onclick="boot()">Try again</a></p>';
          window.Loader && Loader.endInitial();
          return;
        }
        BOOTED = true;
        render();
        window.Loader && Loader.endInitial(); // reveal only after the first screen is fully rendered
      }
      const err = (m) => ($("#ae").innerHTML = `<div class="msg">${esc(m)}</div>`);
      async function doLogin() {
        const u = $("#li_u").value.trim(), w = $("#li_p").value;
        if (!u || !w) return err("Enter your email (or username) and password.");
        try {
          await FN.signIn(u, w);
          if (!(await startSession())) return err("This account is for salon staff. Please sign in through the staff page.");
          go(B.sel && B.sel.length ? "book" : "mine"); // came from "Book" on the price list: continue that booking
        } catch (e) { err(e.message); }
      }
      async function doSignup() {
        const g = (i) => $("#" + i).value.trim(), n = g("su_n").replace(/\s+/g, " "), e = g("su_e").toLowerCase(), p = g("su_p"), w = $("#su_w").value, w2 = $("#su_w2").value;
        const failed = pwResults(w).filter((r) => !r[1]).map((r) => r[0]);
        const bad = !NAME_RE.test(n) ? ["su_n", "Enter your full name (letters only, at least 2 characters)."]
          : !EMAIL_RE.test(e) ? ["su_e", "Enter a valid email address, e.g. you@example.com."]
          : !PH_RE.test(p) ? ["su_p", p.length !== 11 ? `Enter your complete 11-digit mobile number (you have ${p.length}).` : "Mobile numbers start with 09."]
          : failed.length ? ["su_w", "Your password still needs: " + failed.map((t) => t[0].toLowerCase() + t.slice(1)).join(", ") + "."]
          : w !== w2 ? ["su_w2", "The two passwords do not match."] : null;
        if (bad) { err(bad[1]); shake(bad[0]); document.getElementById(bad[0]).focus(); pwCheck(); return; }
        try {
          const r = await FN.signUp({ email: e, password: w, phone: p, fullName: n });
          if (!r.session) return ($("#ae").innerHTML = '<div class="msg ok">Account created. Check your email to confirm it, then log in.</div>');
          await startSession();
          go("mine");
        } catch (x) {
          const m = (x.message || "").toLowerCase();
          err(m.includes("already registered") || m.includes("already exists") ? "An account with this email already exists. Log in instead." : x.message);
        }
      }
      async function doLogout() {
        if (unwatch) unwatch(); unwatch = null;
        await FN.signOut(); U = null; DB.appts = []; B = { step: 0 }; go("home");
      }

      /* ---------- deposit: TEST mode records it instantly; LIVE mode goes to PayMongo and waits for the webhook ---------- */
      const PAY_KEY = "ft_pending_payment"; // only the appointment id, for coming back from the checkout page
      async function startLivePayment(id) {
        try { sessionStorage.setItem(PAY_KEY, id); } catch (e) { /* private mode: we'll still find it in My Appointments */ }
        await FN.payDeposit(id); // redirects to PayMongo
      }
      async function resumePayment() {
        let id = null;
        try { id = sessionStorage.getItem(PAY_KEY); sessionStorage.removeItem(PAY_KEY); } catch (e) { return; }
        const a = id && DB.appts.find((x) => x.id === id);
        if (!a) return;
        const finish = async (status) => {
          await loadAppts(true);
          const now = DB.appts.find((x) => x.id === id);
          if (now && now.status === "confirmed") { modal(); B = { step: 0, done: now }; P = "book"; render(); return; }
          modal(`<div class="dlg"><h3>${status === "timeout" ? "Still waiting for the payment" : "Payment not completed"}</h3><p>${status === "timeout" ? "We have not received the payment confirmation yet. If you paid, it will appear in My Appointments within a few minutes." : "Your deposit was not received. You can try again from My Appointments while the slot is still held."}</p>${MF('<button class="btn" onclick="modal();go(\'mine\')">Open My Appointments</button>')}</div>`);
        };
        if (a.status === "pending") {
          P = "mine";
          setTimeout(() => modal(`<div class="dlg"><div class="spin" aria-hidden="true"></div><h3>Confirming your payment…</h3><p class="mute">This usually takes a few seconds. Please keep this page open.</p></div>`), 0);
          FN.waitForConfirmation(id, finish, 90000);
        } else if (a.status === "confirmed") { B = { step: 0, done: a }; P = "book"; }
      }
      async function submitB() {
        if (B.busy) return;
        if (!U) return go("login");
        B.busy = true; B.err = ""; render();
        try {
          const a = await FN.createHold({ serviceIds: [...B.sel], date: B.date, startMin: B.slot, techId: B.tech || 0, method: B.tech ? "tech" : "time", name: B.name, phone: B.phone, email: B.email, notes: B.notes });
          if (B.refFile) { try { await FN.uploadReference(B.refFile, a.id); } catch (x) { console.warn("reference upload failed", x); } }
          FN.resetAttempt(); clearSlots();
          await loadAppts();
          const opt = B.opt || "down";
          B = { step: 0 };
          return openPay(a.id, opt);
        } catch (e) {
          B.busy = false;
          if (/SLOT_UNAVAILABLE|HOLD_EXPIRED/.test(e.code || e.message)) {
            clearSlots(); FN.resetAttempt(); B.warn = e.message; B.slot = null; B.step = bidx("time");
          } else B.err = (e.message || "Something went wrong. Please try again.") + " If your slot was reserved, you can finish paying from My Appointments.";
        }
        render();
      }
      function payHold(id) { openPay(id, "down"); }
      /* ---------- pay & upload receipt: GCash / Maya outside the site, staff verify the screenshot ---------- */
      let PAY = null; // { id, opt, exp, file, err, busy, sent, expired }
      const payOpt = (v, cur, t, d, amt, target) =>
        `<button class="opt ${cur === v ? "on" : ""}" onclick="${target}='${v}';render()"><span><b>${t}</b><br><small>${d}</small></span><b class="pr">${php(amt)}</b></button>`;
      function openPay(id, opt) {
        const a = DB.appts.find((x) => x.id === id);
        PAY = { id, opt: opt || "down", exp: a && a.exp, file: null, err: "" };
        P = "book"; render(); scrollTo(0, 0);
      }
      const payAmt = (a) => (PAY.opt === "full" ? Math.max(a.price, DB.deposit) : DB.deposit);
      function payView() {
        const a = DB.appts.find((x) => x.id === PAY.id), done = () => "PAY=null;B={step:0};go('mine')";
        if (PAY.sent || (a && a.status === "verifying"))
          return W(`<h2>Receipt sent</h2><div class="card"><p>Thank you! We received your payment receipt for booking <b>${esc(a ? a.code : "")}</b>.</p>${a ? `<p>${esc(a.svc)}<br>${bfl(a.date)} at ${m2t(a.start)}</p>` : ""}<p><b>Status: Waiting for confirmation.</b> The salon will check your payment and confirm your booking. You can follow it in My Appointments.</p></div><p><button class="btn" onclick="${done()}">View my appointments</button></p>`);
        if (!a || PAY.expired || a.status !== "pending")
          return W(`<h2>Your reserved time ran out</h2><div class="card"><p>We did not receive a receipt within ${DB.hold} minutes, so the time slot was released. Please book again. If you already sent money, contact the salon with your receipt.</p></div><p><button class="btn" onclick="PAY=null;B={step:0};go('book')">Book again</button> <button class="btn w" onclick="${done()}">My appointments</button></p>`);
        if (a.price <= DB.deposit) PAY.opt = "full";
        const pay = DB.pay || {}, amt = payAmt(a),
          acct = (n, nm, num) => num ? `<div class="payacct"><b>${n}</b><br><small>${esc(nm)}</small><br><span class="paynum">${esc(num)}</span> <button class="btn sm w" type="button" onclick="copyNum('${esc(num)}',this)">Copy</button></div>` : "",
          details = acct("GCash", pay.gcashName, pay.gcashNumber) + acct("Maya", pay.mayaName, pay.mayaNumber),
          methods = [["gcash", "GCash"], ["maya", "Maya"]].filter(([k]) => !(pay.gcashNumber || pay.mayaNumber) || pay[k + "Number"]);
        return W(`<h2>Pay &amp; upload your receipt</h2>
<div class="card"><div class="row"><span>Booking <b>${esc(a.code)}</b><br><small>${esc(a.svc)} · ${bfl(a.date)} at ${m2t(a.start)}</small></span><span class="paytimer" aria-live="polite">Time left <b id="paycd">${cdText()}</b></span></div></div>
<h3 class="payh">1. Amount to pay</h3><div class="sg">${a.price <= DB.deposit ? "" : payOpt("down", PAY.opt, "Down payment", "Pay the rest at the salon.", DB.deposit, "PAY.opt")}${payOpt("full", PAY.opt, "Full payment", "Pay the estimated total now.", Math.max(a.price, DB.deposit), "PAY.opt")}</div>
<h3 class="payh">2. Send ${php(amt)}</h3><div class="card payto">${pay.qrUrl ? `<img class="payqr" src="${esc(pay.qrUrl)}" alt="Salon payment QR code">` : ""}<div>${details || '<p class="mute" style="margin:0">Send the payment to the salon\'s GCash or Maya account.</p>'}${pay.note ? `<p class="mute" style="margin:.6rem 0 0">${esc(pay.note)}</p>` : ""}<p class="mute" style="margin:.6rem 0 0">Please put your booking number <b>${esc(a.code)}</b> in the message, if your app allows it.</p></div></div>
<h3 class="payh">3. Upload your receipt</h3><div class="card"><label for="pm">Paid with</label><select id="pm" onchange="PAY.method=this.value">${methods.map(([k, l]) => `<option value="${k}" ${(PAY.method || methods[0][0]) === k ? "selected" : ""}>${l}</option>`).join("")}</select><label for="pf">Screenshot or photo of your receipt</label><input id="pf" type="file" accept="image/jpeg,image/png,image/webp,image/heic" onchange="PAY.file=this.files[0]||null;PAY.err='';render()"><small class="fhint">${PAY.file ? "Selected: " + esc(PAY.file.name) : "Make sure the amount and reference number are clearly visible."}</small>${PAY.err ? `<div class="msg">${esc(PAY.err)}</div>` : ""}<p style="margin-bottom:0"><button class="btn" ${PAY.busy ? "disabled" : ""} onclick="sendReceipt()">${PAY.busy ? "Sending..." : "Send receipt"}</button> <button class="btn w" onclick="${done()}">Pay later</button></p></div>`, 720);
      }
      function cdText() {
        const left = PAY && PAY.exp ? new Date(PAY.exp) - Date.now() : 0;
        if (left <= 0) return "0:00";
        const t = Math.ceil(left / 1000);
        return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
      }
      setInterval(() => {
        if (!PAY || PAY.sent || PAY.expired || PAY.busy || !PAY.exp) return;
        const el = document.getElementById("paycd");
        if (el) el.textContent = cdText();
        if (new Date(PAY.exp) - Date.now() <= 0) { PAY.expired = true; if (P === "book") render(); }
      }, 1000);
      function copyNum(n, b) {
        const ok = () => { b.textContent = "Copied"; setTimeout(() => (b.textContent = "Copy"), 1500); };
        navigator.clipboard ? navigator.clipboard.writeText(n).then(ok, () => {}) : ok();
      }
      async function sendReceipt() {
        if (!PAY || PAY.busy) return;
        if (!PAY.file) { PAY.err = "Choose a screenshot or photo of your receipt first."; return render(); }
        const el = $("#pm"), method = (el && el.value) || "gcash";
        PAY.busy = true; PAY.err = ""; render();
        try {
          await FN.submitReceipt(PAY.id, PAY.file, PAY.opt, method);
          PAY.sent = true;
          await loadAppts(true);
        } catch (e) {
          const m = e.message || "";
          if (/HOLD_EXPIRED/.test(m)) PAY.expired = true;
          else PAY.err = /NOT_FOUND|INVALID/.test(m) ? "Something went wrong. Please try again." : m;
        }
        PAY.busy = false; render();
      }
      /* ---------- My Appointments: details, reschedule ---------- */
      const canMove = (a) => ["confirmed", "verifying"].includes(a.status) && new Date(a.startISO) - Date.now() > 2 * 36e5 && !(a.req && a.req.status === "pending");
      const reqWhen = (q) => bfl(q.date) + " at " + m2t(q.start) + (q.tech ? " with " + te(q.tech) : "");
      function apptActs(a) {
        const b = [];
        if (a.status === "pending") b.push(`<button class="btn sm" onclick="payHold('${a.id}')">Pay &amp; upload receipt</button>`);
        b.push(`<button class="btn sm w" onclick="apptDetails('${a.id}')">View details</button>`);
        if (canMove(a)) b.push(`<button class="btn sm w" onclick="openResched('${a.id}')">Reschedule</button>`);
        const live = a.req && ["confirmed", "verifying"].includes(a.status);
        if (live && a.req.status === "pending") b.push(`<button class="btn sm w" onclick="askWithdraw('${a.id}')">Withdraw request</button>`);
        const past = a.startISO && new Date(a.startISO) <= Date.now();
        if (["pending", "confirmed"].includes(a.status) && !past) b.push(`<button class="btn sm w" onclick="askCancel('${a.id}')">Cancel</button>`);
        const rq = !live ? "" : a.req.status === "pending"
          ? `<div class="msg ok" style="margin:.5rem 0 0">Reschedule requested: <b>${esc(reqWhen(a.req))}</b>. Waiting for the salon to approve. Your current time stays booked until then.</div>`
          : `<div class="msg" style="margin:.5rem 0 0">Your request to move to ${esc(reqWhen(a.req))} was declined${a.req.reason ? ": " + esc(a.req.reason) : ""}. Your original time is kept.</div>`;
        const note = a.status === "pending" ? "<small>Your time slot is held for a few minutes until you upload your payment receipt.</small>"
          : past && ["confirmed", "verifying", "waiting", "service"].includes(a.status) ? "<small>This appointment time has passed. It will move to Completed once the salon marks your visit as done.</small>"
          : a.status === "verifying" ? "<small>We received your receipt. The salon will confirm your booking once they have checked the payment.</small>" : "";
        return `${rq}<p class="row" style="justify-content:flex-start;gap:.4rem;margin:.5rem 0 0">${b.join("")}</p>${note}`;
      }
      async function apptDetails(id) {
        const a = DB.appts.find((x) => x.id === id);
        if (!a) return;
        let H = [];
        try { H = await FN.myAppointmentHistory(id); } catch (e) { /* details still show without the timeline */ }
        const row = (k, v) => (v ? `<dt>${k}</dt><dd>${v}</dd>` : "");
        const when = (iso) => new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        modal(`<h3>Appointment details</h3><p style="margin-top:0">${pill(a.status)}</p><dl class="sumlist">${row("Booking number", "<b>" + esc(a.code) + "</b>")}${row("Services", esc(a.svc))}${row("Date & time", bfl(a.date) + " at " + m2t(a.start) + " to " + m2t(a.start + a.dur))}${row("Duration", a.estD)}${row("Technician", a.staff ? esc(te(a.staff)) : "Any available technician")}${row(a.status === "completed" ? "Total" : "Estimated price", a.estP || php(a.price))}${row("Paid", a.paid ? php(a.paid) : "")}${a.req && a.req.status === "pending" ? row("Requested new time", esc(reqWhen(a.req)) + " <small>(waiting for approval)</small>") : ""}${row("Waiting to be checked", a.sent ? php(a.sent) : "")}${row("Notes", esc(a.notes))}</dl>${H.length ? `<h3 style="font-size:1rem;margin:1rem 0 .3rem">History</h3>${H.map((h) => `<div style="border-top:1px solid var(--line);padding:.4rem 0"><small class="mute">${when(h.created_at)}</small><br>${esc(h.action)}</div>`).join("")}` : ""}${MF(`${canMove(a) ? `<button class="btn w" onclick="modal();openResched('${a.id}')">Reschedule</button>` : ""}<button class="btn" onclick="modal()">Close</button>`)}`);
      }
      let RSC = null; // reschedule in progress: { id, tech, date, slot, ds, warn }
      function openResched(id) {
        const a = DB.appts.find((x) => x.id === id);
        if (!a) return;
        RSC = { id, tech: a.staff || 0, date: null, slot: null, ds: 0, warn: "" };
        P = "mine"; render(); scrollTo(0, 0);
      }
      function reschedView() {
        const a = DB.appts.find((x) => x.id === RSC.id);
        if (!a || !canMove(a)) { RSC = null; return mine(); }
        const t0 = new Date(); t0.setHours(0, 0, 0, 0);
        const days = [...Array(7)].map((_, i) => { const d = new Date(t0); d.setDate(d.getDate() + RSC.ds * 7 + i); return d; }),
          f = RSC.date ? free(RSC.date, a.dur, 0, RSC.tech) : [],
          grp = [["Morning", (x) => x < 720], ["Afternoon", (x) => x >= 720 && x < 1020], ["Evening", (x) => x >= 1020]];
        return W(`<h2>Reschedule appointment</h2><div class="card"><small>Current booking · ${esc(a.code)}</small><br><b>${esc(a.svc)}</b><br><small>${bfl(a.date)} at ${m2t(a.start)} · ${a.estD}${a.staff ? " · with " + esc(te(a.staff)) : ""}</small></div>
<label for="rs_t">Technician</label><select id="rs_t" onchange="RSC.tech=+this.value;RSC.slot=null;RSC.warn='';render()"><option value="0">Any available technician</option>${TE.map((t) => `<option value="${t.id}" ${RSC.tech === t.id ? "selected" : ""}>${esc(t.n)} · ${esc(t.sp)}</option>`).join("")}</select>
<h3 style="margin:1rem 0 .3rem">Pick a new date and time</h3><div class="row" style="margin-top:.6rem"><button class="btn sm w" ${RSC.ds ? "" : "disabled"} onclick="RSC.ds--;render()" aria-label="Previous week">‹</button><b>${bfl(fmt(days[0]))} to ${bfl(fmt(days[6]))}</b><button class="btn sm w" ${RSC.ds >= 7 ? "disabled" : ""} onclick="RSC.ds++;render()" aria-label="Next week">›</button></div><div class="dstrip">${days.map((d) => { const iso = fmt(d); return `<button class="chip ${RSC.date === iso ? "on" : ""}" ${free(iso, a.dur, 0, RSC.tech).length ? "" : "disabled"} onclick="RSC.date='${iso}';RSC.slot=null;RSC.warn='';render()"><small>${DN[d.getDay()]}</small><br><b>${d.getDate()}</b></button>`; }).join("")}</div>${RSC.warn ? `<div class="msg">${esc(RSC.warn)}</div>` : ""}${RSC.date ? grp.map(([n, fn]) => { const L = f.filter(fn); return L.length ? `<h3 style="font-size:1rem;margin:.8rem 0 .2rem">${n}</h3><div class="chips" style="margin-top:0">${L.map((t) => `<button class="chip ${RSC.slot === t ? "on" : ""}" onclick="RSC.slot=${t};RSC.warn='';render()">${m2t(t)}</button>`).join("")}</div>` : ""; }).join("") || '<div class="msg">No times left that day. Pick another day.</div>' : '<p class="mute">Pick a day to see the available times.</p>'}
<p class="mute">The salon will review your request. Your current time stays booked until they approve it, and your payment and booking number stay the same.</p><p class="row" style="justify-content:flex-start;gap:.6rem"><button class="btn w" onclick="RSC=null;render()">Back</button><button class="btn" ${RSC.slot == null ? 'disabled style="opacity:.4"' : ""} onclick="askResched()">Request new time</button></p>`, 720);
      }
      function askResched() {
        const a = DB.appts.find((x) => x.id === RSC.id);
        if (!a || RSC.slot == null) return;
        modal(`<h3>Request this new time?</h3><dl class="sumlist"><dt>From</dt><dd>${bfl(a.date)} at ${m2t(a.start)}</dd><dt>To</dt><dd><b>${bfl(RSC.date)} at ${m2t(RSC.slot)}</b></dd><dt>Technician</dt><dd>${RSC.tech ? esc(te(RSC.tech)) : "Any available technician"}</dd></dl>${MF(`<button class="btn w" onclick="modal()">Back</button><button class="btn" onclick="doResched()">Send request</button>`)}`);
      }
      async function doResched() {
        modal();
        try {
          await FN.rescheduleMyBooking(RSC.id, RSC.date, RSC.slot, RSC.tech);
          clearSlots(); await loadAppts(); RSC = null; render(); scrollTo(0, 0);
          modal(`<h3>Request sent</h3><p>The salon will review your request. Your current appointment stays booked until they approve the new time, and you'll see the update in My Appointments.</p>${MF('<button class="btn" onclick="modal()">OK</button>')}`);
        } catch (e) {
          clearSlots();
          if (RSC) { RSC.slot = null; RSC.warn = e.message || "Something went wrong. Please try again."; }
          render();
        }
      }
      const askCancel = (id) =>
        modal(`<h3>Cancel this appointment?</h3><p>Your ₱${DB.deposit} reservation deposit may be forfeited if you cancel.</p>${MF(`<button class="btn w" onclick="modal()">Keep appointment</button><button class="btn" onclick="askCancel2('${id}')">Cancel</button>`)}`);
      // Second check so a booking is never cancelled by a stray tap.
      function askCancel2(id) {
        const a = DB.appts.find((x) => x.id === id);
        modal(`<h3>Are you sure?</h3><p>This will cancel your appointment${a ? ` for <b>${esc(a.svc)}</b> on <b>${bfl(a.date)} at ${m2t(a.start)}</b>` : ""}. Your time slot will be released and this can't be undone.</p>${MF(`<button class="btn w" onclick="modal()">Keep appointment</button><button class="btn" onclick="cancelBk('${id}')">Cancel appointment</button>`)}`);
      }
      const askWithdraw = (id) =>
        modal(`<h3>Withdraw your reschedule request?</h3><p>Your appointment will stay at its current time.</p>${MF(`<button class="btn w" onclick="modal()">Keep request</button><button class="btn" onclick="doWithdraw('${id}')">Withdraw request</button>`)}`);
      async function doWithdraw(id) {
        const a = DB.appts.find((x) => x.id === id);
        try { if (a && a.req) await FN.cancelMyReschedule(a.req.id); clearSlots(); await loadAppts(); modal(); render(); }
        catch (e) { modal(`<h3>Could not withdraw</h3><p>${esc(e.message)}</p>${MF('<button class="btn w" onclick="modal()">Close</button>')}`); }
      }
      async function cancelBk(id) {
        try { await FN.cancelMyBooking(id); await loadAppts(); modal(); render(); }
        catch (e) { modal(`<h3>Could not cancel</h3><p>${esc(e.message)}</p>${MF('<button class="btn w" onclick="modal()">Close</button>')}`); }
      }
      FNready.then(boot);
    
