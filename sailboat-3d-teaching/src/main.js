/**
 * main.js —— 应用主入口
 * 串联：场景初始化 → 帆船建模（GLB 优先，失败回退程序化）→ 海面
 *       → 透视/拾取/风力模拟 → UI 事件 → 渲染循环
 */
import './style.css';
import * as THREE from 'three';
import { createScene } from './three/sceneSetup.js';
import { createOcean } from './three/ocean.js';
import { buildSailboat } from './three/geometry.js';
import { loadGlbSailboat } from './three/glbLoader.js';
import { XrayManager } from './three/xrayMode.js';
import { Picker } from './three/picker.js';
import { WindSimulation } from './three/windSimulation.js';
import { UI } from './ui/ui.js';
import { DEFAULT_WIND } from './config.js';

async function bootstrap() {
  const container = document.getElementById('scene-container');
  const { renderer, scene, camera, controls, dispose } = createScene(container);

  /* ---------------- 海面 ---------------- */
  const ocean = createOcean();
  scene.add(ocean.mesh);

  /* ---------------- 帆船：优先 GLB，失败回退程序化模型 ---------------- */
  let boat;
  let groups;
  let rigRefs = null;
  let floatGroup = null;

  const glb = await loadGlbSailboat();
  if (glb) {
    // GLB 路径：缺少帆枢轴引用，风力模拟仅作用于整体侧倾与波浪起伏
    boat = glb.root;
    groups = glb.groups;
    floatGroup = boat; // 直接以模型根作为起伏节点
    scene.add(boat);
  } else {
    // 程序化教学模型：10 个部件命名完整，帆角可联动
    const built = buildSailboat();
    boat = built.root;
    groups = built.groups;
    rigRefs = built.rigRefs;
    floatGroup = built.floatGroup;
    scene.add(boat);
  }
  boat.position.y = 0.4; // 让水线大致位于船壳中部

  /* ---------------- 透视与高亮管理 ---------------- */
  const xray = new XrayManager(groups);

  /* ---------------- 风力模拟 ---------------- */
  // GLB 模型无帆枢轴时构造空引用，模拟系统自动降级为只做侧倾/起伏
  const simRefs = rigRefs
    ? { root: boat, floatGroup, rigRefs }
    : {
        root: boat,
        floatGroup,
        rigRefs: {
          mainRig: new THREE.Group(),
          foreRig: new THREE.Group(),
          boomPivot: new THREE.Group(),
          mainSailMesh: null,
          foreSailMesh: null
        }
      };

  /* ---------------- UI 装配 ---------------- */
  const ui = new UI({
    onToggleXray: () => {
      const next = !xray.xrayOn;
      xray.setXray(next);
      ui.setXrayButton(next);
    },
    onToggleAutoRotate: () => {
      controls.autoRotate = !controls.autoRotate;
      ui.setAutoRotateButton(controls.autoRotate);
    },
    onToggleSimulation: () => {
      const next = !sim.running;
      sim.setRunning(next);
      ui.setSimButton(next);
    },
    onReset: () => {
      sim.reset();
      ui.setWind(DEFAULT_WIND);
      ui.setSimButton(sim.running);
      xray.setSelected(null);
      ui.setSelected(null);
      // 视角复位
      camera.position.set(11, 7, 13);
      controls.target.set(0, 1.6, 0);
      controls.update();
    },
    onWindChange: (patch) => sim.setWind(patch),
    onSelect: (partId) => {
      xray.setSelected(partId);
      ui.setSelected(partId);
    }
  });

  const sim = new WindSimulation(simRefs, (state) => ui.setSimReadout(state));
  ui.setSimButton(sim.running);

  /* ---------------- 鼠标拾取 ---------------- */
  new Picker(renderer, camera, boat, (partId) => {
    xray.setSelected(partId);
    ui.setSelected(partId);
  });

  /* ---------------- 渲染循环 ---------------- */
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05); // 钳制帧间隔，防止切后台后跳变

    sim.update(dt);
    ocean.update(sim.simTime); // 与模拟共用时间轴，暂停时海面同步静止
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  ui.hideLoading();

  // 便于开发调试
  window.__sailboatApp = { scene, camera, renderer, sim, xray, dispose };
}

bootstrap().catch((err) => {
  console.error(err);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = `初始化失败：${err.message}`;
});
