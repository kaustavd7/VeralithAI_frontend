/* Veralith — FlowingMenu (React Bits port to vanilla + gsap global).
   Edge-detection slide + infinite marquee copied from reactbits.dev /r/FlowingMenu-JS-CSS.
   Operates on .fmenu .menu__item rows; reduced-motion leaves them as plain links. */
(function () {
  "use strict";
  function init() {
    if (typeof gsap === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var items = [].slice.call(document.querySelectorAll(".fmenu .menu__item"));
    var defaults = { duration: 0.6, ease: "expo" };

    items.forEach(function (item) {
      var link = item.querySelector(".menu__item-link");
      var marquee = item.querySelector(".marquee");
      var inner = item.querySelector(".marquee__inner");
      var part = inner.querySelector(".marquee__part");
      if (!link || !marquee || !inner || !part) return;
      var anim = null;

      function build() {
        // reset to a single part, then clone to fill the row width + spare for a seamless loop
        [].slice.call(inner.querySelectorAll(".marquee__part")).forEach(function (p, i) { if (i > 0) p.remove(); });
        var w = part.offsetWidth;
        if (!w) return;
        var needed = Math.max(4, Math.ceil(window.innerWidth / w) + 2);
        for (var i = 1; i < needed; i++) inner.appendChild(part.cloneNode(true));
        if (anim) anim.kill();
        gsap.set(inner, { x: 0 });
        anim = gsap.to(inner, { x: -w, duration: parseFloat(item.getAttribute("data-speed") || "16"), ease: "none", repeat: -1 });
      }
      setTimeout(build, 60);
      var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(build, 150); });

      function closestEdge(ev) {
        var r = item.getBoundingClientRect();
        var x = ev.clientX - r.left, y = ev.clientY - r.top;
        var dTop = (x - r.width / 2) * (x - r.width / 2) + y * y;
        var dBot = (x - r.width / 2) * (x - r.width / 2) + (y - r.height) * (y - r.height);
        return dTop < dBot ? "top" : "bottom";
      }
      link.addEventListener("mouseenter", function (ev) {
        var e = closestEdge(ev);
        gsap.timeline({ defaults: defaults })
          .set(marquee, { y: e === "top" ? "-101%" : "101%" }, 0)
          .set(inner, { y: e === "top" ? "101%" : "-101%" }, 0)
          .to([marquee, inner], { y: "0%" }, 0);
      });
      link.addEventListener("mouseleave", function (ev) {
        var e = closestEdge(ev);
        gsap.timeline({ defaults: defaults })
          .to(marquee, { y: e === "top" ? "-101%" : "101%" }, 0)
          .to(inner, { y: e === "top" ? "101%" : "-101%" }, 0);
      });
    });
  }
  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
})();
