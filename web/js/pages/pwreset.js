/*
 * "Forgot password?" for the staff and owner portals (classic script, load BEFORE the page script).
 * Uses the page's own globals: FN, modal, MF, toast, esc.
 *   pwrForgot()            open the "send me a reset link" dialog (from the sign-in card)
 *   pwrStart(state, next)  call at start-up when recoveryFromUrl() returned "reset" or "expired";
 *                          next() continues the normal start-up once the new password is saved
 */
var PWR_NEXT = null;

function pwrLink() {
  return '<p style="margin:.4rem 0 0;text-align:right"><a class="pr" style="cursor:pointer" onclick="pwrForgot()"><small>Forgot password?</small></a></p>';
}

function pwrForgot(err, val) {
  modal('<h3>Reset your password</h3><p class="mute" style="margin-top:0">Enter the email or username on your account and we\'ll send you a link to set a new password.</p>' +
    '<label for="pwr_e">Email or username</label><input id="pwr_e" autocomplete="username" autocapitalize="none" placeholder="you@example.com" value="' + esc(val || "") + '" onkeydown="if(event.key===\'Enter\')pwrSend()">' +
    (err ? '<div class="msg">' + esc(err) + '</div>' : "") +
    MF('<button class="btn w" onclick="modal()">Cancel</button><button class="btn" onclick="pwrSend()">Send reset link</button>'));
  setTimeout(function () { var i = document.getElementById("pwr_e"); i && i.focus(); }, 50);
}

async function pwrSend() {
  var v = (document.getElementById("pwr_e").value || "").trim();
  if (!v) return pwrForgot("Enter your email address.", v);
  try {
    await FN.sendPasswordReset(v);
    modal('<h3>Check your email</h3><p>If an account uses <b>' + esc(v) + '</b>, we\'ve sent it a link to reset your password. The link works once and expires after about an hour.</p><p class="mute">Not there after a few minutes? Check your spam folder.</p>' +
      MF('<button class="btn" onclick="modal()">OK</button>'));
  } catch (e) { pwrForgot(e.message, v); }
}

function pwrStart(state, next) {
  PWR_NEXT = next || null;
  if (state === "reset") return pwrNew();
  modal('<h3>This link has expired</h3><p>Password reset links work only once and expire after about an hour. Please ask for a new one.</p>' +
    MF('<button class="btn w" onclick="modal()">Close</button><button class="btn" onclick="pwrForgot()">Send a new link</button>'));
}

var PWR_RULES = [
  ["at least 8 characters", function (p) { return p.length >= 8; }],
  ["an uppercase letter", function (p) { return /[A-Z]/.test(p); }],
  ["a lowercase letter", function (p) { return /[a-z]/.test(p); }],
  ["a number", function (p) { return /\d/.test(p); }],
  ["a special character", function (p) { return /[^A-Za-z0-9\s]/.test(p); }],
  ["no spaces", function (p) { return !/\s/.test(p); }],
];

function pwrNew(err) {
  modal('<h3>Choose a new password</h3><p class="mute" style="margin-top:0">Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character.</p>' +
    '<label for="pwr_1">New password</label><div class="pwrow"><input id="pwr_1" type="password" autocomplete="new-password" maxlength="72"><button class="eye" type="button" onclick="togglePassword(\'pwr_1\',this)">Show</button></div>' +
    '<label for="pwr_2">Confirm new password</label><div class="pwrow"><input id="pwr_2" type="password" autocomplete="new-password" maxlength="72" onkeydown="if(event.key===\'Enter\')pwrSave()"><button class="eye" type="button" onclick="togglePassword(\'pwr_2\',this)">Show</button></div>' +
    (err ? '<div class="msg">' + esc(err) + '</div>' : "") +
    MF('<button class="btn" onclick="pwrSave()">Save new password</button>'));
}

async function pwrSave() {
  var a = document.getElementById("pwr_1").value, b = document.getElementById("pwr_2").value;
  var missing = PWR_RULES.filter(function (r) { return !r[1](a); }).map(function (r) { return r[0]; });
  if (missing.length) return pwrNew("Your password still needs " + missing.join(", ") + ".");
  if (a !== b) return pwrNew("The two passwords do not match.");
  try {
    await FN.updatePassword(a);
    modal('<h3>Password updated</h3><p>Your new password is saved.</p>' + MF('<button class="btn" onclick="pwrDone()">Continue</button>'));
  } catch (e) { pwrNew(e.message); }
}

function pwrDone() {
  modal();
  var n = PWR_NEXT; PWR_NEXT = null;
  if (n) n();
}
