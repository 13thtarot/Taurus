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
  var a = p.appointments, url = "";
  try { url = await FN.receiptUrl(p.receipt_path); } catch (e) { return toast("Could not open the receipt. Please try again."); }
  modal('<h3>Check payment · ' + esc(a.code) + '</h3>' +
    '<p class="mute" style="margin-top:0">' + esc(a.customer_name) + ' · ' + pckWhen(a.start_at) + '<br>Expected <b>' + pckMoney(p.amount) + '</b> by ' + (p.method === "maya" ? "Maya" : "GCash") + ' (' + (p.pay_option === "full" ? "full payment" : "down payment") + ')</p>' +
    '<a href="' + esc(url) + '" target="_blank" rel="noopener"><img src="' + esc(url) + '" alt="Payment receipt" style="display:block;width:100%;max-height:60vh;object-fit:contain;border:1px solid var(--line);border-radius:10px;background:#fff"></a>' +
    '<small class="mute">Tap the image to open it full size. Compare the amount and reference number with your GCash / Maya history.</small>' +
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
