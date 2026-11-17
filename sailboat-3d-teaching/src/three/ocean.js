/**
 * ocean.js —— 程序化波浪海面
 * 使用多方向正弦波叠加（Gerstner 波的简化线性版本），
 * 每帧在 CPU 端更新顶点高度，并同步提供 waveHeightAt() 供船身起伏采样，
 * 保证船底始终"骑"在波浪上。
 */
import * as THREE from 'three';
import { SIM_CONFIG } from '../config.js';

// 波谱定义：振幅、波长、传播方向、速度（教学用简化三波叠加）
const WAVES = [
  { amp: 0.55, wavelength: 11, dir: new THREE.Vector2(1, 0.25).normalize(), speed: 1.6 },
  { amp: 0.28, wavelength: 6.5, dir: new THREE.Vector2(0.6, 1).normalize(), speed: 2.2 },
  { amp: 0.16, wavelength: 3.2, dir: new THREE.Vector2(-0.4, 1).normalize(), speed: 3.0 }
];

/**
 * 计算指定水平位置、指定时刻的波面高度
 * @param {number} x 世界 X
 * @param {number} z 世界 Z
 * @param {number} t 模拟时间（秒）
 */
export function waveHeightAt(x, z, t) {
  let h = 0;
  for (const w of WAVES) {
    const k = (2 * Math.PI) / w.wavelength; // 波数
    const phase = k * (w.dir.x * x + w.dir.y * z) - w.speed * t;
    h += w.amp * Math.sin(phase);
  }
  return h * SIM_CONFIG.waveHeight * 1.6;
}

/**
 * 创建海面网格
 * @returns {{mesh: THREE.Mesh, update: (t:number)=>void}}
 */
export function createOcean() {
  const size = 220;
  const segments = 120; // 121×121 顶点，兼顾平滑度与性能
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2); // 平面转到 XZ 水平面

  const material = new THREE.MeshStandardMaterial({
    color: 0x1d6f8e,
    roughness: 0.28,
    metalness: 0.18,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'ocean';

  const posAttr = geo.attributes.position;
  const tmp = new THREE.Vector3();

  // 每帧重写顶点 Y 并更新法线
  function update(t) {
    for (let i = 0; i < posAttr.count; i++) {
      tmp.fromBufferAttribute(posAttr, i);
      posAttr.setY(i, waveHeightAt(tmp.x, tmp.z, t));
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals(); // 法线随波形变化，高光才会流动
  }

  return { mesh, update };
}
