import { sb, must } from "./client.js";

export async function signUp({ email, password, username, phone, fullName = "" }) {
  const { data, error } = await sb.auth.signUp({
    email, password,
    options: { data: { username, phone, full_name: fullName } },
  });
  if (error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("already registered") || m.includes("already exists")) throw new Error("An account with this email already exists. Log in instead.");
    if (m.includes("rate limit") || m.includes("too many")) throw new Error("Too many attempts. Please wait a few minutes and try again.");
    if (m.includes("password")) throw new Error("Please choose a stronger password.");
    if (m.includes("email")) throw new Error("Please enter a valid email address.");
    throw new Error("We couldn't create your account right now. Please try again.");
  }
  return data;            // { user, session } (session is null when email confirmation is required)
}

/** Accepts email OR username, like the existing portals. */
export async function signIn(identifier, password) {
  let email = identifier.trim();
  if (!email.includes("@")) {
    const { data } = await sb.rpc("email_for_username", { p_username: email });
    email = data || "";
  }
  if (!email) throw new Error("No account uses that username. Try your email address instead.");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("not confirmed")) throw new Error("Please confirm your email first. Check your inbox for the confirmation link, then log in.");
    if (m.includes("invalid login")) throw new Error("Incorrect email, username or password. Please try again.");
    if (m.includes("rate limit") || m.includes("too many")) throw new Error("Too many attempts. Please wait a few minutes and try again.");
    throw new Error("We couldn't log you in right now. Please try again.");
  }
  return data.user;
}

export const signOut = () => sb.auth.signOut();
export const currentUser = async () => (await sb.auth.getSession()).data.session?.user ?? null;

export async function myRoles() {
  const u = await currentUser();
  if (!u) return [];
  return must(await sb.from("user_roles").select("role").eq("user_id", u.id)).map((r) => r.role);
}

/**
 * Portal gate. customer.html -> 'customer', staff.html -> 'staff' (owners may also enter), owner.html -> 'owner'.
 * Roles are enforced again by RLS and by every RPC; this only decides which screen to show.
 */
export async function requirePortalRole(portal) {
  const roles = await myRoles();
  const ok = portal === "customer" ? roles.includes("customer")
           : portal === "staff"    ? roles.includes("staff") || roles.includes("owner")
           : roles.includes("owner");
  if (!ok) { await signOut(); return null; }
  return currentUser();
}

export async function myProfile() {
  const u = await currentUser();
  return u ? must(await sb.from("profiles").select("*").eq("id", u.id).single()) : null;
}
/** Saves ONLY the columns passed in (so one field the database rejects can never block the others). */
export async function saveProfile(patch) {
  const u = await currentUser();
  if (!u) throw new Error("Please log in again.");
  const r = await sb.from("profiles").update(patch).eq("id", u.id).select().single();
  if (r.error && (r.error.code === "23505" || /duplicate key/i.test(r.error.message))) throw new Error("That username is already taken. Try another one.");
  return must(r);
}

const missingFn = (e) => e && (e.code === "PGRST202" || /could not find the function|does not exist/i.test(e.message || ""));

/** true when ANOTHER account already uses this email. null = could not check (database add-on not installed). */
export async function emailInUse(email) {
  const { data, error } = await sb.rpc("email_in_use", { p_email: email });
  if (error) { if (missingFn(error)) return null; throw new Error(error.message); }
  return !!data;
}

/** true when no OTHER account uses this username. */
export async function usernameAvailable(username) {
  const { data, error } = await sb.rpc("username_available", { p_username: username });
  if (!error) return !!data;
  if (!missingFn(error)) throw new Error(error.message);
  // Fallback for projects without database_customer_updates.sql: the login lookup tells us who owns a username.
  const owner = (await sb.rpc("email_for_username", { p_username: username })).data;
  const me = (await currentUser())?.email || "";
  return !owner || owner.toLowerCase() === me.toLowerCase();
}

/**
 * Changes the login email through Supabase Auth (the only safe place to change it).
 * Returns { pending: true } when Supabase sent a confirmation link first ("Secure email change" / "Confirm email" on).
 */
export async function changeEmail(email) {
  const { data, error } = await sb.auth.updateUser({ email }, { emailRedirectTo: location.origin + location.pathname });
  if (error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("already") && (m.includes("registered") || m.includes("exists") || m.includes("use"))) throw new Error("That email is already used by another account.");
    if (m.includes("rate") || m.includes("security purposes")) throw new Error("Too many email changes in a short time. Please wait a minute and try again.");
    throw new Error(error.message);
  }
  const user = data.user || {};
  const done = (user.email || "").toLowerCase() === email.toLowerCase();
  if (done) { try { await sb.from("profiles").update({ email }).eq("id", user.id); } catch (e) { /* the sync trigger handles it */ } }
  return { pending: !done };
}
