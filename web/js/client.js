import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

// Sessions live in Supabase's own storage; app DATA is never kept in localStorage.
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

/** Throw a readable error from a Supabase result. */
export function must({ data, error }) {
  if (error) {
    const e = new Error(friendly(error.message));
    e.code = error.message;
    throw e;
  }
  return data;
}

const MSG = {
  SLOT_UNAVAILABLE: "That time was just taken. Please pick another time.",
  HOLD_EXPIRED: "Your reserved slot expired. Please book again.",
  TOO_MANY_HOLDS: "You already have several unpaid bookings. Please finish or cancel them first.",
  INVALID_CONTACT: "Please enter your name, a valid phone number and a valid email.",
  TECH_OR_STATION_BUSY: "That technician or station is busy at this time.",
  TECH_DAY_OFF: "That technician is off on this day.",
  ASSIGN_TECHNICIAN_FIRST: "Assign a technician before starting the service.",
  FORBIDDEN: "You do not have permission to do that.",
  STATUS_LOCKED: "This appointment can no longer change status.",
  INVOICE_LOCKED: "This invoice already has a payment and can no longer be edited.",
  INVALID_AMOUNT: "That amount is not valid for this balance.",
  PRICE_OUT_OF_RANGE: "That price is outside the allowed range for this service.",
  INVALID_PHONE: "Enter an 11-digit mobile number that starts with 09 (numbers only).",
  INVALID_USERNAME: "Usernames are 3-20 letters, numbers, dots or underscores.",
  USERNAME_TAKEN: "That username is already taken. Try another one.",
  INVALID_NAME: "Names can only use letters, spaces, dots, apostrophes and hyphens.",
  INVALID_ADDRESS: "Please enter a complete address.",
  NOT_IN_SERVICE: "Only appointments that are in service can be marked as completed.",
  BILL_FIRST: "Create the bill and collect payment before marking this as completed.",
  BALANCE_DUE: "Collect the remaining balance before marking this as completed.",
  ALREADY_REVIEWED: "This request was already handled.",
  REASON_REQUIRED: "Please give a reason.",
  NOT_RESCHEDULABLE: "This appointment can no longer be rescheduled.",
  TOO_LATE_TO_CANCEL: "This appointment has already started or passed, so it can't be cancelled online. Please contact the salon.",
  TOO_LATE_TO_RESCHEDULE: "Appointments can't be moved within 2 hours of the start time. Please call the salon.",
  EMAIL_CHANGE_VIA_AUTH: "Your email can only be changed from the Email field (we send a confirmation link).",
};
export const friendly = (m = "") => MSG[(m.match(/[A-Z_]{6,}/) || [""])[0]] || m;

export const newKey = () => crypto.randomUUID();
export const php = (n) => "₱" + Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 });
