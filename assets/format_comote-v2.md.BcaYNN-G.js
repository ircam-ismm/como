import{_ as a,o as n,c as e,ak as o}from"./chunks/framework.BLWuzyvc.js";const y=JSON.parse('{"title":"CoMote v2 format","description":"","frontmatter":{},"headers":[],"relativePath":"format/comote-v2.md","filePath":"format/comote-v2.md"}'),l={name:"format/comote-v2.md"};function p(t,s,c,r,i,F){return n(),e("div",null,[...s[0]||(s[0]=[o(`<h1 id="comote-v2-format" tabindex="-1">CoMote v2 format <a class="header-anchor" href="#comote-v2-format" aria-label="Permalink to “CoMote v2 format”">​</a></h1><p>Until version 2, CoMote followed the <a href="https://www.w3.org/TR/orientation-event/#devicemotion" target="_blank" rel="noreferrer">devicemotion W3C specification</a>.</p><p>See <a href="./v3.html">v3</a> for the current version.</p><h2 id="websocket" tabindex="-1">WebSocket <a class="header-anchor" href="#websocket" aria-label="Permalink to “WebSocket”">​</a></h2><div class="language-javascript"><button title="Copy Code" class="copy"></button><span class="lang">javascript</span><pre class="shiki monokai" style="background-color:#272822;color:#F8F8F2;" tabindex="0" dir="ltr"><code><span class="line"><span style="color:#F8F8F2;">e </span><span style="color:#F92672;">=</span><span style="color:#F8F8F2;"> {</span></span>
<span class="line"><span style="color:#F8F8F2;">  source: </span><span style="color:#E6DB74;">&#39;comote&#39;</span><span style="color:#F8F8F2;">,</span></span>
<span class="line"><span style="color:#F8F8F2;">  id: </span><span style="color:#AE81FF;">42</span><span style="color:#F8F8F2;">,</span></span>
<span class="line"><span style="color:#88846F;">  // See https://www.w3.org/TR/orientation-event/#devicemotion</span></span>
<span class="line"><span style="color:#F8F8F2;">  devicemotion: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    interval, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    accelerationIncludingGravity: {</span></span>
<span class="line"><span style="color:#F8F8F2;">      x, </span><span style="color:#88846F;">// m/s2</span></span>
<span class="line"><span style="color:#F8F8F2;">      y, </span><span style="color:#88846F;">// m/s2</span></span>
<span class="line"><span style="color:#F8F8F2;">      z, </span><span style="color:#88846F;">// m/s2</span></span>
<span class="line"><span style="color:#F8F8F2;">    },</span></span>
<span class="line"><span style="color:#F8F8F2;">    rotationRate: {</span></span>
<span class="line"><span style="color:#F8F8F2;">      alpha, </span><span style="color:#88846F;">// deg/s</span></span>
<span class="line"><span style="color:#F8F8F2;">      beta,  </span><span style="color:#88846F;">// deg/s</span></span>
<span class="line"><span style="color:#F8F8F2;">      gamma, </span><span style="color:#88846F;">// deg/s</span></span>
<span class="line"><span style="color:#F8F8F2;">    },</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // not standardised, yet.</span></span>
<span class="line"><span style="color:#88846F;">  // See https://w3c.github.io/deviceorientation/spec-source-orientation.html#worked-example</span></span>
<span class="line"><span style="color:#F8F8F2;">  heading: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    interval, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    accuracy, </span><span style="color:#88846F;">// degrees, -1 for unknown</span></span>
<span class="line"><span style="color:#F8F8F2;">    magnetic, </span><span style="color:#88846F;">// degrees (0 is magnetic north, 90 is east)</span></span>
<span class="line"><span style="color:#F8F8F2;">    geographic, </span><span style="color:#88846F;">// degrees (0 is geographic north, 90 is east)</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F8F8F2;">  buttonA, </span><span style="color:#88846F;">// 0 or 1</span></span>
<span class="line"><span style="color:#F8F8F2;">  buttonB, </span><span style="color:#88846F;">// 0 or 1</span></span>
<span class="line"><span style="color:#F8F8F2;">}</span></span></code></pre></div><h2 id="osc" tabindex="-1">OSC <a class="header-anchor" href="#osc" aria-label="Permalink to “OSC”">​</a></h2><p>Notes:</p><ul><li>All values are float32 <code>f</code>, int32 <code>i</code> or string <code>s</code>. Complex values must be serialised to a string.</li><li>Any boolean value is converted to an integer: 1 for true and 0 for false</li><li>Infinity is the max value of float32 or int32.</li></ul><div class="language-"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki monokai" style="background-color:#272822;color:#F8F8F2;" tabindex="0" dir="ltr"><code><span class="line"><span>/comote/\${id}/devicemotion  [interval, x, y, z, alpha, beta, gamma]</span></span>
<span class="line"><span>/comote/\${id}/heading       [interval, accuracy, magnetic, geographic]</span></span>
<span class="line"><span>/comote/\${id}/buttonA       [buttonA]</span></span>
<span class="line"><span>/comote/\${id}/buttonB       [buttonA]</span></span></code></pre></div>`,9)])])}const m=a(l,[["render",p]]);export{y as __pageData,m as default};
