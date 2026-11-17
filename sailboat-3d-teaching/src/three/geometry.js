/**
 * geometry.js —— 程序化帆船建模模块
 *
 * 设计目标（教学优先）：
 *  1. 10 个教学部件各自独立成组，并在 group.userData.partId 上登记部件 ID；
 *  2. 所有 Mesh 开启阴影，材质统一由 SailboatApp 管理（透视/高亮切换）；
 *  3. 帆使用带"帆腹弧度（camber）"的参数化网格，模拟翼型帆面；
 *  4. 返回 rigRefs 供风力模拟系统驱动帆角与飘帆抖动。
 *
 * 坐标系：+X 船头，+Y 向上，+Z 右舷。
 */
import * as THREE from 'three';
import { PART_IDS } from '../config.js';

/* ---------------- 材质工厂 ---------------- */
function std(color, roughness = 0.65, metalness = 0.05, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

// 全船材质集中定义，便于透视模式统一处理
export function buildMaterials() {
  return {
    hull: std(0x7a3b2e, 0.6), // 红木色船壳
    deck: std(0xd9c7a7, 0.8), // 木色甲板
    mast: std(0x6b4a2f, 0.75), // 桅杆木材
    sail: std(0xf5f0e0, 0.9, 0.0, { side: THREE.DoubleSide }), // 帆布（双面）
    underWater: std(0x2f4858, 0.55, 0.15), // 龙骨/舵：深蓝灰
    board: std(0x4a6b7d, 0.55, 0.15), // 稳向板
    cockpit: std(0x3a2a1e, 0.85), // 座舱
    line: new THREE.LineBasicMaterial({ color: 0x1c1c1c }) // 索具线
  };
}

/* ---------------- 通用工具 ---------------- */
// 开启网格阴影并挂到父组
function put(mesh, parent) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// 新建部件组并登记 partId
function partGroup(partId) {
  const g = new THREE.Group();
  g.userData.partId = partId;
  return g;
}

// 用一组线段端点构建索具 LineSegments
function buildRigging(segmentPairs, material) {
  const positions = [];
  for (const [a, b] of segmentPairs) {
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geo, material);
  lines.userData.isLine = true; // 供透视模式识别
  return lines;
}

/**
 * 参数化三角/四边形帆面网格
 * @param {number} cols 横向分段
 * @param {number} rows 竖向分段
 * @param {(u:number,v:number)=>{x,y,z}} pointFn 局部坐标函数：u 沿帆底方向，v 沿桅杆向上
 */
function buildSailGeometry(cols, rows, pointFn) {
  const positions = [];
  const indices = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    for (let i = 0; i <= cols; i++) {
      const u = i / cols;
      const p = pointFn(u, v);
      positions.push(p.x, p.y, p.z);
    }
  }
  // 四边形索引
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals(); // 自动计算法线，保证光照正确
  return geo;
}

/* ===================================================================
 * 主入口：构建整艘帆船
 * @returns {root, floatGroup, groups, rigRefs}
 *   root        —— 最外层组（施加侧倾角）
 *   floatGroup  —— 波浪起伏组（施加升沉/纵横摇）
 *   groups      —— partId -> 部件组 的注册表
 *   rigRefs     —— 帆组与帆面网格引用，供风力模拟驱动
 * =================================================================== */
