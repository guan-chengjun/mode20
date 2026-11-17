/**
 * ui.js —— UI 控制面板与讲解面板
 * 纯视图 + 事件转发层：所有 3D 逻辑通过构造函数注入的回调驱动。
 */
import { DEFAULT_WIND } from '../config.js';
import { PARTS_INFO } from '../data/partsInfo.js';

// 部件目录展示顺序（与教学讲解顺序一致）
const PART_ORDER = [
  'hull', 'mainMast', 'foreMast', 'mainSail', 'foreSail',
  'rudder', 'keel', 'centerboard', 'sheets', 'boom'
];

export class UI {
  /**
   * @param {object} cb 回调集合
   */
  constructor(cb) {
    this.cb = cb;
    this.selectedId = null;
    this._cacheDom();
    this._buildPartList();
    this._bindEvents();
    this.setWind(DEFAULT_WIND);
  }

  _cacheDom() {
    this.$ = (id) => document.getElementById(id);
    this.btnXray = this.$('btn-xray');
    this.btnAuto = this.$('btn-auto-rotate');
    this.btnSim = this.$('btn-sim');
    this.btnReset = this.$('btn-reset');
    this.dirSlider = this.$('wind-dir');
    this.speedSlider = this.$('wind-speed');
    this.dirValue = this.$('wind-dir-value');
    this.speedValue = this.$('wind-speed-value');
    this.windArrow = this.$('wind-arrow');
    this.pointOfSail = this.$('point-of-sail');
    this.trimReadout = this.$('main-trim');
    this.heelReadout = this.$('heel-angle');
    this.partList = this.$('part-list');
    this.infoCard = this.$('info-card');
    this.infoPlaceholder = this.$('info-placeholder');
  }

  /** 生成部件目录列表 */
  _buildPartList() {
    for (const id of PART_ORDER) {
      const info = PARTS_INFO[id];
      const li = document.createElement('li');
      li.dataset.partId = id;
      li.innerHTML = `${info.name}<span class="en-name">${info.en}</span>`;
      li.addEventListener('click', () => this.cb.onSelect(id));
      this.partList.appendChild(li);
    }
  }

  _bindEvents() {
    // 透视模式
    this.btnXray.addEventListener('click', () => this.cb.onToggleXray());
    // 自动环绕
    this.btnAuto.addEventListener('click', () => this.cb.onToggleAutoRotate());
    // 模拟启停
    this.btnSim.addEventListener('click', () => this.cb.onToggleSimulation());
    // 重置
    this.btnReset.addEventListener('click', () => this.cb.onReset());

    // 风向滑块
    this.dirSlider.addEventListener('input', () => {
      const direction = Number(this.dirSlider.value);
      this.setWind({ direction });
      this.cb.onWindChange({ direction });
    });
    // 风速滑块
    this.speedSlider.addEventListener('input', () => {
      const speed = Number(this.speedSlider.value);
      this.setWind({ speed });
      this.cb.onWindChange({ speed });
    });

    // 关闭讲解卡片
    this.$('info-close').addEventListener('click', () => this.cb.onSelect(null));
  }

  /* ---------------- 外部状态同步 ---------------- */
  setWind(wind) {
    if (wind.direction !== undefined) {
      this.dirSlider.value = wind.direction;
      this.dirValue.textContent = `${Math.round(wind.direction)}°`;
      // 箭头默认指向船头(向上=0°)，风向增加表示风源顺时针旋转
      this.windArrow.style.transform = `rotate(${wind.direction}deg)`;
    }
    if (wind.speed !== undefined) {
      this.speedSlider.value = wind.speed;
      this.speedValue.textContent = `${wind.speed} m/s`;
    }
  }

  setXrayButton(on) {
    this.btnXray.textContent = `透视模式：${on ? '开' : '关'}`;
    this.btnXray.classList.toggle('active', on);
  }

  setAutoRotateButton(on) {
    this.btnAuto.textContent = `自动环绕：${on ? '开' : '关'}`;
    this.btnAuto.classList.toggle('active', on);
  }

  setSimButton(running) {
    this.btnSim.textContent = running ? '模拟：运行中' : '模拟：已暂停';
    this.btnSim.classList.toggle('active', running);
  }

  /** 模拟系统回传的实时读数 */
  setSimReadout({ pointOfSail, trimDeg, heelDeg }) {
    this.pointOfSail.textContent = pointOfSail;
    this.trimReadout.textContent = `${trimDeg}°`;
    this.heelReadout.textContent = `${heelDeg}°`;
  }

  /** 选中部件：同步目录高亮 + 讲解卡片 */
  setSelected(partId) {
    this.selectedId = partId;

    for (const li of this.partList.children) {
      li.classList.toggle('selected', li.dataset.partId === partId);
    }

    if (!partId) {
      this.infoCard.hidden = true;
      this.infoPlaceholder.hidden = false;
      return;
    }
    const info = PARTS_INFO[partId];
    this.$('info-name').textContent = info.name;
    this.$('info-en').textContent = info.en;
    this.$('info-role').textContent = info.role;
    this.$('info-principle').textContent = info.principle;
    this.$('info-tip').textContent = info.tip;
    this.infoPlaceholder.hidden = true;
    this.infoCard.hidden = false;
  }

  hideLoading() {
    this.$('loading').classList.add('hidden');
  }
}
