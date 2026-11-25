const $=q=>document.querySelector(q),pad=n=>String(n).padStart(2,"0"),
php=n=>"₱"+Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2}),
esc=s=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const MN=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Manila",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}),
parts=d=>Object.fromEntries(MN.formatToParts(new Date(d)).map(x=>[x.type,x.value])),
today=()=>{const p=parts(Date.now());return `${p.year}-${p.month}-${p.day}`},
hm=iso=>{const p=parts(iso);return `${p.hour}:${p.minute}`};
const LB={confirmed:"Confirmed",waiting:"Waiting",service:"In service",completed:"Completed",cancelled:"Cancelled",noshow:"No-show",held:"Pending",refunded:"Refunded",voided:"Voided",expired:"Expired"},
pill=s=>`<span class="pill ${s==="held"?"waiting":s}">${LB[s]||esc(s)}</span>`,
ERR={STATUS_LOCKED:"This appointment can no longer be changed.",ASSIGN_TECHNICIAN_FIRST:"Assign a technician first.",TECH_OR_STATION_BUSY:"That technician or station is busy at that time.",NOT_BILLABLE:"This appointment can't be billed.",INVOICE_LOCKED:"This invoice already has a payment, so it can't be edited.",PRICE_OUT_OF_RANGE:"That price is outside the service's price range.",NAME_REQUIRED:"Enter the customer's name.",NO_LINES:"Add at least one service.",TECHNICIAN_REQUIRED:"Pick a technician for every line.",INVALID_METHOD:"Pick a payment method.",FORBIDDEN:"This account isn't allowed to do that."},
toast=m=>{const d=document.createElement("div");d.className="toast noprint";d.textContent=m;document.body.appendChild(d);setTimeout(()=>d.remove(),2800)},
fail=e=>toast(ERR[String((e&&e.message)||"").trim()]||(e&&e.message)||"Something went wrong."),
modal=h=>{document.body.classList.remove("rcp");$("#md").innerHTML=h?`<div class="mb" onclick="if(event.target===this)modal()"><div class="mc">${h}</div></div>`:""},
MF=c=>`<p class="row" style="justify-content:flex-end;margin-bottom:0">${c}</p>`,
box=(t,v,s)=>`<div class="stat"><small>${t}</small><b>${v}</b><small>${s||""}</small></div>`,
opts=(list,sel,blank)=>(blank?`<option value="">${blank}</option>`:"")+list.map(x=>`<option value="${x.id}" ${String(x.id)===String(sel)?"selected":""}>${esc(x.n)}</option>`).join("");
function togglePassword(id,b){const i=document.getElementById(id);if(!i)return;i.type=i.type==="password"?"text":"password";if(b)b.textContent=i.type==="password"?"Show":"Hide"}

const NAV=[["dash","Dashboard"],["appts","Appointments & Queue"],["pay","Payment checks"],["cust","Customer Records"],["bill","Billing & Payment"]];
let ST=null,P="dash",DAY=today(),unwatch=null,
DB={SV:[],TE:[],STN:[],appts:[],walk:[],sales:[],cust:[],q:""};
const sale=a=>Array.isArray(a.sales)?a.sales[0]:a.sales,
svcs=a=>(a.appointment_items||[]).map(i=>i.name).join(", ")||"—",
who=id=>(DB.TE.find(t=>t.id===id)||{n:"Unassigned"}).n,
live=a=>["confirmed","waiting","service"].includes(a.status),
api=q=>q?FN.raw||FN:FN;

async function loadDay(q){
  const [a,w,s]=await Promise.all([api(q).appointmentsForDay(DAY),api(q).walkinQueue(),api(q).todaysSales(today())]);
  DB.appts=a;DB.walk=w;DB.sales=s;
}
async function loadCat(){const c=await FN.loadCatalog();DB.SV=c.SV.filter(s=>s.on);DB.TE=c.TE;DB.STN=(c.raw.stations||[]).filter(s=>s.active!==false).map(s=>({id:s.id,n:s.name||"Station "+s.id}))}
async function afterLogin(){
  const p=await FN.myProfile();
  ST={name:p.full_name||p.username||p.email};
  await Promise.all([loadCat(),loadDay()]);
  if(unwatch)unwatch();
  unwatch=FN.watchStaffBoard(async()=>{ // background refresh: fetch first, then redraw; no loading screen
    await loadDay(true);if(P==="pay")await pckLoad(true);
    if(ST&&!$("#md").innerHTML&&!/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))render();
  });
}
async function refresh(){await loadDay();render()}
const act=async(fn,ok)=>{try{await fn();if(ok)toast(ok);await refresh()}catch(e){fail(e)}};

