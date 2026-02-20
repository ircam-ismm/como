import{_ as n,o as a,c as e,ak as l}from"./chunks/framework.BLWuzyvc.js";const m=JSON.parse('{"title":"Data Format - version 3","description":"","frontmatter":{},"headers":[],"relativePath":"format/v3.md","filePath":"format/v3.md"}'),p={name:"format/v3.md"};function t(o,s,r,c,i,F){return a(),e("div",null,[...s[0]||(s[0]=[l(`<h1 id="data-format-version-3" tabindex="-1">Data Format - version 3 <a class="header-anchor" href="#data-format-version-3" aria-label="Permalink to “Data Format - version 3”">​</a></h1><p>This data format aims at providing a unified interface for motion sensors so that a given application can work seamlessly with different motion sensors and devices.</p><p>The format tries to follow as much as possible the W3C specification.</p><h2 id="javascript" tabindex="-1">JavaScript <a class="header-anchor" href="#javascript" aria-label="Permalink to “JavaScript”">​</a></h2><div class="language-javascript"><button title="Copy Code" class="copy"></button><span class="lang">javascript</span><pre class="shiki monokai" style="background-color:#272822;color:#F8F8F2;" tabindex="0" dir="ltr"><code><span class="line"><span style="color:#F8F8F2;">e </span><span style="color:#F92672;">=</span><span style="color:#F8F8F2;"> {</span></span>
<span class="line"><span style="color:#F8F8F2;">  source: </span><span style="color:#E6DB74;">&#39;comote&#39;</span><span style="color:#F8F8F2;">,</span></span>
<span class="line"><span style="color:#F8F8F2;">  api: </span><span style="color:#E6DB74;">&#39;v3&#39;</span><span style="color:#F8F8F2;">,</span></span>
<span class="line"><span style="color:#F8F8F2;">  id, </span><span style="color:#88846F;">// string</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // attributes, inherited Sensor attributes, constructor options</span></span>
<span class="line"><span style="color:#88846F;">  // https://w3c.github.io/sensors/#the-sensor-interface</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // timestamp is a monotonic time, in milliseconds</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // https://w3c.github.io/accelerometer/#accelerometer-interface</span></span>
<span class="line"><span style="color:#F8F8F2;">  accelerometer: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    x, </span><span style="color:#88846F;">// m/s^2</span></span>
<span class="line"><span style="color:#F8F8F2;">    y, </span><span style="color:#88846F;">// m/s^2</span></span>
<span class="line"><span style="color:#F8F8F2;">    z, </span><span style="color:#88846F;">// m/s^2</span></span>
<span class="line"><span style="color:#F8F8F2;">    timestamp, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    frequency, </span><span style="color:#88846F;">// hz</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // https://w3c.github.io/gyroscope/#gyroscope-interface</span></span>
<span class="line"><span style="color:#F8F8F2;">  gyroscope: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    x, </span><span style="color:#88846F;">// rad/s</span></span>
<span class="line"><span style="color:#F8F8F2;">    y, </span><span style="color:#88846F;">// rad/s</span></span>
<span class="line"><span style="color:#F8F8F2;">    z, </span><span style="color:#88846F;">// rad/s</span></span>
<span class="line"><span style="color:#F8F8F2;">    timestamp, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    frequency, </span><span style="color:#88846F;">// hz</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // https://w3c.github.io/magnetometer/#magnetometer-interface</span></span>
<span class="line"><span style="color:#F8F8F2;">  magnetometer: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    x, </span><span style="color:#88846F;">// uT</span></span>
<span class="line"><span style="color:#F8F8F2;">    y, </span><span style="color:#88846F;">// uT</span></span>
<span class="line"><span style="color:#F8F8F2;">    z, </span><span style="color:#88846F;">// uT</span></span>
<span class="line"><span style="color:#F8F8F2;">    timestamp, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    frequency, </span><span style="color:#88846F;">// hz</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // https://w3c.github.io/accelerometer/#gravitysensor-interface</span></span>
<span class="line"><span style="color:#F8F8F2;">  gravity: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    x, </span><span style="color:#88846F;">// m/s^2</span></span>
<span class="line"><span style="color:#F8F8F2;">    y, </span><span style="color:#88846F;">// m/s^2</span></span>
<span class="line"><span style="color:#F8F8F2;">    z, </span><span style="color:#88846F;">// m/s^2</span></span>
<span class="line"><span style="color:#F8F8F2;">    timestamp, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    frequency, </span><span style="color:#88846F;">// hz</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // https://w3c.github.io/orientation-sensor/#model</span></span>
<span class="line"><span style="color:#F8F8F2;">  absoluteorientation: {</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">    // A latest reading for a Sensor of Orientation Sensor sensor type includes</span></span>
<span class="line"><span style="color:#88846F;">    //  an entry whose key is &quot;quaternion&quot; and whose value contains a four</span></span>
<span class="line"><span style="color:#88846F;">    // element list. The elements of the list are equal to components of a unit</span></span>
<span class="line"><span style="color:#88846F;">    // quaternion [QUATERNIONS] [Vx * sin(θ/2), Vy * sin(θ/2), Vz * sin(θ/2),</span></span>
<span class="line"><span style="color:#88846F;">    // cos(θ/2)] where V is the unit vector (whose elements are Vx, Vy, and Vz)</span></span>
<span class="line"><span style="color:#88846F;">    // representing the axis of rotation, and θ is the rotation angle about the</span></span>
<span class="line"><span style="color:#88846F;">    // axis defined by the unit vector V.</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">    // Note: The quaternion components are arranged in the list as [q1, q2, q3, q0]</span></span>
<span class="line"><span style="color:#88846F;">    // [QUATERNIONS], i.e. the components representing the vector part of the</span></span>
<span class="line"><span style="color:#88846F;">    // quaternion go first and the scalar part component which is equal to cos(θ/2)</span></span>
<span class="line"><span style="color:#88846F;">    // goes after. This order is used for better compatibility with the most of the</span></span>
<span class="line"><span style="color:#88846F;">    // existing WebGL frameworks, however other libraries could use a different</span></span>
<span class="line"><span style="color:#88846F;">    // order when exposing quaternion as an array, e.g. [q0, q1, q2, q3].</span></span>
<span class="line"><span style="color:#F8F8F2;">    quaternion: [x, y, z, w], </span><span style="color:#88846F;">// array [q1, q2, q3, q0]</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">    // https://w3c.github.io/orientation-sensor/#helper-create-quaternion-from-euler-angles</span></span>
<span class="line"><span style="color:#F8F8F2;">    euler: {</span></span>
<span class="line"><span style="color:#F8F8F2;">      alpha, </span><span style="color:#88846F;">// deg (yaw)</span></span>
<span class="line"><span style="color:#F8F8F2;">      beta, </span><span style="color:#88846F;">// deg (pitch)</span></span>
<span class="line"><span style="color:#F8F8F2;">      gamma, </span><span style="color:#88846F;">// deg (roll)</span></span>
<span class="line"><span style="color:#F8F8F2;">    },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F8F8F2;">    timestamp, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    frequency, </span><span style="color:#88846F;">// hz</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // not in W3C specification</span></span>
<span class="line"><span style="color:#F8F8F2;">  barometer: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    pressure, </span><span style="color:#88846F;">// hPa</span></span>
<span class="line"><span style="color:#F8F8F2;">    relativeAltitude, </span><span style="color:#88846F;">// m (0 if not available)</span></span>
<span class="line"><span style="color:#F8F8F2;">    timestamp, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    frequency, </span><span style="color:#88846F;">// hz</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F8F8F2;">  thermometer: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    temperature, </span><span style="color:#88846F;">// °C</span></span>
<span class="line"><span style="color:#F8F8F2;">    timestamp, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    frequency, </span><span style="color:#88846F;">// hz</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // not standardised, yet.</span></span>
<span class="line"><span style="color:#88846F;">  // See https://w3c.github.io/deviceorientation/spec-source-orientation.html#worked-example</span></span>
<span class="line"><span style="color:#F8F8F2;">  heading: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    magnetic, </span><span style="color:#88846F;">// degrees (0 is magnetic north, 90 is east)</span></span>
<span class="line"><span style="color:#F8F8F2;">    geographic, </span><span style="color:#88846F;">// degrees (0 is geographic north, 90 is east)</span></span>
<span class="line"><span style="color:#F8F8F2;">    accuracy, </span><span style="color:#88846F;">// degrees, -1 for unknown</span></span>
<span class="line"><span style="color:#F8F8F2;">    timestamp, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    frequency, </span><span style="color:#88846F;">// hz</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#88846F;">  // See https://www.w3.org/TR/battery-status/#internal-slots-0</span></span>
<span class="line"><span style="color:#F8F8F2;">  battery: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    level, </span><span style="color:#88846F;">// 0. for depleted, 1. for full. 1. is also used when</span></span>
<span class="line"><span style="color:#88846F;">      // implementation is unable to report the battery&#39;s level, or there</span></span>
<span class="line"><span style="color:#88846F;">      //  is no battery attached to the system.</span></span>
<span class="line"><span style="color:#F8F8F2;">    charging, </span><span style="color:#88846F;">// boolean. It MUST be set to false if the battery is</span></span>
<span class="line"><span style="color:#88846F;">      // discharging, and set to true if the battery is charging, the</span></span>
<span class="line"><span style="color:#88846F;">      // implementation is unable to report the state, or there is no battery</span></span>
<span class="line"><span style="color:#88846F;">      // attached to the system, or otherwise.</span></span>
<span class="line"><span style="color:#F8F8F2;">    chargingTime, </span><span style="color:#88846F;">// remaining time in seconds. It MUST be set to 0 if the</span></span>
<span class="line"><span style="color:#88846F;">      // battery is full or there is no battery attached to the system, and</span></span>
<span class="line"><span style="color:#88846F;">      // to the value positive Infinity if the battery is discharging, the</span></span>
<span class="line"><span style="color:#88846F;">      // implementation is unable to report the remaining charging time, or</span></span>
<span class="line"><span style="color:#88846F;">      //  otherwise.</span></span>
<span class="line"><span style="color:#F8F8F2;">    dischargingTime, </span><span style="color:#88846F;">// remaining time in seconds. It MUST be set to the</span></span>
<span class="line"><span style="color:#88846F;">      // value positive Infinity if the battery is charging, the implementation</span></span>
<span class="line"><span style="color:#88846F;">      // is unable to report the remaining discharging time, there is no</span></span>
<span class="line"><span style="color:#88846F;">      // battery attached to the system, or otherwise.</span></span>
<span class="line"><span style="color:#F8F8F2;">    timestamp, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">    frequency, </span><span style="color:#88846F;">// hz</span></span>
<span class="line"><span style="color:#F8F8F2;">  },</span></span>
<span class="line"></span>
<span class="line"><span style="color:#F8F8F2;">  control: {</span></span>
<span class="line"><span style="color:#F8F8F2;">    [key]: value, </span><span style="color:#88846F;">// e.g. \`buttonA: 1,\`</span></span>
<span class="line"><span style="color:#F8F8F2;">    timestamp, </span><span style="color:#88846F;">// ms</span></span>
<span class="line"><span style="color:#F8F8F2;">  }</span></span>
<span class="line"><span style="color:#F8F8F2;">}</span></span></code></pre></div><h2 id="osc" tabindex="-1">OSC <a class="header-anchor" href="#osc" aria-label="Permalink to “OSC”">​</a></h2><p>Notes:</p><ul><li>All values are float32 <code>f</code>, int32 <code>i</code> or string <code>s</code>. Complex values must be serialised to a string.</li><li><code>timestamp</code> is a monotonic time in milliseconds that should start at 0 with the application to fit in int32, or it should be a float64.</li><li>Any boolean value is converted to an integer: 1 for true and 0 for false</li><li>Infinity values are in the valid range of float32 or int32:</li></ul><table tabindex="0"><thead><tr><th>type</th><th>-Infinity</th><th>+Infinity</th></tr></thead><tbody><tr><td>int32</td><td>-2147483649</td><td>2147483647</td></tr><tr><td>float32</td><td>-3.4028235e+38</td><td>3.4028235e+38</td></tr></tbody></table><div class="language-md"><button title="Copy Code" class="copy"></button><span class="lang">md</span><pre class="shiki monokai" style="background-color:#272822;color:#F8F8F2;" tabindex="0" dir="ltr"><code><span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/accelerometer  [x, y, z, timestamp, frequency]</span></span>
<span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/gyroscope      [x, y, z, timestamp, frequency]</span></span>
<span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/magnetometer   [x, y, z, timestamp, frequency]</span></span>
<span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/gravity        [x, y, z, timestamp, frequency]</span></span>
<span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/absoluteorientation/quaternion [x, y, z, w, timestamp, frequency]</span></span>
<span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/absoluteorientation/euler      [alpha, beta, gamma, timestamp, frequency]</span></span>
<span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/barometer      [pressure, relativeAltitude, timestamp, frequency]</span></span>
<span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/thermometer    [temperature, timestamp, frequency]</span></span>
<span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/heading        [magnetic, geographic, accuracy, timestamp, frequency]</span></span>
<span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/battery        [&lt;level&gt;, &lt;charging&gt;, &lt;chargingTime&gt;, &lt;dischargingTime&gt;, timestamp, frequency]</span></span>
<span class="line"><span style="color:#F8F8F2;">/&lt;source&gt;/&lt;api&gt;/&lt;id&gt;/control/&lt;key&gt;  [...values, timestamp]</span></span></code></pre></div>`,10)])])}const h=n(p,[["render",t]]);export{m as __pageData,h as default};
