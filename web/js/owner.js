import { sb, must, newKey } from "./client.js";
import { FUNCTIONS_URL, SUPABASE_ANON_KEY } from "./config.js";

/** PostgREST caps a response at 1000 rows, so page through bigger result sets. */
async function pageAll(build, pageSize = 1000, maxPages = 10) {
  const out = [];
  for (let i = 0; i < maxPages; i++) {
    const rows = must(await build().range(i * pageSize, (i + 1) * pageSize - 1));
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

// ---- business settings / calendar
export const saveSettings = (patch) => sb.from("business_settings").update(patch).eq("id", true).select().single().then(must);
export const addDayOff = (day, reason = "") => sb.from("days_off").upsert({ day, reason }).then(must);
export const removeDayOff = (day) => sb.from("days_off").delete().eq("day", day).then(must);

// ---- services & categories (past appointments/sales keep their own snapshots, so edits and deletes are safe)
export const updateService = (id, patch) => sb.from("services").update(patch).eq("id", id).then(must);
export const insertService = (svc) => sb.from("services").insert(svc).select().single().then(must);
export async function deleteService(id) {
  let old = null;
  try { old = must(await sb.from("services").select("image_path").eq("id", id).single()).image_path; } catch (e) { /* column not added yet */ }
  must(await sb.from("services").delete().eq("id", id));
  await dropPhoto(old);
}
export const upsertCategory = (c) => sb.from("service_categories").upsert(c).select().single().then(must);

// ---- technicians & stations
export const updateTechnician = (id, patch) => sb.from("technicians").update(patch).eq("id", id).then(must);
export const insertTechnician = (t) => sb.from("technicians").insert(t).select().single().then(must);
export const upsertStation = (s) => sb.from("stations").upsert(s).select().single().then(must);

// ---- staff accounts (database functions, owner-only; no service-role key involved)
export const listStaff = () => sb.rpc("owner_list_staff").then(must);
export const addStaffByEmail = (email) => sb.rpc("owner_add_staff", { p_email: email }).then(must);
export const setStaffActive = (userId, active) => sb.rpc("owner_set_staff_active", { p_user: userId, p_active: active }).then(must);
export const renameProfile = (id, fullName) => sb.from("profiles").update({ full_name: fullName }).eq("id", id).then(must);

// ---- data for the owner views
export async function ownerAppointments(fromISO, toISO) {
  const a = new Date(fromISO + "T00:00:00+08:00").toISOString();
  const b = new Date(toISO + "T23:59:59+08:00").toISOString();
  return pageAll(() => sb.from("appointments")
    .select("*, appointment_items(service_id,name,unit_price,price_max), payments(id,kind,status,amount,method,provider,paid_at), sales(*, sale_items(*))")
    .gte("start_at", a).lte("start_at", b).order("start_at", { ascending: false }));
}
export async function profileNames(ids) {
  if (!ids.length) return {};
  const rows = must(await sb.from("profiles").select("id, full_name").in("id", ids));
  return Object.fromEntries(rows.map((r) => [r.id, r.full_name]));
}
export const appointmentHistory = async (id) =>
  must(await sb.from("appointment_history").select("*").eq("appointment_id", id).order("created_at"));

// ---- reporting (numbers computed by PostgreSQL)
export const dashboard = (fromISO, toISO) => sb.rpc("owner_dashboard", { p_from: fromISO, p_to: toISO }).then(must);
export const allPayments = (limit = 200) => sb.from("payments").select("*").order("created_at", { ascending: false }).limit(limit).then(must);
export const auditLog = (limit = 200) => sb.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit).then(must);

// ---- refunds
export const pendingRefunds = async () =>
  must(await sb.from("refunds").select("*, payments(method, provider, amount)").in("status", ["requested", "processing", "failed"]).order("created_at"));
export const requestRefund = (paymentId, amount, reason) =>
  sb.rpc("request_refund", { p_payment: paymentId, p_amount: amount, p_reason: reason, p_idem: newKey() }).then(must);
/** Cash / manual / test payments are refunded instantly. Online (PayMongo) refunds need the process-refund Edge Function. */
export async function approveRefund(refundId) {
  const r = must(await sb.rpc("approve_refund", { p_refund: refundId }));
  if (r.status !== "processing") return r;
  const { data: { session } } = await sb.auth.getSession();
  const res = await fetch(FUNCTIONS_URL + "/process-refund", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token, apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ refund_id: refundId }),
  });
  if (!res.ok) throw new Error("The online refund could not be completed. It stays flagged for review.");
  return res.json();
}