/* ---------- sign in ---------- */
const plHTML=()=>`<section class="sec"><div class="wrap" style="max-width:420px"><div class="lg" style="width:56px;height:56px;font-size:2rem;margin:0 auto 1rem">f</div><div class="card auth"><h2 style="text-align:center">Staff sign in</h2><p class="mute" style="text-align:center">Sign in to run the salon floor.</p><label>Username or email</label><input id="lu" autocomplete="username" autocapitalize="none"><label for="lp">Password</label><div class="pwrow"><input id="lp" type="password" autocomplete="current-password" onkeydown="if(event.key==='Enter')plog()" placeholder="Enter your password"><button class="eye" type="button" onclick="togglePassword('lp',this)">Show</button></div>${pwrLink()}<div id="le"></div><p><button class="btn" style="width:100%" onclick="plog()">Sign in</button></p></div></div></section>`;
async function plog(){
  const u=$("#lu").value.trim(),p=$("#lp").value;
  if(!u||!p)return $("#le").innerHTML='<div class="msg">Enter your username or email and password.</div>';
  try{
    await FN.signIn(u,p);
    if(!(await FN.requirePortalRole("staff")))return $("#le").innerHTML='<div class="msg">That account does not have staff access.</div>';
    await afterLogin();render();
  }catch(e){$("#le").innerHTML=`<div class="msg">${esc(e.message)}</div>`}
}
async function doSignOut(){if(unwatch)unwatch();unwatch=null;await FN.signOut();ST=null;DB.appts=[];render()}

