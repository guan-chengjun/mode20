/**
 * sceneSetup.js —— 渲染器 / 相机 / 光照 / 控制器 / 天空背景
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * @param {HTMLElement} container 画布挂载容器
 * @returns 场景、相机、渲染器、控制器与销毁函数
 */
export function createScene(container) {
  /* ---------- 渲染器 ---------- */
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和阴影
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // 电影级色调映射，观感写实
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  /* ---------- 场景与渐变天空背景 ---------- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xb8d4e8, 60, 190); // 远处雾化，增加空间纵深感
  scene.background = makeSkyGradient();

  /* ---------- 相机：略俯视的三分之四视角 ---------- */
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  camera.position.set(11, 7, 13);

  /* ---------- 轨道控制器 ---------- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.6, 0); // 聚焦船体中上部
  controls.enableDamping = true; // 阻尼，旋转更顺滑
  controls.dampingFactor = 0.06;
  controls.minDistance = 4;
  controls.maxDistance = 60;
  controls.maxPolarAngle = Math.PI * 0.52; // 禁止钻到海面以下
  controls.autoRotateSpeed = 1.2;

  /* ---------- 光照：环境光 + 半球光 + 带阴影的方向光 ---------- */
  const ambient = new THREE.AmbientLight(0xffffff, 0.32);
  scene.add(ambient);

  // 半球光：天空蓝 / 海水反光色，模拟环境漫反射
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x2a5f7a, 0.55);
  scene.add(hemi);

  // 主方向光：模拟太阳，开启阴影
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.1);
  sun.position.set(14, 20, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -16;
  sun.shadow.camera.right = 16;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.bias = -0.0004; // 缓解阴影粉刺
  scene.add(sun);
  scene.add(sun.target);

  /* ---------- 窗口自适应 ---------- */
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  function dispose() {
    window.removeEventListener('resize', onResize);
    controls.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  }

  return { renderer, scene, camera, controls, sun, dispose };
}

/** 生成竖直渐变天空纹理（Canvas 实现，无需外部贴图） */
function makeSkyGradient() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3f7fc4'); // 天顶深蓝
  grad.addColorStop(0.55, '#8fc3ec');
  grad.addColorStop(1, '#dceefb'); // 地平线浅蓝
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
