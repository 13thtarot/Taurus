window.FNready = new Promise((r) => (window.__fnReady = r));
      // If the modules never load (page opened as file://, js folder missing, or no internet), say so instead of staying blank.
      setTimeout(() => {
        if (window.FN) return;
        window.Loader && Loader.endInitial();
        const a = document.getElementById("app");
        if (a && !a.innerHTML.trim())
          a.innerHTML = '<div style="max-width:560px;margin:4rem auto;padding:1.2rem;font-family:sans-serif"><h3>The page could not start</h3><p>Open it through a local web server instead of double-clicking the file, for example run <code>python3 -m http.server 8000</code> in this folder and visit <code>http://localhost:8000/' + location.pathname.split("/").pop() + '</code>.</p><p>Also check that the <code>js</code> folder sits next to this file and that you are online.</p><p>Technical details are in the browser console (F12).</p></div>';
      }, 3000);
