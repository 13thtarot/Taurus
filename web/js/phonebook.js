// Staff / owner bookings for customers who call or message the salon.
import { sb, must } from "./client.js";

/** Customer accounts matching a name, email, mobile number or username (for linking the booking). */
export async function findCustomers(q) {
  const t = String(q || "").replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim();
  if (t.length < 2) return [];
  return must(await sb.from("profiles").select("id, full_name, username, phone, email")
    .or(`full_name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%,username.ilike.%${t}%`).limit(8));
}

/** Free start times (minutes after midnight) for a date, duration and technician (0 = any). */
export async function slotsFor(date, durationMin, techId = 0) {
  const { data, error } = await sb.rpc("get_available_slots", { p_date: date, p_duration: durationMin, p_tech: techId || null });
  if (error) throw error;
  return data || [];
}

/** Books a confirmed, pay-at-the-salon appointment. */
export const staffCreateBooking = (b) =>
  sb.rpc("staff_create_booking", {
    p_service_ids: b.serviceIds, p_date: b.date, p_start_min: b.startMin, p_tech: b.techId || 0,
    p_name: b.name, p_phone: b.phone, p_email: b.email || "", p_notes: b.notes || "",
    p_customer: b.customerId || null, p_idem: b.idem,
  }).then(must);
