/*
 * "New booking" for customers who call or message the salon. Shared by the staff and owner portals
 * (classic script, load BEFORE the page script). Uses the page's own globals: FN, modal, MF, toast, esc, render, DB.
 * The booking is confirmed right away and paid at the salon. The database re-checks the time slot.
 */
var PB = null;

function pbToday() {
  var p = {};
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
  return p.year + "-" + p.month + "-" + p.day;
}
function pbKey() { return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/-/g, ""); }
function pbMoney(n) { return "₱" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function pbTime(m) { var h = Math.floor(m / 60); return (h % 12 || 12) + ":" + String(m % 60).padStart(2, "0") + (h < 12 ? " AM" : " PM"); }
function pbDur(m) { return m >= 60 ? +(m / 60).toFixed(2) + (m === 60 ? " hr" : " hrs") : m + " min"; }
function pbDay(d) { return new Date(d + "T00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" }); }
function pbServices() { return (DB.SV || []).filter(function (s) { return s.on !== false; }); }
function pbTechs() {
  var L = (typeof TE !== "undefined" && TE && TE.length) ? TE : (DB.TE || []);
  return L.filter(function (t) { return t.on !== false; });
}
function pbSel() { return pbServices().filter(function (s) { return PB.sel.indexOf(s.id) >= 0; }); }
function pbMins() { return pbSel().reduce(function (t, s) { return t + (s.dx || s.d || 0); }, 0); }
function pbAddOn(s) { return /add-on/i.test(s.g || ""); }

function pbOpen() {
  var cats = [];
  pbServices().forEach(function (s) { if (cats.indexOf(s.g) < 0) cats.push(s.g); });
  PB = { q: "", found: null, cust: null, name: "", phone: "", email: "", notes: "", sel: [], cat: cats[0] || "", tech: 0,
    date: pbToday(), slot: null, slots: null, slotsKey: "", err: "", busy: false, review: false, idem: pbKey() };
  pbDraw();
}

// Loads free times for the chosen services, technician and date (each answer is matched to its question).
function pbLoadSlots() {
  var mins = pbMins();
  if (!PB || !mins || !PB.date) { if (PB) { PB.slots = null; PB.slotsKey = ""; } return; }
  var key = PB.date + "|" + mins + "|" + PB.tech;
  if (PB.slotsKey === key) return;
  PB.slotsKey = key; PB.slots = "loading";
  (FN.raw || FN).slotsFor(PB.date, mins, PB.tech).then(function (L) {
    if (!PB || PB.slotsKey !== key) return;
    PB.slots = L;
    if (!document.querySelector("#md .pb")) return; // the form was closed or is on the review screen
    if (PB.slot != null && L.indexOf(PB.slot) < 0) PB.slot = null;
    pbDraw();
  }, function () { if (PB && PB.slotsKey === key) { PB.slots = []; PB.err = "Could not load the free times. Try again."; if (document.querySelector("#md .pb")) pbDraw(); } });
}