/* ---------- screens ---------- */
function dash(){
  const a=DB.appts,n=s=>a.filter(x=>x.status===s).length,paid=DB.sales.filter(s=>s.status==="paid").reduce((t,s)=>t+ +s.total,0),
  owing=DB.sales.filter(s=>s.status==="open").reduce((t,s)=>t+ +s.balance_due,0),
  next=a.filter(x=>x.status==="confirmed").slice(0,6);
  return `<div class="stats">${box("Today's bookings",a.filter(x=>!["cancelled","expired","noshow"].includes(x.status)).length,DAY===today()?"today":DAY)}${box("Waiting / in service",n("waiting")+" / "+n("service"),"")}${box("Walk-ins waiting",DB.walk.length,"")}${box("Collected today",php(paid),"paid invoices")}${box("Still owed",php(owing),"open invoices")}</div>
  <div class="card"><h3>Up next</h3>${next.length?`<div class="tbl"><table><tr><th>Time</th><th>Customer</th><th>Services</th><th>Technician</th></tr>${next.map(x=>`<tr><td>${hm(x.start_at)}</td><td>${esc(x.customer_name)}<br><small>${esc(x.code)}</small></td><td>${esc(svcs(x))}</td><td>${esc(who(x.technician_id))}</td></tr>`).join("")}</table></div>`:'<p class="mute">Nothing waiting to arrive.</p>'}</div>`;
}
function acts(a){
  const b=(l,s,c="")=>`<button class="btn w ${c}" onclick="setSt('${a.id}','${s}')">${l}</button>`;
  if(a.status==="confirmed")return b("Check in","waiting")+b("No-show","noshow")+b("Cancel","cancelled");
  if(a.status==="waiting")return b("Start","service")+b("Cancel","cancelled");
  if(a.status==="service")return `<button class="btn" onclick="invoice('${a.id}')">Bill</button>`;
  return "";
}
function appts(){
  const rows=DB.appts.map(a=>`<tr><td>${hm(a.start_at)}</td><td>${esc(a.customer_name)}${a.is_walkin?" <small>(walk-in)</small>":""}<br><small>${esc(a.code)}</small></td><td>${esc(svcs(a))}</td>
  <td>${live(a)?`<select onchange="assign('${a.id}',this.value,'${a.station_id||""}')">${opts(DB.TE,a.technician_id,"Unassigned")}</select>`:esc(who(a.technician_id))}</td>
  <td>${live(a)&&DB.STN.length?`<select onchange="assign('${a.id}','${a.technician_id||""}',this.value)">${opts(DB.STN,a.station_id,"—")}</select>`:"—"}</td><td>${pill(a.status)}</td><td class="row">${acts(a)}</td></tr>`).join("");
  return `<div class="card"><div class="row"><b>Day</b><input type="date" value="${DAY}" onchange="setDay(this.value)"><button class="btn w" onclick="setDay(today())">Today</button></div>
  ${rows?`<div class="tbl"><table><tr><th>Time</th><th>Customer</th><th>Services</th><th>Technician</th><th>Station</th><th>Status</th><th></th></tr>${rows}</table></div>`:'<p class="mute">No appointments on this day.</p>'}</div>
  <div class="card"><h3>Walk-in queue</h3>${DB.walk.length?DB.walk.map(w=>`<div class="row" style="justify-content:space-between;border-top:1px solid var(--line);padding:.5rem 0"><span><b>${esc(w.guest_name)}</b> · ${esc(w.service_name)}<br><small>waiting since ${hm(w.created_at)}</small></span><span class="row"><button class="btn" onclick="act2(()=>FN.checkinWalkin(${w.id}),'Checked in')">Check in</button><button class="btn w" onclick="act2(()=>FN.removeWalkin(${w.id}),'Removed')">Remove</button></span></div>`).join(""):'<p class="mute">Nobody is waiting.</p>'}
  <div class="row" style="margin-top:.8rem"><input id="wn" placeholder="Customer name"><select id="ws">${opts(DB.SV,"","Service…")}</select><button class="btn" onclick="addW()">Add walk-in</button></div></div>`;
}
function cust(){
  return `<div class="card"><div class="row"><input id="cq" placeholder="Search name, email or phone" value="${esc(DB.q)}" onkeydown="if(event.key==='Enter')findC()"><button class="btn" onclick="findC()">Search</button></div>
  ${DB.cust.length?`<div class="tbl"><table><tr><th>Name</th><th>Phone</th><th>Email</th><th></th></tr>${DB.cust.map(c=>`<tr><td>${esc(c.full_name||c.username||"—")}</td><td>${esc(c.phone||"—")}</td><td>${esc(c.email||"—")}</td><td><button class="btn w" onclick="viewC('${c.id}','${esc(c.full_name||c.username||"Customer")}')">History</button></td></tr>`).join("")}</table></div>`:'<p class="mute">Search to find a customer.</p>'}</div>`;
}
function bill(){
  const mine=DB.appts.filter(a=>live(a)||sale(a)),
  row=a=>{const s=sale(a),pays=(a.payments||[]).filter(p=>p.status==="paid"||p.status==="partially_refunded");
    return `<tr><td>${hm(a.start_at)}</td><td>${esc(a.customer_name)}<br><small>${esc(a.code)}</small></td><td>${esc(svcs(a))}</td><td>${s?php(s.total):"—"}</td><td>${s?php(s.balance_due):"—"}</td><td>${s?pill(s.status==="paid"?"completed":s.status==="open"?"waiting":s.status):pill(a.status)}</td>
    <td class="row">${live(a)&&(!s||s.status==="open")?`<button class="btn w" onclick="invoice('${a.id}')">${s?"Edit":"Invoice"}</button>`:""}${s&&s.status==="open"&&+s.balance_due>0?`<button class="btn" onclick="payM('${s.id}',${+s.balance_due})">Take payment</button><button class="btn w" onclick="voidM('${s.id}')">Void</button>`:""}${s&&s.status==="paid"?`<button class="btn w" onclick="rcpt('${s.id}')">Receipt</button>`:""}${pays.length&&s&&s.status!=="voided"?`<button class="btn w" onclick="refM('${a.id}')">Refund</button>`:""}</td></tr>`};
  return `<div class="card"><div class="row" style="justify-content:space-between"><span><b>${DAY===today()?"Today":DAY}</b></span><button class="btn" onclick="invoice(null)">New walk-in sale</button></div>
  ${mine.length?`<div class="tbl"><table><tr><th>Time</th><th>Customer</th><th>Services</th><th>Total</th><th>Balance</th><th>Status</th><th></th></tr>${mine.map(row).join("")}</table></div>`:'<p class="mute">Nothing to bill yet.</p>'}</div>`;
}
const PG={dash,appts,pay:()=>pckHTML(),cust,bill};

