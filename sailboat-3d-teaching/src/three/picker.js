/**
 * picker.js —— 鼠标射线拾取模块
 * 职责：
 *  1. 区分"点击"与"拖拽旋转视角"（按下后移动超过阈值则不触发选择）；
 *  2. 射线与场景求交，沿父级链查找 userData.partId；
 *  3. 悬停在可拾取部件上时切换鼠标指针。
 */
import * as THREE from 'three';

const DRAG_THRESHOLD = 6 // 像素

export class Picker {
  /**
   * @param {THREE.WebGLRenderer} renderer
   * @param {THREE.Camera} camera
   * @param {THREE.Object3D} pickRoot 仅在该根节点下求交（排除海面等）
   * @param {(partId:string|null)=>void} onPick
   */
  constructor(renderer, camera, pickRoot, onPick) {
    this.camera = camera;
    this.pickRoot = pickRoot;
    this.onPick = onPick;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line.threshold = 0.25; // 让细缭绳也能被点中
    this.pointer = new THREE.Vector2();
    this.dom = renderer.domElement;

    this._downPos = null;

    this.dom.addEventListener('pointerdown', this._onDown.bind(this));
    this.dom.addEventListener('pointerup', this._onUp.bind(this));
    this.dom.addEventListener('pointermove', this._onMove.bind(this));
  }

  _setNDC(event) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /** 沿父级链找到最近的部件 ID */
  _resolvePartId(object) {
    let node = object;
    while (node && node !== this.pickRoot.parent) {
      if (node.userData && node.userData.partId) return node.userData.partId;
      node = node.parent;
    }
    return null;
  }

  _intersect(event) {
    this._setNDC(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.pickRoot, true);
    for (const hit of hits) {
      const partId = this._resolvePartId(hit.object);
      if (partId) return partId;
    }
    return null;
  }

  _onDown(event) {
    this._downPos = { x: event.clientX, y: event.clientY };
  }

  _onUp(event) {
    if (!this._downPos) return;
    const moved = Math.hypot(event.clientX - this._downPos.x, event.clientY - this._downPos.y);
    this._downPos = null;
    if (moved > DRAG_THRESHOLD) return; // 视为拖拽视角，不触发选择
    this.onPick(this._intersect(event));
  }

  _onMove(event) {
    // 按住拖拽时不改变光标逻辑
    if (event.buttons !== 0) return;
    const partId = this._intersect(event);
    this.dom.style.cursor = partId ? 'pointer' : 'grab';
  }
}