function pbDraw() {
  if (!PB) return;
  if (PB.review) return pbReviewDraw();
  pbLoadSlots();
  var sv = pbServices(), cats = [], sel = pbSel(), mins = pbMins();
  sv.forEach(function (s) { if (cats.indexOf(s.g) < 0) cats.push(s.g); });
  var onlyAdd = sel.length > 0 && sel.every(pbAddOn);
  var price = sel.reduce(function (t, s) { return t + (s.p || 0); }, 0), priceMax = sel.reduce(function (t, s) { return t + (s.px || s.p || 0); }, 0);

  var found = PB.found === null ? "" : PB.found === "loading" ? '<small class="mute">Searching…</small>'
    : !PB.found.length ? '<small class="mute">No customer account found. Fill in the details below to book without an account.</small>'
    : '<div class="pb-found">' + PB.found.map(function (c) {
        return '<button type="button" class="pb-cust" onclick="pbUse(\'' + c.id + '\')"><b>' + esc(c.full_name || c.username || "Customer") + '</b><br><small>' + esc([c.phone, c.email].filter(Boolean).join(" · ")) + "</small></button>";
      }).join("") + "</div>";

  var times = !sel.length ? '<p class="mute" style="margin:.3rem 0">Pick the services first.</p>'
    : onlyAdd ? '<div class="msg">Nail art and add-ons are done on top of another service. Add a manicure, pedicure, gel or extension service.</div>'
    : PB.slots === "loading" || PB.slots === null ? '<p class="mute" style="margin:.3rem 0">Loading free times…</p>'
    : !PB.slots.length ? '<div class="msg">No free times that day' + (PB.tech ? " for this technician" : "") + ". Try another day" + (PB.tech ? " or “Any available technician”" : "") + ".</div>"
    : '<div class="chips" style="margin-top:.3rem">' + PB.slots.map(function (t) {
        return '<button type="button" class="chip ' + (PB.slot === t ? "on" : "") + '" onclick="PB.slot=' + t + ';PB.err=\'\';pbDraw()">' + pbTime(t) + "</button>";
      }).join("") + "</div>";

  modal('<div class="pb"><h3>New booking</h3><p class="mute" style="margin-top:0">For a customer who called or messaged the salon. The booking is confirmed right away and paid at the salon.</p>' +
    '<h4>1. Customer</h4>' +
    (PB.cust ? '<div class="msg ok" style="margin:.3rem 0">Linked to the account of <b>' + esc(PB.cust.name) + '</b>. It will show in their My Appointments. <a class="pr" style="cursor:pointer" onclick="PB.cust=null;pbDraw()">Unlink</a></div>'
      : '<div class="row" style="justify-content:flex-start;gap:.4rem"><input id="pb_q" style="flex:1;min-width:10rem" placeholder="Find an existing customer: name, mobile or email" value="' + esc(PB.q) + '" oninput="PB.q=this.value" onkeydown="if(event.key===\'Enter\')pbFind()"><button type="button" class="btn w sm" onclick="pbFind()">Search</button></div>' + found) +
    '<div class="pb-two"><div><label for="pb_n">Name</label><input id="pb_n" maxlength="60" value="' + esc(PB.name) + '" oninput="PB.name=this.value" placeholder="e.g. Maria Santos"></div>' +
    '<div><label for="pb_p">Mobile number</label><input id="pb_p" inputmode="numeric" maxlength="11" value="' + esc(PB.phone) + '" oninput="this.value=this.value.replace(/\\D/g,\'\');PB.phone=this.value" placeholder="09XXXXXXXXX"></div></div>' +
    '<label for="pb_e">Email (optional)</label><input id="pb_e" type="email" maxlength="120" value="' + esc(PB.email) + '" oninput="PB.email=this.value" placeholder="you@example.com">' +
    '<h4>2. Services</h4><select onchange="PB.cat=this.value;pbDraw()">' + cats.map(function (g) { return '<option ' + (g === PB.cat ? "selected" : "") + ">" + esc(g) + "</option>"; }).join("") + "</select>" +
    '<div class="pb-svcs">' + sv.filter(function (s) { return s.g === PB.cat; }).map(function (s) {
      return '<label class="pb-svc"><input type="checkbox" ' + (PB.sel.indexOf(s.id) >= 0 ? "checked" : "") + ' onchange="pbToggle(' + s.id + ')"><span>' + esc(s.n) + '<br><small>' + pbDur(s.dx || s.d) + "</small></span><b>" + pbMoney(s.p) + (s.px > s.p ? "+" : "") + "</b></label>";
    }).join("") + "</div>" +
    (sel.length ? '<small class="mute">Selected: <b>' + sel.map(function (s) { return esc(s.n); }).join(", ") + "</b> · " + pbDur(mins) + " · " + pbMoney(price) + (priceMax > price ? " to " + pbMoney(priceMax) : "") + "</small>" : "") +
    '<h4>3. Technician, date and time</h4><div class="pb-two"><div><label for="pb_t">Technician</label><select id="pb_t" onchange="PB.tech=+this.value;PB.slot=null;pbDraw()"><option value="0">Any available technician</option>' +
    pbTechs().map(function (t) { return '<option value="' + t.id + '" ' + (PB.tech === t.id ? "selected" : "") + ">" + esc(t.n) + (t.sp ? " · " + esc(t.sp) : "") + "</option>"; }).join("") + "</select></div>" +
    '<div><label for="pb_d">Date</label><input id="pb_d" type="date" min="' + pbToday() + '" value="' + PB.date + '" onchange="PB.date=this.value;PB.slot=null;pbDraw()"></div></div>' + times +
    '<label for="pb_x">Note (optional)</label><input id="pb_x" maxlength="500" value="' + esc(PB.notes) + '" oninput="PB.notes=this.value" placeholder="e.g. design ideas, or how the customer contacted you">' +
    (PB.err ? '<div class="msg">' + esc(PB.err) + "</div>" : "") +
    MF('<button class="btn w" onclick="PB=null;modal()">Cancel</button><button class="btn" onclick="pbCheck()">Review booking</button>') + "</div>");
}