/* ---------- handlers ---------- */
const setSt=(id,s)=>act(()=>FN.setStatus(id,s),s==="service"?"Service started":"Updated"),
assign=(id,t,s)=>act(()=>FN.assign(id,t?+t:null,s?+s:null),"Updated"),
act2=(fn,m)=>act(fn,m);
async function setDay(d){if(!d)return;DAY=d;try{await loadDay()}catch(e){fail(e)}render()}
function addW(){const n=$("#wn").value.trim(),s=$("#ws").value;if(n.length<2||!s)return toast("Enter a name and pick a service.");act(()=>FN.addWalkin(n,+s),"Added to the queue")}
async function findC(){DB.q=$("#cq").value.trim();try{DB.cust=await FN.customers(DB.q)}catch(e){return fail(e)}render()}
async function viewC(id,name){
  try{const r=await FN.customerAppointments(id);
    modal(`<h3>${esc(name)}</h3>${r.length?`<div class="tbl"><table><tr><th>When</th><th>Services</th><th>Status</th></tr>${r.map(a=>`<tr><td>${parts(a.start_at).year}-${parts(a.start_at).month}-${parts(a.start_at).day} ${hm(a.start_at)}</td><td>${esc(svcs(a))}</td><td>${pill(a.status)}</td></tr>`).join("")}</table></div>`:'<p class="mute">No appointments yet.</p>'}${MF('<button class="btn w" onclick="modal()">Close</button>')}`)}catch(e){fail(e)}
}
let LN=[];
function lineRow(l,i){
  const sv=DB.SV.find(s=>s.id===+l.service_id),rng=sv&&sv.px>sv.p;
  return `<div class="row" style="margin:.3rem 0"><select onchange="LN[${i}].service_id=this.value;LN[${i}].unit_price='';invDraw()">${opts(DB.SV,l.service_id,"Service…")}</select><select onchange="LN[${i}].technician_id=this.value">${opts(DB.TE,l.technician_id,"Technician…")}</select>${rng?`<input type="number" style="width:7rem" min="${sv.p}" max="${sv.px}" placeholder="${sv.p}–${sv.px}" value="${l.unit_price||""}" onchange="LN[${i}].unit_price=this.value">`:""}<button class="btn w" onclick="LN.splice(${i},1);invDraw()">✕</button></div>`;
}
let INV=null;
function invDraw(){
  $("#invl").innerHTML=LN.map(lineRow).join("")||'<p class="mute">No services yet.</p>';
}
function invoice(id){
  const a=id&&DB.appts.find(x=>x.id===id);INV={id:id||null};
  LN=a?(a.appointment_items||[]).map(i=>({service_id:i.service_id,technician_id:a.technician_id||"",unit_price:""})):[{service_id:"",technician_id:"",unit_price:""}];
  modal(`<h3>${a?"Invoice · "+esc(a.customer_name):"New walk-in sale"}</h3>${a?"":'<label>Customer name</label><input id="iw" placeholder="Customer name">'}<div id="invl"></div><p><button class="btn w" onclick="LN.push({service_id:'',technician_id:'',unit_price:''});invDraw()">+ Add service</button></p>${MF('<button class="btn w" onclick="modal()">Cancel</button><button class="btn" onclick="saveInv()">Save invoice</button>')}`);
  invDraw();
}
async function saveInv(){
  const lines=LN.filter(l=>l.service_id).map(l=>({service_id:+l.service_id,technician_id:l.technician_id?+l.technician_id:null,...(l.unit_price?{unit_price:+l.unit_price}:{})}));
  if(!lines.length)return toast(ERR.NO_LINES);
  if(lines.some(l=>!l.technician_id))return toast(ERR.TECHNICIAN_REQUIRED);
  try{await FN.createInvoice(INV.id,INV.id?null:($("#iw")||{}).value,lines);modal();toast("Invoice saved");await refresh()}catch(e){fail(e)}
}
function payM(sid,bal){
  FN.newPaymentAttempt();
  modal(`<h3>Take payment</h3><label>Amount (balance ${php(bal)})</label><input id="pa" type="number" min="1" step="0.01" value="${bal}"><label>Method</label><select id="pm"><option value="cash">Cash</option><option value="card_terminal">Card terminal</option><option value="gcash_counter">GCash (at counter)</option><option value="maya_counter">Maya (at counter)</option><option value="bank_transfer">Bank transfer</option></select>${MF(`<button class="btn w" onclick="modal()">Cancel</button><button class="btn" onclick="savePay('${sid}')">Record payment</button>`)}`);
}
async function savePay(sid){
  const amt=+$("#pa").value;if(!(amt>0))return toast("Enter an amount.");
  try{await FN.recordCounterPayment(sid,amt,$("#pm").value);FN.newPaymentAttempt();modal();toast("Payment recorded");await refresh()}catch(e){fail(e)}
}
const voidM=sid=>modal(`<h3>Void this invoice?</h3><p class="mute">Only unpaid invoices can be voided.</p><label>Reason</label><input id="vr" placeholder="Reason">${MF(`<button class="btn w" onclick="modal()">Keep</button><button class="btn" onclick="doVoid('${sid}')">Void invoice</button>`)}`);
async function doVoid(sid){const r=$("#vr").value.trim();if(r.length<3)return toast("Please give a reason.");try{await FN.voidOpenSale(sid,r);modal();toast("Invoice voided");await refresh()}catch(e){fail(e)}}
function refM(aid){
  const a=DB.appts.find(x=>x.id===aid),ps=(a.payments||[]).filter(p=>p.status==="paid"||p.status==="partially_refunded");
  modal(`<h3>Request a refund</h3><p class="mute">The owner approves refunds before money moves.</p><label>Payment</label><select id="rp">${ps.map(p=>`<option value="${p.id}" data-a="${p.amount}">${esc(p.kind)} · ${php(p.amount)} · ${esc(p.method||"")}</option>`).join("")}</select><label>Amount</label><input id="ra" type="number" min="1" step="0.01" value="${ps[0]?ps[0].amount:""}"><label>Reason</label><input id="rr" placeholder="Reason">${MF('<button class="btn w" onclick="modal()">Cancel</button><button class="btn" onclick="saveRef()">Send to owner</button>')}`);
}
async function saveRef(){
  const amt=+$("#ra").value,r=$("#rr").value.trim();if(!(amt>0)||r.length<3)return toast("Enter an amount and a reason.");
  try{await FN.requestRefund($("#rp").value,amt,r);modal();toast("Refund request sent to the owner");await refresh()}catch(e){fail(e)}
}
async function rcpt(sid){
  try{const s=await FN.receipt(sid);
    modal(`<h3>Receipt ${esc(s.receipt_no||"")}</h3><p class="mute">${esc((s.appointments||{}).code||"Walk-in")}</p><div class="tbl"><table>${(s.sale_items||[]).map(l=>`<tr><td>${esc(l.name)}</td><td style="text-align:right">${php(l.unit_price*l.quantity)}</td></tr>`).join("")}<tr><td>Subtotal</td><td style="text-align:right">${php(s.subtotal)}</td></tr><tr><td><b>Total</b></td><td style="text-align:right"><b>${php(s.total)}</b></td></tr></table></div>${MF('<button class="btn w" onclick="modal()">Close</button><button class="btn" onclick="document.body.classList.add(\'rcp\');print()">Print</button>')}`);
  }catch(e){fail(e)}
}

