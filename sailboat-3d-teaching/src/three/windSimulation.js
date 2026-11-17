/**
 * windSimulation.js —— 帆船运转模拟系统
 *
 * 航海原理简化模型（教学用途，非工程级 CFD）：
 *  1. 风向 = 风"吹来"的方向，0° 为船头，90° 为右舷，180° 为船尾；
 *  2. 风与船头夹角 α < 38° 进入"迎风禁区"，帆翼无法形成升力 → 飘帆抖动（luff）；
 *  3. 正常区间帆角（trim）随风角从 0° 平滑增大到约 90°（顺风时帆横张）；
 *  4. 侧倾角 ∝ 风速 × 帆效系数，方向为背风一侧（下风舷）；
 *  5. 波浪起伏由 ocean.waveHeightAt 采样，并通过波面坡度估算纵横摇。
 */
import * as THREE from 'three';
import { DEFAULT_WIND, SIM_CONFIG } from '../config.js';
import { waveHeightAt } from './ocean.js';
import { POINTS_OF_SAIL } from '../data/partsInfo.js';

const DEG = Math.PI / 180;

export class WindSimulation {
  /**
   * @param {object} refs geometry.buildSailboat() 的返回引用
   * @param {(state:object)=>void} onState 状态回调，用于刷新 UI 读数
   */
  constructor(refs, onState) {
    this.refs = refs;
    this.onState = onState;

    this.wind = { ...DEFAULT_WIND };
    this.running = true;
    this.simTime = 0;

    // 平滑后的实际状态（目标值 → 当前值插值，避免突变）
    this.currentHeel = 0; // 当前侧倾角（弧度）
    this.currentTrim = 0; // 当前主帆转角（弧度）
    this.flutterPhase = 0; // 飘帆抖动相位

    // 船底采样点（局部坐标原点附近）
    this.sampleX = 0;
    this.sampleZ = 0;
  }

  /* ---------------- 外部控制 ---------------- */
  setWind(patch) {
    Object.assign(this.wind, patch);
  }

  setRunning(running) {
    this.running = running;
  }

  /** 重置到初始状态 */
  reset() {
    this.wind = { ...DEFAULT_WIND };
    this.simTime = 0;
    this.currentHeel = 0;
    this.currentTrim = 0;
    this.flutterPhase = 0;

    const { root, floatGroup, rigRefs } = this.refs;
    root.rotation.set(0, 0, 0);
    floatGroup.position.set(0, 0, 0);
    floatGroup.rotation.set(0, 0, 0);
    rigRefs.mainRig.rotation.set(0, 0, 0);
    rigRefs.foreRig.rotation.set(0, 0, 0);
    rigRefs.boomPivot.rotation.set(0, 0, 0);
    this._emitState(0, 0, 0);
  }

  /* ---------------- 航海学计算 ---------------- */
  /** 风向与船头中心线的夹角（0~180°），以及风来自哪一舷（+1 右舷 / -1 左舷） */
  _windAngle() {
    const theta = this.wind.direction * DEG;
    const alpha = Math.acos(THREE.MathUtils.clamp(Math.cos(theta), -1, 1)) / DEG; // 0~180
    const side = Math.sin(theta) >= 0 ? 1 : -1;
    return { alpha, side, theta };
  }

  /** 帆效系数：不同航行状态下把风能转化为推进/侧倾力的效率 */
  _efficiency(alpha) {
    if (alpha < SIM_CONFIG.luffZoneDeg) return 0.12; // 飘帆区，几乎无效
    if (alpha < 80) return 0.85; // 迎风
    if (alpha < 100) return 1.0; // 横风，效率最高
    if (alpha < 150) return 0.9; // 侧顺风
    return 0.7; // 正顺风：纯推力、升力占比下降
  }

  /** 航行状态文案 */
  _pointOfSailLabel(alpha) {
    const list = POINTS_OF_SAIL;
    return (list.find((p) => alpha <= p.maxAngle) || list[list.length - 1]).label;
  }

