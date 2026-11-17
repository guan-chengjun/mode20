/**
 * glbLoader.js —— 可选的外部 GLB 帆船模型加载器
 *
 * 工作方式：
 *  1. 尝试加载 MODEL_CONFIG.glbUrl（默认 public/models/sailboat.glb）；
 *  2. 成功则按模型网格名称中的关键字归入 10 个教学部件组，并统一缩放到目标船长；
 *  3. 文件不存在、网络失败或解析异常时返回 null，由上层自动回退到程序化模型。
 *
 * 模型下载地址与放置方法见 README.md「外部模型资源」章节。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_CONFIG, PART_IDS } from '../config.js';

// 部件识别关键字（小写包含匹配，兼容常见英文模型命名）
const PART_KEYWORDS = [
  { id: PART_IDS.HULL, keys: ['hull', 'boat', 'ship', 'deck', 'body', '船'] },
  { id: PART_IDS.MAIN_MAST, keys: ['mainmast', 'main_mast', 'main mast'] },
  { id: PART_IDS.FORE_MAST, keys: ['foremast', 'fore_mast', 'fore mast', 'frontmast'] },
  { id: PART_IDS.MAIN_SAIL, keys: ['mainsail', 'main_sail', 'main sail'] },
  { id: PART_IDS.FORE_SAIL, keys: ['foresail', 'jib', 'headsail', 'fore_sail'] },
  { id: PART_IDS.RUDDER, keys: ['rudder', 'tiller'] },
  { id: PART_IDS.KEEL, keys: ['keel', 'bulb'] },
  { id: PART_IDS.CENTERBOARD, keys: ['centerboard', 'daggerboard', 'centreboard'] },
  { id: PART_IDS.SHEETS, keys: ['sheet', 'rope', 'line', 'rigging', 'shroud', 'stay'] },
  { id: PART_IDS.BOOM, keys: ['boom', 'yard', 'spar'] }
];

function classify(name) {
  const n = (name || '').toLowerCase();
  // 桅杆关键字需要在通用 mast 之前优先精确匹配
  for (const { id, keys } of PART_KEYWORDS) {
    if (keys.some((k) => n.includes(k))) return id;
  }
  if (n.includes('mast')) return PART_IDS.MAIN_MAST; // 未区分前后时归入主桅
  if (n.includes('sail')) return PART_IDS.MAIN_SAIL;
  return PART_IDS.HULL; // 无法识别的网格归入船壳，保证仍可点击
}

/**
 * 尝试加载 GLB 并整理为教学部件结构
 * @returns {Promise<{root:THREE.Group, groups:object}|null>}
 */
export async function loadGlbSailboat() {
  if (!MODEL_CONFIG.useGlbIfAvailable) return null;

  const loader = new GLTFLoader();
  let gltf;
  try {
    gltf = await loader.loadAsync(MODEL_CONFIG.glbUrl);
  } catch (err) {
    console.info('[GLB] 未找到外部模型，使用程序化教学模型。', err.message);
    return null;
  }

  const source = gltf.scene;

  // 统一缩放到目标船长，保持与程序化模型尺寸一致
  source.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(source);
  const length = box.max.x - box.min.x || 1;
  const scale = MODEL_CONFIG.targetLength / length;
  source.scale.setScalar(scale);

  // 居中到底部原点
  const box2 = new THREE.Box3().setFromObject(source);
  const center = box2.getCenter(new THREE.Vector3());
  source.position.sub(center);

  // 按部件 ID 重新分组
  const root = new THREE.Group();
  const groups = {};
  for (const { id } of PART_KEYWORDS) {
    groups[id] = new THREE.Group();
    groups[id].userData.partId = id;
    root.add(groups[id]);
  }

  source.traverse((obj) => {
    if (obj.isMesh || obj.isLine) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      const partId = classify(obj.name);
      // 保证标准材质，透视/高亮克隆逻辑才能统一生效
      if (obj.material && !obj.material.isMeshStandardMaterial) {
        obj.material = new THREE.MeshStandardMaterial({
          color: obj.material.color || 0xcccccc,
          map: obj.material.map || null,
          roughness: 0.7,
          metalness: 0.05,
          side: THREE.DoubleSide
        });
      }
      groups[partId].add(obj);
    }
  });

  console.info('[GLB] 外部帆船模型加载成功，已按部件关键字分组。');
  return { root, groups };
}