export function buildSailboat() {
  const mats = buildMaterials();

  const root = new THREE.Group();
  const floatGroup = new THREE.Group();
  root.add(floatGroup);

  /** @type {Record<string, THREE.Group>} 部件注册表 */
  const groups = {};
  const register = (id, group) => {
    groups[id] = group;
    floatGroup.add(group);
    return group;
  };

  /* ---------------- 1. 船壳 Hull ---------------- */
  const hullGroup = partGroup(PART_IDS.HULL);
  // 船壳侧剖面（X=船长方向，Y=高度），挤出后形成带船宽的立体船体
  const hullProfile = new THREE.Shape();
  hullProfile.moveTo(-4.4, 0.25);
  hullProfile.lineTo(-3.5, -0.15);
  hullProfile.lineTo(-1.5, -0.55);
  hullProfile.lineTo(1.8, -0.55);
  hullProfile.lineTo(3.6, -0.25);
  hullProfile.lineTo(4.5, 0.35); // 船首上翘
  hullProfile.lineTo(4.35, 0.95);
  hullProfile.lineTo(3.4, 1.05);
  hullProfile.lineTo(-3.6, 1.0);
  hullProfile.lineTo(-4.4, 0.85);
  hullProfile.closePath();

  const hullGeo = new THREE.ExtrudeGeometry(hullProfile, {
    depth: 2.2, // 船宽方向挤出长度
    bevelEnabled: true,
    bevelThickness: 0.28,
    bevelSize: 0.28,
    bevelSegments: 3,
    curveSegments: 8
  });
  hullGeo.translate(0, 0, -1.1); // 挤出沿 Z 轴，居中
  put(new THREE.Mesh(hullGeo, mats.hull), hullGroup);

  // 甲板（俯视轮廓薄片，旋转到 XZ 平面）
  const deckShape = new THREE.Shape();
  deckShape.moveTo(-4.0, 0);
  deckShape.lineTo(-3.6, 0.9);
  deckShape.lineTo(-2.0, 1.12);
  deckShape.lineTo(1.5, 1.05);
  deckShape.lineTo(3.4, 0.7);
  deckShape.lineTo(4.2, 0);
  deckShape.lineTo(3.4, -0.7);
  deckShape.lineTo(1.5, -1.05);
  deckShape.lineTo(-2.0, -1.12);
  deckShape.lineTo(-3.6, -0.9);
  deckShape.closePath();
  const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2
  });
  deckGeo.rotateX(-Math.PI / 2); // 形状平面 XY 旋转到世界 XZ
  const deck = put(new THREE.Mesh(deckGeo, mats.deck), hullGroup);
  deck.position.y = 1.02;

  // 座舱（船尾凹陷结构）
  const cockpit = put(
    new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 1.35), mats.cockpit),
    hullGroup
  );
  cockpit.position.set(-3.2, 0.95, 0);
  register(PART_IDS.HULL, hullGroup);

  /* ---------------- 2 & 3. 主桅杆 / 前桅杆 ---------------- */
  // 主桅杆：船中偏后，更高
  const mainMastGroup = partGroup(PART_IDS.MAIN_MAST);
  const mainMast = put(
    new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 6.4, 16), mats.mast),
    mainMastGroup
  );
  mainMast.position.set(-0.6, 4.15, 0); // 底部约在甲板 y=0.95
  // 主桅静索：前支索、后支索、左右侧支索（三角形稳性结构）
  mainMastGroup.add(
    buildRigging(
      [
        [new THREE.Vector3(-0.6, 7.3, 0), new THREE.Vector3(4.1, 1.1, 0)],
        [new THREE.Vector3(-0.6, 7.3, 0), new THREE.Vector3(-4.1, 1.0, 0)],
        [new THREE.Vector3(-0.6, 7.0, 0), new THREE.Vector3(-0.9, 1.05, 1.05)],
        [new THREE.Vector3(-0.6, 7.0, 0), new THREE.Vector3(-0.9, 1.05, -1.05)]
      ],
      mats.line
    )
  );
  register(PART_IDS.MAIN_MAST, mainMastGroup);

  // 前桅杆：船中偏前，略矮
  const foreMastGroup = partGroup(PART_IDS.FORE_MAST);
  const foreMast = put(
    new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.085, 4.8, 14), mats.mast),
    foreMastGroup
  );
  foreMast.position.set(2.0, 3.3, 0);
  foreMastGroup.add(
    buildRigging(
      [
        [new THREE.Vector3(2.0, 5.65, 0), new THREE.Vector3(4.25, 1.1, 0)],
        [new THREE.Vector3(2.0, 5.4, 0), new THREE.Vector3(1.7, 1.05, 1.0)],
        [new THREE.Vector3(2.0, 5.4, 0), new THREE.Vector3(1.7, 1.05, -1.0)]
      ],
      mats.line
    )
  );
  register(PART_IDS.FORE_MAST, foreMastGroup);

  /* ---------------- 4. 主帆 Mainsail（绕主桅转动的帆组） ---------------- */
  const mainRig = partGroup(PART_IDS.MAIN_SAIL);
  mainRig.position.set(-0.6, 1.35, 0); // 枢轴点 = 主桅与帆桁交点
  const SAIL_MAIN_H = 4.7; // 主帆高（沿桅）
  const SAIL_MAIN_C = 2.45; // 主帆底边长（沿帆桁，向船尾 -X）
  // 帆面随高度收窄，并加入正弦帆腹（camber）模拟翼型弧度
  const mainSailGeo = buildSailGeometry(20, 16, (u, v) => {
    const chord = SAIL_MAIN_C * (1 - 0.55 * v); // 越高越窄
    return {
      x: -u * chord,
      y: v * SAIL_MAIN_H,
      z: 0.3 * Math.sin(Math.PI * u) * (1 - 0.3 * v)
    };
  });
  const mainSailMesh = put(new THREE.Mesh(mainSailGeo, mats.sail), mainRig);
  register(PART_IDS.MAIN_SAIL, mainRig);

  /* ---------------- 帆桁 Boom（铰接在主桅上，随主帆一起转动） ---------------- */
  const boomGroup = partGroup(PART_IDS.BOOM);
  boomGroup.position.set(-0.6, 1.35, 0);
  const boom = put(
    new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, SAIL_MAIN_C, 12), mats.mast),
    boomGroup
  );
  boom.rotation.z = Math.PI / 2; // 圆柱默认沿 Y，转到沿 X
  boom.position.x = -SAIL_MAIN_C / 2;
  register(PART_IDS.BOOM, boomGroup);

  /* ---------------- 5. 前帆 Jib（绕前桅转动的帆组） ---------------- */
  const foreRig = partGroup(PART_IDS.FORE_SAIL);
  foreRig.position.set(2.0, 1.3, 0); // 枢轴点 = 前桅甲板交点
  // 三角形三个顶点（局部坐标）：head 帆顶 / tack 前下角（船首）/ clew 后下角
  const head = { x: 0.15, y: 3.6 };
  const tack = { x: 2.35, y: 0.0 };
  const clew = { x: -0.75, y: 0.15 };
  const foreSailGeo = buildSailGeometry(16, 14, (u, v) => {
    // v 高度方向：在 tack→head 与 clew→head 两条边之间插值
    const lx = tack.x + (head.x - tack.x) * v;
    const ly = tack.y + (head.y - tack.y) * v;
    const rx = clew.x + (head.x - clew.x) * v;
    const ry = clew.y + (head.y - clew.y) * v;
    return {
      x: lx + (rx - lx) * u,
      y: ly + (ry - ly) * u,
      z: 0.24 * Math.sin(Math.PI * u) * (1 - 0.4 * v)
    };
  });
  const foreSailMesh = put(new THREE.Mesh(foreSailGeo, mats.sail), foreRig);
  register(PART_IDS.FORE_SAIL, foreRig);

  /* ---------------- 6. 舵 Rudder（船尾水线以下 + 舵柄） ---------------- */
  const rudderGroup = partGroup(PART_IDS.RUDDER);
  const rudderFin = put(
    new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.75), mats.underWater),
    rudderGroup
  );
  rudderFin.position.set(-4.3, -0.25, 0);
  const tiller = put(
    new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 10), mats.mast),
    rudderGroup
  );
  tiller.rotation.z = Math.PI / 2;
  tiller.position.set(-3.75, 0.85, 0); // 舵柄伸入座舱
  register(PART_IDS.RUDDER, rudderGroup);

  /* ---------------- 7. 龙骨 Keel（固定重型鳍，船底中线） ---------------- */
  const keelGroup = partGroup(PART_IDS.KEEL);
  const keel = put(
    new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.35, 0.16), mats.underWater),
    keelGroup
  );
  keel.position.set(-0.3, -1.12, 0);
  // 龙骨底部压载物（铅陀）：加粗的下端
  const bulb = put(
    new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mats.underWater),
    keelGroup
  );
  bulb.scale.set(3.4, 0.7, 0.5);
  bulb.position.set(-0.3, -1.78, 0);
  register(PART_IDS.KEEL, keelGroup);

  /* ---------------- 8. 稳向板 Centerboard（可收放板 + 板箱） ---------------- */
  const cbGroup = partGroup(PART_IDS.CENTERBOARD);
  const board = put(
    new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.05, 0.09), mats.board),
    cbGroup
  );
  board.position.set(1.55, -0.95, 0);
  // 水线以上的稳向板箱（收板机构外壳，教学上帮助识别该部件）
  const trunk = put(
    new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.28), mats.board),
    cbGroup
  );
  trunk.position.set(1.55, -0.18, 0);
  register(PART_IDS.CENTERBOARD, cbGroup);

  /* ---------------- 9. 缭绳 Sheets / 动索 ---------------- */
  // 主帆缭绳做在主帆枢轴组内，随帆角一起转动；前帆缭绳做在前帆枢轴组内
  const mainSheetGroup = partGroup(PART_IDS.SHEETS);
  mainSheetGroup.position.copy(mainRig.position);
  mainSheetGroup.add(
    buildRigging(
      [
        // 帆桁尾端 → 座舱两侧缭绳导向点
        [new THREE.Vector3(-SAIL_MAIN_C, 0, 0), new THREE.Vector3(-2.75, -0.45, 0.55)],
        [new THREE.Vector3(-SAIL_MAIN_C, 0, 0), new THREE.Vector3(-2.75, -0.45, -0.55)]
      ],
      mats.line
    )
  );
  register(PART_IDS.SHEETS, mainSheetGroup);
  // 重新挂到主帆枢轴组下，使缭绳随帆角联动；挂到枢轴下后局部坐标归零
  mainRig.add(mainSheetGroup);
  mainSheetGroup.position.set(0, 0, 0);

  // 前帆缭绳单独再挂一组（同样登记为 sheets，点击任一缭绳均高亮该部件）
  const jibSheetGroup = partGroup(PART_IDS.SHEETS);
  jibSheetGroup.position.copy(foreRig.position);
  jibSheetGroup.add(
    buildRigging(
      [
        [new THREE.Vector3(clew.x, clew.y, 0), new THREE.Vector3(-1.45, -0.25, 0.95)],
        [new THREE.Vector3(clew.x, clew.y, 0), new THREE.Vector3(-1.45, -0.25, -0.95)]
      ],
      mats.line
    )
  );
  register(PART_IDS.SHEETS, jibSheetGroup);
  foreRig.add(jibSheetGroup);
  jibSheetGroup.position.set(0, 0, 0);

  /* ---------------- 返回引用 ---------------- */
  return {
    root,
    floatGroup,
    groups,
    rigRefs: {
      mainRig,
      foreRig,
      mainSailMesh,
      foreSailMesh,
      boomPivot: boomGroup
    },
    materials: mats
  };
}
