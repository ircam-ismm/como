import { LitElement, html, css } from 'lit';
import * as THREE from 'three';

class ComoSensor3d extends LitElement {
  #canvas = null;
  #ctx = null;
  #logicalWidth = 300;
  #logicalHeight = 200;
  #resizeObserver = null;
  #buffer = null;
  #rafId = null;
  // #frameIndex = 0;

  static properties = {
    pause: { type: Boolean }, // pause rendering but not buffering
    duration: { type: Number },
  };

  static styles = css`
    :host {
      display: inline-block;
      box-sizing: border-box;
      width: 300px;
      height: 200px;
      background-color: grey;
      /* margin-bottom: 60px; */
      outline: 1px solid grey;
    }
  `;

  constructor() {
    super();

    const width = 300;
    const height = 200;

    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 10);
    this.camera.position.z = 1;

    this.scene = new THREE.Scene();

    const geometry = new THREE.BoxGeometry(0.2, 0.6, 0.05);
    const material = new THREE.MeshNormalMaterial();

    this.mesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.mesh);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);

    this.originSet = false;
  }

  render() {
    return html`<div></div>`;
  }

  firstUpdated() {
    super.firstUpdated();

    const $div = this.shadowRoot.querySelector('div');
    $div.appendChild(this.renderer.domElement);
  }

  connectedCallback() {
    super.connectedCallback();
    this.source.onUpdate(updates => this.onUpdate(updates.data));
  }

  onUpdate(data) {
    const quaternion = new THREE.Quaternion(...data.absoluteOrientation.quaternion);

    if (!this.originSet) {
      this.camera.setRotationFromQuaternion(quaternion);
      this.originSet = true;
    }

    this.mesh.setRotationFromQuaternion(quaternion);
    this.renderer.render(this.scene, this.camera);
  }
}

if (customElements.get('como-sensor-3d') === undefined) {
  customElements.define('como-sensor-3d', ComoSensor3d);
}

