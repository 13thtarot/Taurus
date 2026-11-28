/*
 * "Payment checks" screen, shared by the staff and owner portals (classic script, load BEFORE the page script).
 * Customers pay by GCash / Maya and upload a receipt; staff open it, check the money arrived, then approve or reject.
 * Uses the page's own globals: FN, modal, MF, toast, esc, render.
 */
var PCK = { list: [], loaded: false, loading: false, err: "" };

function pckMoney(n) { return "₱" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function pckWhen(iso) {
  return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function pckAgo(iso) {
  var m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago";
}

async function pckLoad(quiet) {
  if (PCK.loading) return;
  PCK.loading = true;
  try { PCK.list = await (quiet ? FN.raw || FN : FN).pendingReceipts(); PCK.err = ""; }
  catch (e) { PCK.err = (e && e.message) || "Could not load payments."; }
  PCK.loaded = true; PCK.loading = false;
}

function pckHTML() {
  if (!PCK.loaded) { pckLoad().then(render); return '<p class="mute">Loading payments…</p>'; }
  var head = '<div class="row" style="justify-content:space-between;margin-bottom:.8rem"><p class="mute" style="margin:0">Open each receipt and check that the money arrived in the salon\'s GCash or Maya account before approving.</p><button class="btn w" onclick="pckLoad().then(render)">Refresh</button></div>';
  if (PCK.err) return head + '<div class="msg">' + esc(PCK.err) + '</div>';
  if (!PCK.list.length) return head + '<div class="card"><p class="mute" style="margin:0">No payments waiting to be checked.</p></div>';
  var rows = PCK.list.map(function (p) {
    var a = p.appointments, svc = (a.appointment_items || []).map(function (i) { return i.name; }).join(", ");
    return '<tr><td>' + esc(a.customer_name) + '<br><small>' + esc(a.code) + ' · ' + esc(a.customer_phone || "") + '</small></td>' +
      '<td>' + esc(svc) + '<br><small>' + pckWhen(a.start_at) + '</small></td>' +
      '<td><b>' + pckMoney(p.amount) + '</b><br><small>' + (p.pay_option === "full" ? "Full payment" : "Down payment") + ' · ' + (p.method === "maya" ? "Maya" : "GCash") + '</small></td>' +
      '<td><small>' + pckAgo(p.created_at) + '</small></td>' +
      '<td class="row"><button class="btn" onclick="pckView(\'' + p.id + '\')">Check receipt</button></td></tr>';
  }).join("");
  return head + '<div class="card"><div class="tbl"><table><tr><th>Customer</th><th>Booking</th><th>Amount</th><th>Sent</th><th></th></tr>' + rows + '</table></div></div>';
}

async function pckView(id) {
  var p = PCK.list.find(function (x) { return x.id === id; });
  if (!p) return;
  var a = p.appointments, url = "", pdf = /\.pdf$/i.test(p.receipt_path || "");
  try { url = await FN.receiptUrl(p.receipt_path); } catch (e) { return toast("Could not open the receipt. Please try again."); }
  modal('<h3>Check payment · ' + esc(a.code) + '</h3>' +
    '<p class="mute" style="margin-top:0">' + esc(a.customer_name) + ' · ' + pckWhen(a.start_at) + '<br>Expected <b>' + pckMoney(p.amount) + '</b> by ' + (p.method === "maya" ? "Maya" : "GCash") + ' (' + (p.pay_option === "full" ? "full payment" : "down payment") + ')</p>' +
    (pdf
      ? '<iframe src="' + esc(url) + '" title="Payment receipt (PDF)" style="display:block;width:100%;height:60vh;border:1px solid var(--line);border-radius:10px;background:#fff"></iframe>' +
        '<p style="margin:.4rem 0"><a class="btn w sm" href="' + esc(url) + '" target="_blank" rel="noopener">Open the PDF in a new tab</a></p>'
      : '<a href="' + esc(url) + '" target="_blank" rel="noopener"><img src="' + esc(url) + '" alt="Payment receipt" style="display:block;width:100%;max-height:60vh;object-fit:contain;border:1px solid var(--line);border-radius:10px;background:#fff"></a>') +
    '<small class="mute">' + (pdf ? "This receipt is a PDF." : "Tap the image to open it full size.") + ' Compare the amount and reference number with your GCash / Maya history.</small>' +
    MF('<button class="btn w" onclick="modal()">Close</button><button class="btn w" onclick="pckReject(\'' + id + '\')">Reject</button><button class="btn" onclick="pckApprove(\'' + id + '\')">Approve</button>'));
}

async function pckApprove(id) {
  try {
    await FN.reviewPayment(id, true);
    modal(); toast("Payment approved. The booking is confirmed.");
  } catch (e) { toast(pckErr(e)); }
  await pckLoad(true); render();
}

function pckReject(id) {
  modal('<h3>Reject this payment?</h3><p class="mute">The booking will be cancelled, the time slot released, and the customer will see your reason.</p>' +
    '<label for="pck_r">Reason</label><select id="pck_r_pick" onchange="document.getElementById(\'pck_r\').value=this.value"><option value="">Choose a reason…</option><option>Payment not received</option><option>Amount does not match</option><option>Receipt is unclear or unreadable</option><option>Receipt was already used</option></select>' +
    '<input id="pck_r" placeholder="Or type your own reason" maxlength="200">' +
    MF('<button class="btn w" onclick="pckView(\'' + id + '\')">Back</button><button class="btn" onclick="pckRejectGo(\'' + id + '\')">Reject payment</button>'));
}

async function pckRejectGo(id) {
  var r = (document.getElementById("pck_r").value || "").trim();
  if (r.length < 3) return toast("Enter a reason for the customer.");
  try {
    await FN.reviewPayment(id, false, r);
    modal(); toast("Payment rejected. The customer has been told.");
  } catch (e) { toast(pckErr(e)); }
  await pckLoad(true); render();
}

function pckErr(e) {
  var m = String((e && e.message) || "");
  if (/ALREADY_REVIEWED/.test(m)) return "Someone already checked this payment.";
  if (/NOT_AWAITING_PAYMENT/.test(m)) return "This booking is no longer waiting for payment.";
  if (/FORBIDDEN/.test(m)) return "Your account can't approve payments.";
  return m || "Something went wrong.";
}

/* ---------- menu counts (#5): how many receipts and reschedule requests are waiting ---------- */
function navCount(k) {
  var n = k === "pay" ? PCK.list.length : k === "resched" ? RSQ.list.length : 0;
  return n ? ' <span class="nbadge" title="' + n + ' waiting">' + n + "</span>" : "";
}
// Reloads both lists quietly; true when a count changed (so the page only redraws when needed).
async function countsLoad() {
  var before = PCK.list.length + "|" + RSQ.list.length;
  await Promise.all([pckLoad(true), rsqLoad(true)]);
  return before !== PCK.list.length + "|" + RSQ.list.length;
}

/* ---------- "Reschedule requests": customers ask to move a booking; staff approve or decline ---------- */
var RSQ = { list: [], loaded: false, loading: false, err: "" };

function rsqTech(id) {
  if (!id) return "Any available technician";
  var L = (typeof TE !== "undefined" && TE && TE.length) ? TE : (typeof DB !== "undefined" && DB.TE) || [];
  var t = L.find(function (x) { return x.id === id; });
  return t ? t.n : "Technician #" + id;
}
function rsqSpan(a, b, tech) {
  var t = function (iso) { return new Date(iso).toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" }); };
  var d = new Date(a).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", weekday: "short", month: "short", day: "numeric" });
  return "<b>" + d + "</b>, " + t(a) + " to " + t(b) + "<br><small>" + esc(rsqTech(tech)) + "</small>";
}

async function rsqLoad(quiet) {
  if (RSQ.loading) return;
  RSQ.loading = true;
  try { RSQ.list = await (quiet ? FN.raw || FN : FN).pendingReschedules(); RSQ.err = ""; }
  catch (e) { RSQ.err = (e && e.message) || "Could not load reschedule requests."; }
  RSQ.loaded = true; RSQ.loading = false;
}

function rsqHTML() {
  if (!RSQ.loaded) { rsqLoad().then(render); return '<p class="mute">Loading reschedule requests…</p>'; }
  var head = '<div class="row" style="justify-content:space-between;margin-bottom:.8rem"><p class="mute" style="margin:0">Customers asked to move these bookings. The requested time is held until you decide. Check the technician and the day\'s schedule, then approve or decline.</p><button class="btn w" onclick="rsqLoad().then(render)">Refresh</button></div>';
  if (RSQ.err) return head + '<div class="msg">' + esc(RSQ.err) + '</div>';
  if (!RSQ.list.length) return head + '<div class="card"><p class="mute" style="margin:0">No reschedule requests waiting.</p></div>';
  var rows = RSQ.list.map(function (r) {
    var a = r.appointments, svc = (a.appointment_items || []).map(function (i) { return i.name; }).join(", ");
    return '<tr><td>' + esc(a.customer_name) + '<br><small>' + esc(a.code) + ' · ' + esc(a.customer_phone || "") + '</small></td>' +
      '<td>' + esc(svc) + '</td>' +
      '<td>' + rsqSpan(r.old_start, r.old_end, r.old_tech) + '</td>' +
      '<td>' + rsqSpan(r.new_start, r.new_end, r.new_tech) + '</td>' +
      '<td><small>' + pckAgo(r.created_at) + '</small></td>' +
      '<td class="row" style="flex-wrap:nowrap"><button class="btn w sm" onclick="rsqDecline(\'' + r.id + '\')">Decline</button><button class="btn sm" onclick="rsqApprove(\'' + r.id + '\')">Approve</button></td></tr>';
  }).join("");
  return head + '<div class="card"><div class="tbl"><table><tr><th>Customer</th><th>Services</th><th>Current time</th><th>Requested time</th><th>Sent</th><th></th></tr>' + rows + '</table></div></div>';
}

function rsqApprove(id) {
  var r = RSQ.list.find(function (x) { return x.id === id; });
  if (!r) return;
  modal('<h3>Approve this reschedule?</h3><p>' + esc(r.appointments.customer_name) + ' · ' + esc(r.appointments.code) + '</p>' +
    '<dl class="sumlist"><dt>From</dt><dd>' + rsqSpan(r.old_start, r.old_end, r.old_tech) + '</dd><dt>To</dt><dd>' + rsqSpan(r.new_start, r.new_end, r.new_tech) + '</dd></dl>' +
    '<p class="mute">The booking moves to the new time and the customer is notified.</p>' +
    MF('<button class="btn w" onclick="modal()">Back</button><button class="btn" onclick="rsqApproveGo(\'' + id + '\')">Approve</button>'));
}
async function rsqApproveGo(id) {
  try { await FN.reviewReschedule(id, true); modal(); toast("Reschedule approved. The booking has been moved."); }
  catch (e) { modal(); toast(rsqErr(e)); }
  await rsqLoad(true); render();
}

function rsqDecline(id) {
  modal('<h3>Decline this reschedule?</h3><p class="mute">The booking keeps its current time and the customer will see your reason.</p>' +
    '<label for="rsq_r_pick">Reason</label><select id="rsq_r_pick" onchange="document.getElementById(\'rsq_r\').value=this.value"><option value="">Choose a reason…</option><option>That time is no longer available</option><option>The technician is not available then</option><option>Too close to the appointment time</option><option>Please call the salon to arrange a new time</option></select>' +
    '<input id="rsq_r" placeholder="Or type your own reason" maxlength="200">' +
    MF('<button class="btn w" onclick="modal()">Back</button><button class="btn" onclick="rsqDeclineGo(\'' + id + '\')">Decline request</button>'));
}
async function rsqDeclineGo(id) {
  var reason = (document.getElementById("rsq_r").value || "").trim();
  if (reason.length < 3) return toast("Enter a reason for the customer.");
  try { await FN.reviewReschedule(id, false, reason); modal(); toast("Request declined. The customer has been told."); }
  catch (e) { modal(); toast(rsqErr(e)); }
  await rsqLoad(true); render();
}
function rsqErr(e) {
  var m = String((e && e.message) || "");
  if (/SLOT_UNAVAILABLE|just taken/i.test(m)) return "That time is no longer free. Decline the request so the customer can pick another time.";
  if (/ALREADY_REVIEWED|already handled/i.test(m)) return "Someone already handled this request.";
  if (/NOT_RESCHEDULABLE|no longer be rescheduled/i.test(m)) return "This booking can no longer be moved.";
  return m || "Something went wrong.";
}
