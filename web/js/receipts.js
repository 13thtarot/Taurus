// Receipt-upload payments: the customer pays by GCash / Maya and uploads a screenshot; staff verify it.
import { sb, must } from "./client.js";
import { currentUser } from "./auth.js";

const BUCKET = "payment-receipts";
const OK_TYPES = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
export const RECEIPT_MAX_MB = 10;

/** Customer: upload the receipt image, then attach it to the held appointment (stops the 5-minute clock). */
export async function submitReceipt(appointmentId, file, option, method) {
  if (!file) throw new Error("Choose a photo or screenshot of your receipt.");
  if (!OK_TYPES.test(file.type)) throw new Error("The receipt must be a JPG, PNG or WEBP image, or a PDF.");
  if (file.size > RECEIPT_MAX_MB * 1024 * 1024) throw new Error(`The receipt must be ${RECEIPT_MAX_MB} MB or smaller.`);
  const u = await currentUser();
  if (!u) throw new Error("Please log in again.");
  const ext = file.type === "application/pdf" ? "pdf" : (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${u.id}/${appointmentId}/${crypto.randomUUID()}.${ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) {
    const m = up.error.message || "";
    throw new Error(/mime|type/i.test(m) ? "The receipt must be a JPG, PNG or WEBP image, or a PDF."
      : /size|large/i.test(m) ? `The receipt must be ${RECEIPT_MAX_MB} MB or smaller.` : "The receipt could not be uploaded. Please try again.");
  }
  return must(await sb.rpc("submit_payment_receipt", { p_appt: appointmentId, p_option: option, p_method: method, p_path: path }));
}

/** Short-lived link to view a receipt (customer: own receipts; staff: all). */
export async function receiptUrl(path, seconds = 600) {
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}

/** Staff: receipts waiting to be checked, oldest first. */
export async function pendingReceipts() {
  const rows = must(await sb.from("payments")
    .select("id, amount, method, pay_option, receipt_path, created_at, appointments(id, code, customer_name, customer_phone, customer_email, start_at, status, est_subtotal, appointment_items(name))")
    .eq("provider", "manual").eq("status", "pending").not("receipt_path", "is", null)
    .order("created_at"));
  return rows.filter((r) => r.appointments && r.appointments.status === "held");
}

/** Staff: approve (confirms the booking) or reject with a reason (cancels it and tells the customer). */
export const reviewPayment = (paymentId, approve, reason = "") =>
  sb.rpc("staff_review_payment", { p_payment: paymentId, p_approve: approve, p_reason: reason }).then(must);

/** Owner: upload the payment QR code (public, shown on the booking page) and save it in the settings. */
export async function savePaymentQr(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error("Choose an image of your QR code.");
  if (file.size > 5 * 1024 * 1024) throw new Error("The QR image must be under 5 MB.");
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `payment/qr-${crypto.randomUUID()}.${ext}`;
  const up = await sb.storage.from("salon-gallery").upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) throw up.error;
  return must(await sb.from("business_settings").update({ pay_qr_path: path }).eq("id", true).select().single());
}
export const qrUrl = (path) => (path ? sb.storage.from("salon-gallery").getPublicUrl(path).data.publicUrl : "");

/* ---------- reschedule requests (customers ask, staff / owner decide) ---------- */

/** Staff: pending reschedule requests for bookings that are still active, oldest first. */
export async function pendingReschedules() {
  const rows = must(await sb.from("reschedule_requests")
    .select("id, created_at, old_start, old_end, old_tech, new_start, new_end, new_tech, appointments(id, code, customer_name, customer_phone, status, appointment_items(name))")
    .eq("status", "pending").order("created_at"));
  return rows.filter((r) => r.appointments && ["confirmed", "held"].includes(r.appointments.status));
}

/** Staff: approve (moves the booking after re-checking the slot) or decline with a reason the customer sees. */
export const reviewReschedule = (requestId, approve, reason = "") =>
  sb.rpc("staff_review_reschedule", { p_req: requestId, p_approve: approve, p_reason: reason }).then(must);
