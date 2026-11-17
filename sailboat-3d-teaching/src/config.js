/**
 * 全局配置常量
 * 坐标系约定（教学项目统一约定）：
 *   +X 方向 = 船头（船首）方向
 *   -X 方向 = 船尾
 *   +Y 方向 = 垂直向上
 *   +Z 方向 = 右舷（starboard）
 */

// 默认风参数
export const DEFAULT_WIND = {
  speed: 12, // 风速，单位 m/s
  direction: 90 // 风向（度）：风吹"来"的方向，0°=从船头吹来，90°=从右舷吹来（横风），180°=从船尾吹来
};

// 模拟相关参数
export const SIM_CONFIG = {
  maxHeelDeg: 28, // 最大侧倾角（度），真实帆船通常在 15°~30° 之间
  luffZoneDeg: 38, // 迎风禁区半角：风向与船头夹角小于该值时帆无法吃风（飘帆）
  waveHeight: 0.35, // 波浪振幅（米）
  waveSpeed: 1.1 // 波浪时间流速系数
};

// 可选 GLB 模型路径与程序化模型回退开关
// 若该文件不存在或加载失败，系统自动使用程序化生成的教学帆船（部件命名完整，拾取更可靠）
export const MODEL_CONFIG = {
  glbUrl: './models/sailboat.glb',
  useGlbIfAvailable: true,
  targetLength: 9 // GLB 模型统一缩放到的船长（米），与程序化模型保持一致
};

// 部件 ID 枚举（与 partsInfo.js 的 key 一一对应）
export const PART_IDS = {
  HULL: 'hull',
  MAIN_MAST: 'mainMast',
  FORE_MAST: 'foreMast',
  MAIN_SAIL: 'mainSail',
  FORE_SAIL: 'foreSail',
  RUDDER: 'rudder',
  KEEL: 'keel',
  CENTERBOARD: 'centerboard',
  SHEETS: 'sheets',
  BOOM: 'boom'
};