// ---- backup: export business data as one JSON object
export async function exportAll() {
  const tables = ["business_settings", "days_off", "service_categories", "services", "technicians", "stations",
    "appointments", "appointment_items", "appointment_history", "sales", "sale_items", "payments", "refunds"];
  const out = { exported_at: new Date().toISOString() };
  for (const t of tables) out[t] = await pageAll(() => sb.from(t).select("*"));
  return out;
}

/* ---------------------------------------------------------------- gallery photos (owner only) */
const GBUCKET = "salon-gallery";
/** Shrinks any photo to at most 1600px (JPEG) so uploads stay small and always fit the customer layout. */
async function fitImage(file, max = 1600) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Please choose a JPG, PNG or WebP photo.");
  const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not process that photo."))), "image/jpeg", 0.86));
}
async function putPhoto(file, prefix = "", max = 1600) {
  const blob = await fitImage(file, max), path = `${prefix}${newKey()}.jpg`;
  const { error } = await sb.storage.from(GBUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return path;
}
const dropPhoto = (path) => (path ? sb.storage.from(GBUCKET).remove([path]).catch(() => {}) : null);

export async function addGalleryPhoto(file, title, focus = "center") {
  const path = await putPhoto(file);
  try {
    const last = must(await sb.from("gallery_images").select("sort_order").order("sort_order", { ascending: false }).limit(1));
    return must(await sb.from("gallery_images").insert({ title: title.trim(), storage_path: path, focus, sort_order: (last[0]?.sort_order ?? 0) + 1 }).select().single());
  } catch (e) { await dropPhoto(path); throw e; }
}
export async function replaceGalleryPhoto(id, file) {
  const old = must(await sb.from("gallery_images").select("storage_path").eq("id", id).single()).storage_path, path = await putPhoto(file);
  try { must(await sb.from("gallery_images").update({ storage_path: path }).eq("id", id)); } catch (e) { await dropPhoto(path); throw e; }
  await dropPhoto(old);
}
export const updateGalleryItem = (id, patch) => sb.from("gallery_images").update(patch).eq("id", id).then(must);
export async function moveGalleryItem(id, dir) {
  const rows = must(await sb.from("gallery_images").select("id,sort_order").order("sort_order").order("id")),
    i = rows.findIndex((r) => r.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  await Promise.all(rows.map((r, n) => (r.sort_order !== n + 1 ? sb.from("gallery_images").update({ sort_order: n + 1 }).eq("id", r.id).then(must) : null)));
}
export async function deleteGalleryItem(id) {
  const row = must(await sb.from("gallery_images").select("storage_path").eq("id", id).single());
  must(await sb.from("gallery_images").delete().eq("id", id));
  await dropPhoto(row.storage_path);
}

/* ---------------------------------------------------------------- service pictures (owner only) */
export async function saveServiceImage(id, file) {
  const old = must(await sb.from("services").select("image_path").eq("id", id).single()).image_path;
  const path = await putPhoto(file, "services/", 900);
  try { must(await sb.from("services").update({ image_path: path }).eq("id", id)); } catch (e) { await dropPhoto(path); throw e; }
  await dropPhoto(old);
  return path;
}
export async function clearServiceImage(id) {
  const old = must(await sb.from("services").select("image_path").eq("id", id).single()).image_path;
  must(await sb.from("services").update({ image_path: null }).eq("id", id));
  await dropPhoto(old);
}
