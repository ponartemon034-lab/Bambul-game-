/* ==========================================================================
   BB.gl - WebGL post-process "AI-style" image enhancement (DLSS/FSR-like in spirit, NOT real DLSS):
   edge-aware anti-aliasing, contrast-adaptive sharpening (RCAS-like), local contrast ("clarity"), gentle
   lens chromatic aberration, filmic S-curve and dithering. The 2D game canvas is uploaded as a texture each
   frame and drawn to an overlay canvas; with BB.renderScale < 1 the 2D scene is rendered at lower resolution
   and upscaled here (dynamic-resolution trick that also saves GPU time).
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const VS = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;varying vec2 uv;uniform sampler2D t;uniform vec2 px;uniform float amt;uniform float seed;
float L(vec3 c){return dot(c,vec3(.299,.587,.114));}
void main(){
  vec2 cc=uv-.5; float ab=dot(cc,cc)*1.1*amt;                                   // lens chromatic aberration (stronger at the edges)
  vec3 c=vec3(texture2D(t,uv+cc*ab*.012).r,texture2D(t,uv).g,texture2D(t,uv-cc*ab*.012).b);
  vec3 n=texture2D(t,uv+vec2(0.,px.y)).rgb,s=texture2D(t,uv-vec2(0.,px.y)).rgb,e=texture2D(t,uv+vec2(px.x,0.)).rgb,w=texture2D(t,uv-vec2(px.x,0.)).rgb;
  float lc=L(c),ln=L(n),ls=L(s),le=L(e),lw=L(w);
  float mn=min(lc,min(min(ln,ls),min(le,lw))),mx=max(lc,max(max(ln,ls),max(le,lw)));
  // 1) edge-aware anti-aliasing: blend along strong luma edges only
  vec3 avg=(n+s+e+w)*.25; float edge=smoothstep(.07,.30,mx-mn);
  vec3 col=mix(c,mix(c,avg,.6),edge*amt);
  // 2) contrast adaptive sharpening (less sharpening where contrast is already high)
  float wgt=-1./mix(8.,5.,clamp(min(mn,1.-mx)/max(mx,.001),0.,1.))*(.45+.25*amt)*.62;
  col=(col+wgt*(n+s+e+w))/(1.+4.*wgt);
  // 3) local contrast / clarity
  col+=(col-avg)*.11*amt;
  // 4) filmic S-curve + slight saturation lift, dithering against banding
  col=mix(col,col*col*(3.-2.*col),.10*amt);
  float g=dot(col,vec3(.299,.587,.114)); col=mix(vec3(g),col,1.0+.04*amt);
  float d=fract(sin(dot(gl_FragCoord.xy+seed,vec2(12.9898,78.233)))*43758.5453)-.5; col+=d/255.;
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;
  const G = BB.gl = { on: false, amt: 1, ok: false };
  BB.renderScale = 1;
  G.init = function (src) {
    if (G.ok) return true;
    try {
      const c = document.createElement('canvas'); c.id = 'cvgl'; c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;image-rendering:auto';
      const gl = c.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); if (!gl) return false;
      const sh = (ty, s) => { const o = gl.createShader(ty); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('link');
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.useProgram(pr); const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      G.c = c; G.gl = gl; G.u = { px: gl.getUniformLocation(pr, 'px'), amt: gl.getUniformLocation(pr, 'amt'), seed: gl.getUniformLocation(pr, 'seed') }; G.src = src; G.ok = true;
      src.parentNode.insertBefore(c, src.nextSibling); return true;
    } catch (e) { console.warn('[post] WebGL enhance unavailable:', e.message); G.ok = false; return false; }
  };
  G.enable = function (src, on) {
    on = !!on; if (on && !G.init(src)) on = false;
    G.on = on; if (G.c) G.c.style.display = on ? 'block' : 'none'; src.style.visibility = on ? 'hidden' : 'visible'; BB.renderScale = on ? (BB.renderScaleWanted || 1) : 1;
    if (BB.fit) BB.fit();
  };
  G.present = function () {
    if (!G.on || !G.ok) return; const gl = G.gl, s = G.src, W = s.clientWidth * Math.min(window.devicePixelRatio || 1, 2) | 0, H = s.clientHeight * Math.min(window.devicePixelRatio || 1, 2) | 0;
    const tw = Math.min(W, 2560), th = Math.min(H, 1440); if (G.c.width !== tw || G.c.height !== th) { G.c.width = tw; G.c.height = th; }
    gl.viewport(0, 0, G.c.width, G.c.height);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, s); } catch (e) { G.on = false; s.style.visibility = 'visible'; G.c.style.display = 'none'; return; }
    gl.uniform2f(G.u.px, 1 / s.width, 1 / s.height); gl.uniform1f(G.u.amt, G.amt); gl.uniform1f(G.u.seed, (performance.now() % 1000)); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
})();
