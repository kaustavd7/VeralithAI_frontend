/* Veralith - GridDistortion (React Bits port to vanilla + three.js global).
   Shaders + displacement logic copied from reactbits.dev /r/GridDistortion-JS-CSS.
   Mount: <div id="ctaDistort" data-src="..."> ; pauses off-screen / hidden / reduced-motion. */
(function () {
  "use strict";
  function init() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof THREE === "undefined") return;
    var container = document.getElementById("ctaDistort");
    if (!container) return;
    var imageSrc = container.getAttribute("data-src");
    var grid = 10, mouse = 0.25, strength = 0.15, relaxation = 0.9;

    var vertexShader =
      "uniform float time; varying vec2 vUv; varying vec3 vPosition;\n" +
      "void main(){ vUv = uv; vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }";
    var fragmentShader =
      "uniform sampler2D uDataTexture; uniform sampler2D uTexture; uniform vec4 resolution; varying vec2 vUv;\n" +
      "void main(){ vec2 uv = vUv; vec4 offset = texture2D(uDataTexture, vUv); gl_FragColor = texture2D(uTexture, uv - 0.02 * offset.rg); }";

    var scene = new THREE.Scene();
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    var camera = new THREE.OrthographicCamera(0, 0, 0, 0, -1000, 1000);
    camera.position.z = 2;

    var uniforms = {
      time: { value: 0 }, resolution: { value: new THREE.Vector4() },
      uTexture: { value: null }, uDataTexture: { value: null }
    };

    new THREE.TextureLoader().load(imageSrc, function (texture) {
      texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping; texture.wrapT = THREE.ClampToEdgeWrapping;
      uniforms.uTexture.value = texture;
      handleResize();
    });

    var size = grid;
    var data = new Float32Array(4 * size * size);
    for (var d0 = 0; d0 < size * size; d0++) { data[d0 * 4] = Math.random() * 255 - 125; data[d0 * 4 + 1] = Math.random() * 255 - 125; }
    var dataTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
    dataTexture.needsUpdate = true;
    uniforms.uDataTexture.value = dataTexture;

    var material = new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: uniforms, vertexShader: vertexShader, fragmentShader: fragmentShader, transparent: true });
    var geometry = new THREE.PlaneGeometry(1, 1, size - 1, size - 1);
    var plane = new THREE.Mesh(geometry, material);
    scene.add(plane);

    function handleResize() {
      var rect = container.getBoundingClientRect();
      var w = rect.width, h = rect.height;
      if (w === 0 || h === 0) return;
      var aspect = w / h;
      renderer.setSize(w, h);
      plane.scale.set(aspect, 1, 1);
      var fw = 1 * aspect;
      camera.left = -fw / 2; camera.right = fw / 2; camera.top = 0.5; camera.bottom = -0.5;
      camera.updateProjectionMatrix();
      uniforms.resolution.value.set(w, h, 1, 1);
    }
    new ResizeObserver(handleResize).observe(container);
    handleResize();

    var ms = { x: 0, y: 0, prevX: 0, prevY: 0, vX: 0, vY: 0 };
    function onMove(e) {
      var rect = container.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      var x = (e.clientX - rect.left) / rect.width, y = 1 - (e.clientY - rect.top) / rect.height;
      ms.vX = x - ms.prevX; ms.vY = y - ms.prevY;
      ms.x = x; ms.y = y; ms.prevX = x; ms.prevY = y;
    }
    window.addEventListener("mousemove", onMove, { passive: true });

    var raf = 0, running = false, visible = false;
    function animate() {
      if (!running) return;
      raf = requestAnimationFrame(animate);
      uniforms.time.value += 0.05;
      var dd = dataTexture.image.data;
      for (var i0 = 0; i0 < size * size; i0++) { dd[i0 * 4] *= relaxation; dd[i0 * 4 + 1] *= relaxation; }
      var gmx = size * ms.x, gmy = size * ms.y, maxDist = size * mouse;
      for (var i = 0; i < size; i++) for (var j = 0; j < size; j++) {
        var distSq = Math.pow(gmx - i, 2) + Math.pow(gmy - j, 2);
        if (distSq < maxDist * maxDist) {
          var idx = 4 * (i + size * j), power = Math.min(maxDist / Math.sqrt(distSq), 10);
          dd[idx] += strength * 100 * ms.vX * power;
          dd[idx + 1] -= strength * 100 * ms.vY * power;
        }
      }
      ms.vX *= 0.9; ms.vY *= 0.9;
      dataTexture.needsUpdate = true;
      renderer.render(scene, camera);
    }
    function start() { if (!running && visible && !document.hidden) { running = true; raf = requestAnimationFrame(animate); } }
    function stop() { running = false; cancelAnimationFrame(raf); }
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else stop(); }, { threshold: 0 }).observe(container);
  }
  if (document.readyState === "complete") init();
  else window.addEventListener("load", init);
})();
