import type { HistoricalEvent } from '../types';
import { loadJson } from '../utils/geo';

export type YearChangeHandler = (year: number) => void;

/**
 * TimelineManager — 时间轴管理器
 * 负责 184–280 年时间轴 UI、事件刻度渲染、年份切换回调
 */
export class TimelineManager {
  private slider: HTMLInputElement;
  private yearDisplay: HTMLElement;
  private marksContainer: HTMLElement;
  private events: HistoricalEvent[] = [];
  private onYearChange: YearChangeHandler;
  private minYear = 184;
  private maxYear = 280;

  constructor(onYearChange: YearChangeHandler) {
    this.onYearChange = onYearChange;
    this.slider = document.getElementById('timeline-slider') as HTMLInputElement;
    this.yearDisplay = document.getElementById('current-year')!;
    this.marksContainer = document.getElementById('timeline-marks')!;

    this.slider.min = String(this.minYear);
    this.slider.max = String(this.maxYear);
    this.slider.value = String(this.minYear);

    this.slider.addEventListener('input', () => {
      const year = Number(this.slider.value);
      this.updateDisplay(year);
      this.onYearChange(year);
    });
  }

  /** 加载历史事件并渲染刻度 */
  async init(): Promise<void> {
    this.events = await loadJson<HistoricalEvent[]>('/data/events.json');
    this.renderMarks();
    this.updateDisplay(this.minYear);
  }

  /** 获取当前年份 */
  getCurrentYear(): number {
    return Number(this.slider.value);
  }

  /** 设置年份（外部调用，如同步事件点击） */
  setYear(year: number): void {
    const clamped = Math.max(this.minYear, Math.min(this.maxYear, year));
    this.slider.value = String(clamped);
    this.updateDisplay(clamped);
    this.onYearChange(clamped);
  }

  /** 显示/隐藏时间轴 */
  setVisible(visible: boolean): void {
    const bar = document.getElementById('timeline-bar')!;
    bar.classList.toggle('hidden', !visible);
  }

  private updateDisplay(year: number): void {
    this.yearDisplay.textContent = String(year);
    this.highlightNearestMark(year);
  }

  /** 渲染事件刻度标记 */
  private renderMarks(): void {
    this.marksContainer.innerHTML = '';
    const range = this.maxYear - this.minYear;

    for (const event of this.events) {
      const pct = ((event.year - this.minYear) / range) * 100;
      const mark = document.createElement('div');
      mark.className = 'timeline-mark';
      mark.style.left = `${pct}%`;
      mark.dataset.year = String(event.year);
      mark.title = `${event.year}年 · ${event.title}`;

      const tick = document.createElement('span');
      tick.className = 'timeline-mark-tick';
      mark.appendChild(tick);

      const label = document.createElement('span');
      label.className = 'timeline-mark-label';
      label.textContent = event.title;
      mark.appendChild(label);

      mark.addEventListener('click', () => this.setYear(event.year));
      this.marksContainer.appendChild(mark);
    }
  }

  /** 高亮最接近当前年份的刻度 */
  private highlightNearestMark(year: number): void {
    const marks = this.marksContainer.querySelectorAll<HTMLElement>('.timeline-mark');
    let nearest: HTMLElement | null = null;
    let minDist = Infinity;

    for (const mark of marks) {
      const markYear = Number(mark.dataset.year);
      const dist = Math.abs(markYear - year);
      mark.classList.remove('active');
      if (dist < minDist) {
        minDist = dist;
        nearest = mark;
      }
    }

    if (nearest && minDist <= 3) {
      nearest.classList.add('active');
    }
  }
}
