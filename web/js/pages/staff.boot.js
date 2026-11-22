import * as auth from "../auth.js";
import { loadCatalog } from "../catalog.js";
import * as staff from "../staff.js";
import { watchStaffBoard } from "../realtime.js";
// Loader.wrap() puts the loading screen in front of EVERY async call (FN.raw = same calls, silent).
window.FN = (window.Loader ? Loader.wrap : (x) => x)({ ...auth, ...staff, loadCatalog, watchStaffBoard });
window.__fnReady();