/* ---------- shell ---------- */
const go=p=>{P=p;render();scrollTo(0,0)};
function render(){
  if(!ST){$("#app").innerHTML=plHTML();return}
  const logo='<span class="logo" onclick="go(\'dash\')"><span class="lg">f</span><span><i>fairytale</i><small>NAILS SALON</small></span></span>',
  nm=esc(ST.name),pg=(PG[P]||dash)();
  $("#app").innerHTML=`<div class="shell"><aside class="noprint">${logo}<small style="margin:1rem 0 .4rem;letter-spacing:.12em">STAFF PORTAL</small>${NAV.map(([k,l])=>`<div class="nv ${P===k?"on":""}" onclick="go('${k}')">${l}</div>`).join("")}<div class="me"><span class="av">${nm.split(" ").map(x=>x[0]).join("").slice(0,2)}</span><span><b>${nm}</b><br><small>Staff</small><br><a class="pr" style="cursor:pointer;font-size:.75rem" onclick="doSignOut()">Sign out</a></span></div></aside><section><div class="bar noprint"><div><span class="ttl" style="font-size:1.4rem">${NAV.find(x=>x[0]===P)[1]}</span><br><small>${new Date().toLocaleDateString("en",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</small></div><span><small>Signed in as</small> <b>${nm}</b></span></div><div class="pad">${pg}</div></section></div>`;
}
async function boot(){
  $("#app").innerHTML="";
  const rec=await (FN.raw||FN).recoveryFromUrl().catch(()=>"expired");
  if(rec){render();window.Loader&&Loader.endInitial();return pwrStart(rec,boot)}
  try{if((await FN.currentUser())&&(await FN.requirePortalRole("staff")))await afterLogin()}
  catch(e){console.error(e);$("#app").innerHTML='<p style="text-align:center;padding:5rem 1rem">Could not reach the salon system. <a class="pr" style="cursor:pointer" onclick="boot()">Try again</a></p>';window.Loader&&Loader.endInitial();return}
  render();window.Loader&&Loader.endInitial();
}
FNready.then(boot);

    
