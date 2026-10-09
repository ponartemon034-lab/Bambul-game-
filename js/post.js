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
float skin(vec3 c){ // soft skin-tone mask (hue ~ orange, medium saturation, not too dark)
  float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),d=mx-mn+1e-4,s=d/(mx+1e-4);
  float ok=step(c.g,c.r)*step(c.b*.9,c.g)*smoothstep(.12,.2,s)*(1.-smoothstep(.6,.72,s))*smoothstep(.3,.42,mx);
  float h=(c.g-c.b)/d; return ok*smoothstep(-.05,.2,h)*(1.-smoothstep(.75,1.,h));
}
void main(){
  vec3 c=texture2D(t,uv).rgb;
  vec3 n=texture2D(t,uv+vec2(0.,px.y)).rgb,s=texture2D(t,uv-vec2(0.,px.y)).rgb,e=texture2D(t,uv+vec2(px.x,0.)).rgb,w=texture2D(t,uv-vec2(px.x,0.)).rgb;
  vec3 ne=texture2D(t,uv+px).rgb,nw=texture2D(t,uv+vec2(-px.x,px.y)).rgb,se=texture2D(t,uv+vec2(px.x,-px.y)).rgb,sw=texture2D(t,uv-px).rgb;
  float lc=L(c);
  // 1) edge-preserving denoise (bilateral 3x3): flattens grain/speckle, keeps real edges
  vec3 acc=c*2.;float wsum=2.;
  vec3 nb[8];nb[0]=n;nb[1]=s;nb[2]=e;nb[3]=w;nb[4]=ne;nb[5]=nw;nb[6]=se;nb[7]=sw;
  for(int i=0;i<8;i++){float dl=abs(L(nb[i])-lc);float k=exp(-dl*dl*160.)*(i<4?1.:.7);acc+=nb[i]*k;wsum+=k;}
  vec3 dn=acc/wsum; c=mix(c,dn,.5*amt);
  // 2) skin: wider soft smoothing + warm subsurface glow, only on skin-coloured pixels
  float sk=skin(c);
  if(sk>.01){
    vec3 b=c*1.;float bs=1.;
    for(int i=0;i<8;i++){vec3 q=nb[i];float dl=abs(L(q)-lc);float k=exp(-dl*dl*260.)*skin(q);b+=q*k;bs+=k;}
    b/=bs; vec3 sm=mix(c,b,.7);
    vec3 warm=sm*vec3(1.045,1.0,.97); float sh=1.-smoothstep(.15,.7,lc);
    sm+=vec3(.028,.006,0.)*sh;                                   // blood-under-skin tint in shadows
    c=mix(c,mix(sm,warm,.5),sk*amt);
  }
  // 3) mild anti-aliasing on strong edges only
  float mn=min(lc,min(min(L(n),L(s)),min(L(e),L(w)))),mx=max(lc,max(max(L(n),L(s)),max(L(e),L(w))));
  float edge=smoothstep(.10,.34,mx-mn); c=mix(c,(n+s+e+w+c*2.)/6.,edge*.4*amt);
  // 4) very light contrast-adaptive sharpen (kept tiny to avoid ringing/noise)
  float wg=-1./mix(8.,5.,clamp(min(mn,1.-mx)/max(mx,.001),0.,1.))*.16*amt;
  c=(c+wg*(n+s+e+w))/(1.+4.*wg);
  // 5) gentle filmic curve, no visible dither
  c=mix(c,c*c*(3.-2.*c),.07*amt);
  float d=fract(sin(dot(gl_FragCoord.xy+seed,vec2(12.9898,78.233)))*43758.5453)-.5; c+=d/510.;
  gl_FragColor=vec4(clamp(c,0.,1.),1.);
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
