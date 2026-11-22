/*
 * Customer motion (decoration only): page fade (always), scroll-reveal with stagger, header shadow, scroll progress bar and a sparkle burst
 * when a booking is confirmed. Pairs with css/customer.motion.css. Does nothing for visitors who prefer reduced motion,
 * and never touches data: it only adds/removes CSS classes after the page has rendered.
 */
(() => {
  if (typeof window.render !== "function") return;
  const mq = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: true },
    SEL = [".hero .wrap > div:first-child > *", ".hp .ph"].join(","),
    still = () => mq.matches || !("IntersectionObserver" in window);
  let lastKey = "", io = null, bar = null;

  const key = () => { try { return P + (P === "book" && B ? ":" + B.step + (B.done ? "d" : "") : ""); } catch (e) { return ""; } };

  let scrolled = false; // true once the visitor has scrolled; until then there is nothing to measure
  function onScroll() {
    // Read every layout value first, then write, so the browser lays the page out only once.
    const y = window.scrollY || 0, max = bar ? document.documentElement.scrollHeight - innerHeight : 0, top = document.querySelector(".top");
    scrolled = y > 0;
    if (top) top.classList.toggle("scrolled", y > 8);
    if (bar) bar.style.setProperty("--p", Math.min(1, y / Math.max(1, max)).toFixed(3));
  }
  function celebrate() {
    try { if (!(B && B.done)) return; } catch (e) { return; }
    const box = document.createElement("div"), cols = ["var(--red)", "var(--deep)", "var(--head)"];
    box.className = "confetti"; box.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 26; i++) {
      const s = document.createElement("span");
      s.textContent = i % 3 ? "✦" : "♡";
      s.style.cssText = `left:${(5 + Math.random() * 90).toFixed(1)}%;--x:${(Math.random() * 160 - 80).toFixed(0)}px;--r:${(Math.random() * 360).toFixed(0)}deg;color:${cols[i % 3]};animation-delay:${(Math.random() * 0.4).toFixed(2)}s;font-size:${(0.8 + Math.random() * 1.1).toFixed(2)}rem`;
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 2800);
  }
  function motion() {
    if (scrolled) requestAnimationFrame(onScroll); // at the top of the page there is nothing to update, so skip the layout read
    const nav = key() !== lastKey; lastKey = key();
    if (!nav) return; // background refreshes: leave everything as it is
    // Page change: a soft fade for EVERY visitor (opacity only, so it is fine with reduced motion too).
    const app = document.getElementById("app");
    if (app) { app.classList.remove("pg-in"); requestAnimationFrame(() => requestAnimationFrame(() => app.classList.add("pg-in"))); }
    if (still() || P !== "home") { if (!still()) celebrate(); return; } // scroll reveal only on the home page
    if (io) io.disconnect();
    io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); setTimeout(() => e.target.classList.add("done"), 1100); } }), { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    document.querySelectorAll("#app " + SEL.split(",").join(",#app ")).forEach((el, i) => {
      el.classList.add("rv"); el.style.setProperty("--d", (i % 6) * 70 + "ms"); io.observe(el);
    });
    celebrate();
  }

  if (!mq.matches) { bar = document.createElement("div"); bar.id = "scrollbar"; bar.setAttribute("aria-hidden", "true"); document.body.appendChild(bar); }
  addEventListener("scroll", () => requestAnimationFrame(onScroll), { passive: true });
  const original = window.render;
  window.render = function () { const r = original.apply(this, arguments); try { motion(); } catch (e) { console.warn("motion", e); } return r; };
})();