function pbToggle(id) {
  var i = PB.sel.indexOf(id);
  if (i >= 0) PB.sel.splice(i, 1); else PB.sel.push(id);
  PB.slot = null; PB.err = "";
  pbDraw();
}
function pbFind() {
  var q = (PB.q || "").trim();
  if (q.length < 2) { PB.err = "Type at least 2 letters or numbers to search."; return pbDraw(); }
  PB.err = ""; PB.found = "loading"; pbDraw();
  (FN.raw || FN).findCustomers(q).then(function (L) { if (PB) { PB.found = L; if (document.querySelector("#md .pb")) pbDraw(); } },
    function () { if (PB) { PB.found = null; PB.err = "Could not search customers. Try again."; if (document.querySelector("#md .pb")) pbDraw(); } });
}
function pbUse(id) {
  var c = (PB.found || []).find(function (x) { return x.id === id; });
  if (!c) return;
  PB.cust = { id: c.id, name: c.full_name || c.username || "Customer" };
  PB.name = c.full_name || PB.name;
  PB.phone = String(c.phone || PB.phone || "").replace(/\D/g, "").slice(0, 11);
  PB.email = c.email || PB.email;
  PB.found = null; PB.q = "";
  pbDraw();
}
function pbCheck() {
  var sel = pbSel(), name = (PB.name || "").trim().replace(/\s+/g, " "), email = (PB.email || "").trim();
  PB.err = name.length < 2 ? "Enter the customer's name."
    : !/^09\d{9}$/.test(PB.phone || "") ? "Enter an 11-digit mobile number that starts with 09."
    : email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Enter a valid email address, or leave it blank."
    : !sel.length ? "Pick at least one service."
    : sel.every(pbAddOn) ? "Add a manicure, pedicure, gel or extension service before nail art or add-ons."
    : PB.slot == null ? "Pick a time." : "";
  if (PB.err) return pbDraw();
  PB.name = name; PB.email = email; PB.review = true;
  pbDraw();
}
function pbReviewDraw() {
  var sel = pbSel(), t = pbTechs().find(function (x) { return x.id === PB.tech; });
  modal('<h3>Book this appointment?</h3><dl class="sumlist">' +
    "<dt>Customer</dt><dd>" + esc(PB.name) + "<br><small>" + esc(PB.phone) + (PB.email ? " · " + esc(PB.email) : "") + (PB.cust ? " · linked to their account" : "") + "</small></dd>" +
    "<dt>Services</dt><dd>" + sel.map(function (s) { return esc(s.n); }).join(", ") + "</dd>" +
    "<dt>When</dt><dd><b>" + pbDay(PB.date) + " at " + pbTime(PB.slot) + "</b> to " + pbTime(PB.slot + pbMins()) + "</dd>" +
    "<dt>Technician</dt><dd>" + (t ? esc(t.n) : "Any available technician") + "</dd>" +
    (PB.notes ? "<dt>Note</dt><dd>" + esc(PB.notes) + "</dd>" : "") + "</dl>" +
    '<p class="mute">The booking is confirmed now and paid at the salon.' + (PB.cust ? " The customer sees it in My Appointments." : " Tell the customer their booking number after you book.") + "</p>" +
    (PB.err ? '<div class="msg">' + esc(PB.err) + "</div>" : "") +
    MF('<button class="btn w" onclick="PB.review=false;pbDraw()">Back</button><button class="btn" ' + (PB.busy ? "disabled" : "") + ' onclick="pbSave()">' + (PB.busy ? "Booking…" : "Book appointment") + "</button>"));
}
async function pbSave() {
  if (!PB || PB.busy) return;
  PB.busy = true; PB.err = ""; pbDraw();
  try {
    var r = await FN.staffCreateBooking({ serviceIds: PB.sel.slice(), date: PB.date, startMin: PB.slot, techId: PB.tech,
      name: PB.name, phone: PB.phone, email: PB.email, notes: PB.notes, customerId: PB.cust ? PB.cust.id : null, idem: PB.idem });
    var a = (r && r.appointment) || {}, when = pbDay(PB.date) + " at " + pbTime(PB.slot), who = PB.name, day = PB.date;
    PB = null;
    if (typeof setDay === "function") { try { await setDay(day); } catch (e) { /* the list refreshes on its own */ } }
    else if (typeof loadAppts === "function") { try { await loadAppts(); } catch (e) { /* the list refreshes on its own */ } render(); }
    modal('<h3>Appointment booked</h3><p>Booking number <b>' + esc(a.code || "") + "</b> for <b>" + esc(who) + "</b> on <b>" + when + "</b>.</p><p class=\"mute\">Give the customer this booking number. It is paid at the salon.</p>" + MF('<button class="btn" onclick="modal()">Done</button>'));
  } catch (e) {
    var m = String((e && e.message) || "");
    PB.busy = false;
    if (/SLOT_UNAVAILABLE|just taken/i.test(m)) { PB.review = false; PB.slot = null; PB.slotsKey = ""; PB.err = "That time was just taken. Pick another time."; }
    else PB.err = m || "Something went wrong. Please try again.";
    pbDraw();
  }
}
