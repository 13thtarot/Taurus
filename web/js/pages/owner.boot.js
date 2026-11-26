import * as auth from "../auth.js";
import { loadCatalog, loadGallery } from "../catalog.js";
import * as owner from "../owner.js";
import { pendingReceipts, reviewPayment, receiptUrl, savePaymentQr, pendingReschedules, reviewReschedule } from "../receipts.js";
import { watchOwnerBoard } from "../realtime.js";
// Loader.wrap() puts the loading screen in front of EVERY async call (FN.raw = same calls, silent).
window.FN = (window.Loader ? Loader.wrap : (x) => x)({ ...auth, ...owner, pendingReceipts, reviewPayment, receiptUrl, savePaymentQr, pendingReschedules, reviewReschedule, loadCatalog, loadGallery, watchOwnerBoard });
window.__fnReady();

