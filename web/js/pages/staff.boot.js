import * as auth from "../auth.js";
import { loadCatalog } from "../catalog.js";
import * as staff from "../staff.js";
import { pendingReceipts, reviewPayment, receiptUrl, pendingReschedules, reviewReschedule } from "../receipts.js";
import { watchStaffBoard } from "../realtime.js";
import * as phone from "../phonebook.js";
// Loader.wrap() puts the loading screen in front of EVERY async call (FN.raw = same calls, silent).
window.FN = (window.Loader ? Loader.wrap : (x) => x)({ ...auth, ...staff, pendingReceipts, reviewPayment, receiptUrl, pendingReschedules, reviewReschedule, loadCatalog, watchStaffBoard, ...phone });
window.__fnReady();

