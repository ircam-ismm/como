import{_ as n,o as a,c as l,ak as p}from"./chunks/framework.Diucf6-3.js";const d=JSON.parse('{"title":"Scripts API","description":"","frontmatter":{},"headers":[],"relativePath":"generalities/script-api.md","filePath":"generalities/script-api.md"}'),o={name:"generalities/script-api.md"};function e(t,s,c,F,r,i){return a(),l("div",null,[...s[0]||(s[0]=[p(`<h1 id="scripts-api" tabindex="-1">Scripts API <a class="header-anchor" href="#scripts-api" aria-label="Permalink to “Scripts API”">​</a></h1><div class="language-js"><button title="Copy Code" class="copy"></button><span class="lang">js</span><pre class="shiki monokai" style="background-color:#272822;color:#F8F8F2;" tabindex="0" dir="ltr"><code><span class="line"><span style="color:#88846F;">/**</span></span>
<span class="line"><span style="color:#88846F;"> * Global objects that are passed to all script</span></span>
<span class="line"><span style="color:#88846F;"> */</span></span>
<span class="line"><span style="color:#66D9EF;font-style:italic;">const</span><span style="color:#F8F8F2;"> {</span></span>
<span class="line"><span style="color:#F8F8F2;">  audioContext,</span></span>
<span class="line"><span style="color:#F8F8F2;">  audioBufferLoader,</span></span>
<span class="line"><span style="color:#F8F8F2;">  como,</span></span>
<span class="line"><span style="color:#F8F8F2;">} </span><span style="color:#F92672;">=</span><span style="color:#A6E22E;"> getGlobalScriptingContext</span><span style="color:#F8F8F2;">();</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">/**</span></span>
<span class="line"><span style="color:#88846F;"> * Define a class description and init values for this script. Each script instance</span></span>
<span class="line"><span style="color:#88846F;"> * (e.g. on different nodes) will create its own shared state instance.</span></span>
<span class="line"><span style="color:#88846F;"> * cf. https://soundworks.dev/soundworks/SharedState.html</span></span>
<span class="line"><span style="color:#88846F;"> */</span></span>
<span class="line"><span style="color:#F92672;">export</span><span style="color:#F92672;"> async</span><span style="color:#66D9EF;font-style:italic;"> function</span><span style="color:#A6E22E;"> defineSharedState</span><span style="color:#F8F8F2;">(</span><span style="color:#FD971F;font-style:italic;">como</span><span style="color:#F8F8F2;">) {</span></span>
<span class="line"><span style="color:#F92672;">  return</span><span style="color:#F8F8F2;"> {</span></span>
<span class="line"><span style="color:#F8F8F2;">    classDescription: {</span></span>
<span class="line"><span style="color:#F8F8F2;">      play: {</span></span>
<span class="line"><span style="color:#F8F8F2;">        type: </span><span style="color:#E6DB74;">&#39;boolean&#39;</span><span style="color:#F8F8F2;">,</span></span>
<span class="line"><span style="color:#F8F8F2;">        event: </span><span style="color:#AE81FF;">true</span><span style="color:#F8F8F2;">,</span></span>
<span class="line"><span style="color:#F8F8F2;">      },</span></span>
<span class="line"><span style="color:#F8F8F2;">      energy: {</span></span>
<span class="line"><span style="color:#F8F8F2;">        type: </span><span style="color:#E6DB74;">&#39;float&#39;</span><span style="color:#F8F8F2;">,</span></span>
<span class="line"><span style="color:#F8F8F2;">        default: </span><span style="color:#AE81FF;">0.5</span><span style="color:#F8F8F2;">,</span></span>
<span class="line"><span style="color:#F8F8F2;">      },</span></span>
<span class="line"><span style="color:#F8F8F2;">    },</span></span>
<span class="line"><span style="color:#88846F;">    // initValues:  { play: false },</span></span>
<span class="line"><span style="color:#F8F8F2;">  };</span></span>
<span class="line"><span style="color:#F8F8F2;">}</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">/**</span></span>
<span class="line"><span style="color:#88846F;"> * Function executed when the script is created / initialized.</span></span>
<span class="line"><span style="color:#88846F;"> * e.g. Initialize objects or logic that should live for the whole lifecycle of the script</span></span>
<span class="line"><span style="color:#88846F;"> */</span></span>
<span class="line"><span style="color:#F92672;">export</span><span style="color:#F92672;"> async</span><span style="color:#66D9EF;font-style:italic;"> function</span><span style="color:#A6E22E;"> enter</span><span style="color:#F8F8F2;">(</span><span style="color:#FD971F;font-style:italic;">context</span><span style="color:#F8F8F2;">) {</span></span>
<span class="line"><span style="color:#66D9EF;font-style:italic;">  const</span><span style="color:#F8F8F2;"> { output, state, soundbank, scriptName } </span><span style="color:#F92672;">=</span><span style="color:#F8F8F2;"> context;</span></span>
<span class="line"><span style="color:#66D9EF;font-style:italic;">  const</span><span style="color:#F8F8F2;"> buffer </span><span style="color:#F92672;">=</span><span style="color:#F92672;"> await</span><span style="color:#F8F8F2;"> como.soundbankManager.</span><span style="color:#A6E22E;">getBuffer</span><span style="color:#F8F8F2;">(</span><span style="color:#E6DB74;">&#39;10-shake.mp3&#39;</span><span style="color:#F8F8F2;">);</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F8F8F2;">  state.</span><span style="color:#A6E22E;">onUpdate</span><span style="color:#F8F8F2;">(</span><span style="color:#FD971F;font-style:italic;">updates</span><span style="color:#66D9EF;font-style:italic;"> =&gt;</span><span style="color:#F8F8F2;"> {</span></span>
<span class="line"><span style="color:#F92672;">    if</span><span style="color:#F8F8F2;"> (</span><span style="color:#E6DB74;">&#39;play&#39;</span><span style="color:#F92672;"> in</span><span style="color:#F8F8F2;"> updates) {</span></span>
<span class="line"><span style="color:#66D9EF;font-style:italic;">      const</span><span style="color:#F8F8F2;"> now </span><span style="color:#F92672;">=</span><span style="color:#F8F8F2;"> audioContext.currentTime;</span></span>
<span class="line"><span style="color:#66D9EF;font-style:italic;">      const</span><span style="color:#F8F8F2;"> src </span><span style="color:#F92672;">=</span><span style="color:#F92672;"> new</span><span style="color:#A6E22E;"> AudioBufferSourceNode</span><span style="color:#F8F8F2;">(audioContext, { buffer });</span></span>
<span class="line"><span style="color:#F8F8F2;">      src.</span><span style="color:#A6E22E;">connect</span><span style="color:#F8F8F2;">(output);</span></span>
<span class="line"><span style="color:#F8F8F2;">      src.</span><span style="color:#A6E22E;">start</span><span style="color:#F8F8F2;">(now);</span></span>
<span class="line"><span style="color:#F8F8F2;">      src.</span><span style="color:#A6E22E;">stop</span><span style="color:#F8F8F2;">(now </span><span style="color:#F92672;">+</span><span style="color:#AE81FF;"> 1</span><span style="color:#F8F8F2;">);</span></span>
<span class="line"><span style="color:#F8F8F2;">    }</span></span>
<span class="line"><span style="color:#F8F8F2;">  });</span></span>
<span class="line"><span style="color:#F8F8F2;">}</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">/**</span></span>
<span class="line"><span style="color:#88846F;"> * Function executed when the script is deleted.</span></span>
<span class="line"><span style="color:#88846F;"> * e.g. clean schedulers, timers, etc.</span></span>
<span class="line"><span style="color:#88846F;"> */</span></span>
<span class="line"><span style="color:#F92672;">export</span><span style="color:#F92672;"> async</span><span style="color:#66D9EF;font-style:italic;"> function</span><span style="color:#A6E22E;"> exit</span><span style="color:#F8F8F2;">(</span><span style="color:#FD971F;font-style:italic;">context</span><span style="color:#F8F8F2;">) {</span></span>
<span class="line"><span style="color:#66D9EF;font-style:italic;">  const</span><span style="color:#F8F8F2;"> { output, state, soundbank, scriptName } </span><span style="color:#F92672;">=</span><span style="color:#F8F8F2;"> context;</span></span>
<span class="line"><span style="color:#88846F;">  // ...</span></span>
<span class="line"><span style="color:#F8F8F2;">}</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">/**</span></span>
<span class="line"><span style="color:#88846F;"> * Function executed when a new data frame from the associated is source is received.</span></span>
<span class="line"><span style="color:#88846F;"> * e.g. process the frame and map to some output</span></span>
<span class="line"><span style="color:#88846F;"> */</span></span>
<span class="line"><span style="color:#F92672;">export</span><span style="color:#F92672;"> async</span><span style="color:#66D9EF;font-style:italic;"> function</span><span style="color:#A6E22E;"> process</span><span style="color:#F8F8F2;">(</span><span style="color:#FD971F;font-style:italic;">context</span><span style="color:#F8F8F2;">, </span><span style="color:#FD971F;font-style:italic;">frame</span><span style="color:#F8F8F2;">) {</span></span>
<span class="line"><span style="color:#66D9EF;font-style:italic;">  const</span><span style="color:#F8F8F2;"> { output, state, soundbank, scriptName } </span><span style="color:#F92672;">=</span><span style="color:#F8F8F2;"> context;</span></span>
<span class="line"><span style="color:#88846F;">  // ...</span></span>
<span class="line"><span style="color:#F8F8F2;">}</span></span></code></pre></div>`,2)])])}const f=n(o,[["render",e]]);export{d as __pageData,f as default};
