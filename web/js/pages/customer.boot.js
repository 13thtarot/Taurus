import { sb } from "../client.js";
import * as auth from "../auth.js";
import { loadCatalog, loadGallery } from "../catalog.js";
import * as booking from "../booking.js";
import { watchMyBookings } from "../realtime.js";
// Loader.wrap() puts the loading screen in front of EVERY async call below (FN.raw = same calls, silent).
window.FN = (window.Loader ? Loader.wrap : (x) => x)({
  ...auth, ...booking, loadCatalog, loadGallery, watchMyBookings,
  usernameTaken: async (u) => !!(await sb.rpc("email_for_username", { p_username: u })).data,
});window.__fnReady();

