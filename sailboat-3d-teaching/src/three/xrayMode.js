/**
 * xrayMode.js —— 透视模式与部件高亮材质管理
 *
 * 两级视觉状态：
 *   全局模式：正常 / 透视（半透明，可观察船体内部与水下龙骨）
 *   部件状态：普通 / 高亮（选中讲解时）
 * 两种状态组合出 4 套材质，按需克隆并缓存，切换时直接替换 mesh.material。
 */
import * as THREE from 'three';

const HIGHLIGHT_COLOR = 0xffb020; // 高亮橙金色

export class XrayManager {
  /** @param {Record<string, THREE.Group>} groups partId -> 部件组 */
  constructor(groups) {
    this.groups = groups;
    this.xrayOn = false;
    this.selectedId = null;
    /** @type {{object:THREE.Object3D, partId:string, isLine:boolean, mats:object}[]} */
    this.entries = [];

    this._collect();
  }

  _collect() {
    for (const [partId, group] of Object.entries(this.groups)) {
      group.traverse((obj) => {
        if (obj.isMesh || obj.isLine) {
          const base = obj.material;
          const isLine = !!obj.isLine;
          this.entries.push({
            object: obj,
            partId,
            isLine,
            mats: this._buildMaterialSet(base, isLine)
          });
        }
      });
    }
  }

  /** 为单个对象预生成四种状态材质 */
  _buildMaterialSet(base, isLine) {
    if (isLine) {
      const xray = base.clone();
      xray.transparent = true;
      xray.opacity = 0.22;
      xray.depthWrite = false;

      const normalHL = base.clone();
      normalHL.color.set(HIGHLIGHT_COLOR);

      const xrayHL = xray.clone();
      xrayHL.opacity = 0.95;
      xrayHL.color.set(HIGHLIGHT_COLOR);

      return { normal: base, xray, normalHL, xrayHL };
    }

    // 网格：标准材质克隆，透视版关闭深度写入避免内部结构被遮挡
    const xray = base.clone();
    xray.transparent = true;
    xray.opacity = 0.22;
    xray.depthWrite = false;
    xray.needsUpdate = true;

    const normalHL = base.clone();
    normalHL.emissive = new THREE.Color(HIGHLIGHT_COLOR);
    normalHL.emissiveIntensity = 0.6;

    const xrayHL = xray.clone();
    xrayHL.opacity = 0.82;
    xrayHL.depthWrite = true;
    xrayHL.emissive = new THREE.Color(HIGHLIGHT_COLOR);
    xrayHL.emissiveIntensity = 0.7;

    return { normal: base, xray, normalHL, xrayHL };
  }

  /** 开关全局透视 */
  setXray(on) {
    this.xrayOn = on;
    this._apply();
  }

  /** 设置当前高亮部件（null 取消高亮） */
  setSelected(partId) {
    this.selectedId = partId;
    this._apply();
  }

  _apply() {
    for (const entry of this.entries) {
      const highlighted = entry.partId === this.selectedId;
      let key;
      if (this.xrayOn) key = highlighted ? 'xrayHL' : 'xray';
      else key = highlighted ? 'normalHL' : 'normal';
      entry.object.material = entry.mats[key];
    }
  }
}