  /* ---------------- 每帧驱动 ---------------- */
  update(dt) {
    if (!this.running) return; // 暂停时冻结全部模拟量
    this.simTime += dt * SIM_CONFIG.waveSpeed;

    const { alpha, side } = this._windAngle();
    const eff = this._efficiency(alpha);
    const isLuff = alpha < SIM_CONFIG.luffZoneDeg || this.wind.speed < 1;

    /* —— 帆角目标值 —— */
    let targetTrim = 0;
    if (!isLuff) {
      // 风角 38°→帆角 0°；风角 180°→帆角约 90°
      const span = 180 - SIM_CONFIG.luffZoneDeg;
      targetTrim = ((alpha - SIM_CONFIG.luffZoneDeg) / span) * (90 * DEG);
    }
    // 帆被吹向背风侧：风来自右舷(side=+1)时帆向左舷(-Z)摆，对应负 Y 旋转
    const signedTrim = -side * targetTrim;

    // 飘帆抖动：高频小幅振荡叠加在帆角上
    this.flutterPhase += dt * 14;
    const jitter = isLuff ? Math.sin(this.flutterPhase) * 0.12 + Math.sin(this.flutterPhase * 2.7) * 0.05 : 0;

    this.currentTrim = THREE.MathUtils.lerp(this.currentTrim, signedTrim, Math.min(1, dt * 3));
    const appliedTrim = this.currentTrim + jitter;
    this.refs.rigRefs.mainRig.rotation.y = appliedTrim;
    this.refs.rigRefs.foreRig.rotation.y = appliedTrim * 0.92; // 前帆转角略小
    this.refs.rigRefs.boomPivot.rotation.y = appliedTrim; // 帆桁与主帆同步

    /* —— 船体侧倾目标值（绕 X 轴，背风侧向下）—— */
    const targetHeel =
      -side * (this.wind.speed / 30) * SIM_CONFIG.maxHeelDeg * DEG * eff;
    this.currentHeel = THREE.MathUtils.lerp(this.currentHeel, targetHeel, Math.min(1, dt * 2.2));
    this.refs.root.rotation.x = this.currentHeel;

    /* —— 波浪起伏：采样波面高度 —— */
    const t = this.simTime;
    const h = waveHeightAt(this.sampleX, this.sampleZ, t);
    this.refs.floatGroup.position.y = h - 0.15; // 略压入水中，避免船底悬空

    // 有限差分求波面坡度 → 纵摇(pitch，绕Z) 与 横摇(roll，绕X 的小量叠加)
    const d = 0.8;
    const slopeX = (waveHeightAt(this.sampleX + d, this.sampleZ, t) - waveHeightAt(this.sampleX - d, this.sampleZ, t)) / (2 * d);
    const slopeZ = (waveHeightAt(this.sampleX, this.sampleZ + d, t) - waveHeightAt(this.sampleX, this.sampleZ - d, t)) / (2 * d);
    this.refs.floatGroup.rotation.z = THREE.MathUtils.lerp(
      this.refs.floatGroup.rotation.z,
      -slopeX * 0.35,
      Math.min(1, dt * 2)
    );
    // 波浪横摇与风力侧倾叠加在不同层级（floatGroup 在上、root 在外），互不覆盖
    this.refs.floatGroup.rotation.x = THREE.MathUtils.lerp(
      this.refs.floatGroup.rotation.x,
      -slopeZ * 0.25,
      Math.min(1, dt * 2)
    );

    this._emitState(alpha, appliedTrim / DEG, this.currentHeel / DEG);
  }

  /** 推送 UI 读数 */
  _emitState(alpha, trimDeg, heelDeg) {
    this.onState?.({
      pointOfSail: this._pointOfSailLabel(alpha || this._windAngle().alpha),
      trimDeg: Math.abs(trimDeg).toFixed(1),
      heelDeg: Math.abs(heelDeg).toFixed(1)
    });
  }
}
