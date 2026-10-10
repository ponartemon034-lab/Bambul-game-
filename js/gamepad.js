/* ==========================================================================
   BB.pad - gamepad support (Standard Gamepad mapping: Xbox / PlayStation / Switch Pro / most generic pads).
   In play it feeds BB.In directly; in menus / dialogues it sends the same key events the keyboard would,
   so every screen is navigable with a pad:
     stick / D-pad  walk (menus: move focus)       A  jump (menus: confirm)      B  hold-to-clean (menus: back)
     X  action (E)  RT  hold-to-clean              LT run (or push the stick all the way)
     Y  call Dan    LB/RB  previous / next tool    Back  to-do list              Start  pause
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const DEAD = .22;
  const pad = BB.pad = { active: null, name: '', _prev: {}, _rep: {} };
  const toolOrder = ['hand', 'vac', 'mop', 'box'];
  const key = (code, down) => { try { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true })); } catch (e) { } };
  const tap = code => { key(code, true); key(code, false); };
  const menuMode = () => { const S = BB.S; return !S || S.mode !== 'play' || BB.paused || !!(BB.ui && BB.ui.busy && BB.ui.busy()); };

  function cycleTool(dir) {
    const S = BB.S; if (!S || !BB.ui || !BB.ui.selectTool) return;
    const own = toolOrder.filter(t => t === 'hand' || (S.tools && S.tools[t]));
    const i = Math.max(0, own.indexOf(S.active || 'hand')); BB.ui.selectTool(own[(i + dir + own.length) % own.length]);
  }

  function poll(now) {
    requestAnimationFrame(poll);
    const pads = navigator.getGamepads ? navigator.getGamepads() : []; let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    const In = BB.In; if (!In) return;
    if (!gp) { if (pad.active) { pad.active = null; In.gpActive = null; In.gpAx = 0; In.gpRun = In.gpUse = In.gpJump = false; } return; }
    if (!pad.active || pad.active.index !== gp.index) { pad.active = gp; pad.name = gp.id; In.gpActive = gp; try { BB.ui && BB.ui.toast && BB.ui.toast('Геймпад подключён'); } catch (e) { } }
    const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .5)), prev = pad._prev;
    const edge = i => b(i) && !prev[i];
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, dl = b(14), dr = b(15), du = b(12), dd = b(13);
    let any = false; for (let i = 0; i < gp.buttons.length; i++) if (b(i)) any = true;
    if (any || Math.abs(ax) > .5 || Math.abs(ay) > .5) { try { BB.audio && BB.audio.init && BB.audio.init(); } catch (e) { } In.usedTouch = false; }

    if (menuMode()) {
      In.gpAx = 0; In.gpRun = In.gpUse = In.gpJump = false;
      if (edge(0)) { key('Enter', true); key('Enter', false); }
      if (edge(1)) tap('Escape');
      if (edge(9)) tap('Escape');
      if (edge(3) && BB.S && BB.S.mode === 'play' && !BB.paused) tap('KeyT');
      const dirs = [['ArrowLeft', dl || ax < -.55], ['ArrowRight', dr || ax > .55], ['ArrowUp', du || ay < -.55], ['ArrowDown', dd || ay > .55]];
      for (const [code, on] of dirs) {
        const r = pad._rep[code] || (pad._rep[code] = { on: false, t: 0 });
        if (on && !r.on) { r.on = true; r.t = now + 380; tap(code); } else if (on && now > r.t) { r.t = now + 130; tap(code); } else if (!on) r.on = false;
      }
    } else {
      const sx = Math.abs(ax) < DEAD ? 0 : Math.sign(ax) * Math.min(1, (Math.abs(ax) - DEAD) / (1 - DEAD));
      In.gpAx = dl ? -1 : dr ? 1 : sx;
      In.gpRun = b(6) || b(10) || Math.abs(ax) > .94;
      In.gpUse = b(1) || b(7); In.gpJump = b(0) || du;
      if ((edge(0) || (du && !prev[12]))) In.jump = true;
      if (edge(2)) In.act = true;
      if ((edge(1) || edge(7))) In.useEdge = true;
      if (edge(3)) tap('KeyT');
      if (edge(8)) tap('Tab');
      if (edge(9)) tap('Escape');
      if (edge(4)) cycleTool(-1);
      if (edge(5)) cycleTool(1);
    }
    for (let i = 0; i < gp.buttons.length; i++) prev[i] = b(i);
  }
  window.addEventListener('gamepadconnected', () => { });
  requestAnimationFrame(poll);
})();
