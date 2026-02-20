import{_ as n,o as s,c as e,ak as p}from"./chunks/framework.BLWuzyvc.js";const m=JSON.parse('{"title":"R-IoT format","description":"","frontmatter":{},"headers":[],"relativePath":"format/riot-v1-v2.md","filePath":"format/riot-v1-v2.md"}'),o={name:"format/riot-v1-v2.md"};function i(l,a,r,t,c,f){return s(),e("div",null,[...a[0]||(a[0]=[p(`<h1 id="r-iot-format" tabindex="-1">R-IoT format <a class="header-anchor" href="#r-iot-format" aria-label="Permalink to “R-IoT format”">​</a></h1><p>Since version 3, R-IoT follows the unified <a href="./v3.html">v3</a> format.</p><p>Before that format changed over time.</p><h2 id="r-iot-bitalino-version-2" tabindex="-1">R-IoT Bitalino version 2 <a class="header-anchor" href="#r-iot-bitalino-version-2" aria-label="Permalink to “R-IoT Bitalino version 2”">​</a></h2><p>22 float-32 values in a single <code>/raw</code> message:</p><div class="language-"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki monokai" style="background-color:#272822;color:#F8F8F2;" tabindex="0" dir="ltr"><code><span class="line"><span>/\${id}/raw ffffffffffffffffffffff [</span></span>
<span class="line"><span>   acceleration_y, -acceleration_x, acceleration_z, // in g/s/s</span></span>
<span class="line"><span>   gyroscope_alpha, -gyroscope_beta, gyroscope_gamma, // in deg/ms</span></span>
<span class="line"><span>   -magnetometer_y, -magnetometer_x, magnetometer_z, // in gauss</span></span>
<span class="line"><span>   temperature, // in (°C - 21)*8</span></span>
<span class="line"><span>   button_onboard, button_external, // in {0, 1}</span></span>
<span class="line"><span>   analog_input_0, analog_input_1, // in [0, 4095]</span></span>
<span class="line"><span>   quaternion w, x, y, z, // as [q0, q1, q2, q3]</span></span>
<span class="line"><span>   euler_angle alpha, beta, gamma, // in deg</span></span>
<span class="line"><span>   heading // in [-180, 180] deg</span></span>
<span class="line"><span>]</span></span></code></pre></div><h2 id="r-iot-ircam-version-2" tabindex="-1">R-IoT Ircam version 2 <a class="header-anchor" href="#r-iot-ircam-version-2" aria-label="Permalink to “R-IoT Ircam version 2”">​</a></h2><p>20 float-32 values in a single <code>/raw</code> message:</p><div class="language-"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki monokai" style="background-color:#272822;color:#F8F8F2;" tabindex="0" dir="ltr"><code><span class="line"><span>/\${id}/raw ffffffffffffffffffff [</span></span>
<span class="line"><span>   battery, // in [3.5, 3.9] V*877</span></span>
<span class="line"><span>   button_onboard, // in {0,1}</span></span>
<span class="line"><span>   -acceleration_y, acceleration_x, -acceleration_z, // in g/s/s</span></span>
<span class="line"><span>   -gyroscope_alpha, gyroscope_beta, -gyroscope_gamma, // in deg/ms</span></span>
<span class="line"><span>   magnetometer_y, magnetometer_x, -magnetometer_z, // in gauss</span></span>
<span class="line"><span>   temperature, // in (°C - 21)*8</span></span>
<span class="line"><span>   quaternion w, x, y, z, // as [q0, q1, q2, q3]</span></span>
<span class="line"><span>   euler_angle alpha, beta, gamma, // in deg</span></span>
<span class="line"><span>   heading // in [-180, 180] deg</span></span>
<span class="line"><span>   analog_input_0, analog_input_1, // in [0, 4095]</span></span>
<span class="line"><span>]</span></span></code></pre></div><h2 id="r-iot-ircam-version-1" tabindex="-1">R-IoT Ircam version 1 <a class="header-anchor" href="#r-iot-ircam-version-1" aria-label="Permalink to “R-IoT Ircam version 1”">​</a></h2><p>All values are 32-bit floats.</p><ul><li>12 values in <code>/raw</code> message</li><li>4 values in <code>/quat</code> message</li><li>3 values in <code>euler</code> message</li></ul><div class="language-"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki monokai" style="background-color:#272822;color:#F8F8F2;" tabindex="0" dir="ltr"><code><span class="line"><span>/\${id}/raw ffffffffffff [</span></span>
<span class="line"><span>   battery, // in [3.5, 3.9] V*877</span></span>
<span class="line"><span>   button_onboard, // in {0,1}</span></span>
<span class="line"><span>   -acceleration_y, acceleration_x, -acceleration_z, // in g/4096</span></span>
<span class="line"><span>   -gyroscope_alpha, gyroscope_beta, -gyroscope_gamma, // in deg/ms/16384</span></span>
<span class="line"><span>   magnetometer_y, magnetometer_x, -magnetometer_z, // in gauss/0.886e-4</span></span>
<span class="line"><span>   ???</span></span>
<span class="line"><span>]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>/\${id}/quat ffff [w, x, y, z] // as [q0, q1, q2, q3]</span></span>
<span class="line"><span>/\${id}/euler fff [1, 2, 3]</span></span></code></pre></div>`,13)])])}const g=n(o,[["render",i]]);export{m as __pageData,g as default};
