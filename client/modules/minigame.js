/**
 * 鍛冶ミニゲーム（タイミングゲージ）を制御するクラスです。
 */
export class ForgeMinigame {
  constructor(containerId, onComplete) {
    this.container = document.getElementById(containerId);
    this.onComplete = onComplete;
    this.isActive = false;
    this.position = 0;
    this.direction = 1;
    this.animationFrameId = null;
    
    this.motivation = 80;
    this.hammerLevel = 1;
    this.time = 0;
    
    this.cursor = null;
    this.stopBtn = null;
    this.keydownHandler = null;
  }
  
  /**
   * ミニゲームを開始します。
   * @param {number} motivation プレイヤーのやる気 (0〜100)
   * @param {number} hammerLevel プレイヤーのハンマーレベル (1〜5)
   */
  init(motivation, hammerLevel) {
    this.motivation = motivation;
    this.hammerLevel = hammerLevel;
    this.position = 0;
    this.direction = 1;
    this.time = 0;
    
    // UI構造を構築
    this.container.innerHTML = `
      <div class="forge-game-wrapper">
        <p class="forge-instruction">タイミングを合わせて中央の緑色で止めろ！</p>
        
        <div class="forge-gauge-container">
          <div class="forge-gauge-bar red-zone"></div>
          <div class="forge-gauge-bar yellow-zone"></div>
          <div class="forge-gauge-bar green-zone"></div>
          <div class="forge-cursor" id="forge-cursor"></div>
        </div>
        
        <div class="forge-stats-hint">
          <span>🔨 ハンマーLv: ${this.hammerLevel} (判定幅緩和)</span>
          <span>🔥 やる気: ${this.motivation} (低いとゲージ速度がブレる)</span>
        </div>
        
        <button id="forge-stop-btn" class="pixel-btn accent-btn">鍛造する！ (SPACE)</button>
      </div>
    `;
    
    this.cursor = document.getElementById('forge-cursor');
    this.stopBtn = document.getElementById('forge-stop-btn');
    
    // ストップ（鍛造）イベントのバインド
    this.stopBtn.addEventListener('click', () => this.stop());
    
    this.keydownHandler = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.stop();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
    
    this.isActive = true;
    this.loop();
  }
  
  /**
   * メインアニメーションループ
   */
  loop() {
    if (!this.isActive) return;
    
    this.time += 1;
    
    // やる気による速度のブレ補正
    // やる気が低い（Motivation Deficit が高い）ほど、サイン波による速度の揺らぎが大きくなる
    const motivationDeficit = 100 - this.motivation;
    const speedVariation = (motivationDeficit / 100) * Math.sin(this.time * 0.12) * 1.6;
    
    // 基本速度は 2.0。ハンマーレベルが上がるとわずかに狙いやすくなる
    const baseSpeed = Math.max(1.2, 2.4 - (this.hammerLevel * 0.15));
    const currentSpeed = Math.max(0.4, baseSpeed + speedVariation);
    
    this.position += this.direction * currentSpeed;
    
    if (this.position >= 100) {
      this.position = 100;
      this.direction = -1;
    } else if (this.position <= 0) {
      this.position = 0;
      this.direction = 1;
    }
    
    this.cursor.style.left = `${this.position}%`;
    
    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }
  
  /**
   * ゲージを止めて結果を判定します。
   */
  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('keydown', this.keydownHandler);
    
    // 中央（50%）からの距離を計測
    const target = 50;
    const distance = Math.abs(this.position - target);
    
    // ハンマーレベルによる判定閾値の緩和
    const perfectThreshold = 4.0 + (this.hammerLevel * 0.6); // Lv1: 4.6%以内、Lv5: 7.0%以内
    const goodThreshold = 18.0 + (this.hammerLevel * 2.0);   // Lv1: 20.0%以内、Lv5: 28.0%以内
    
    let quality = 1;
    if (distance <= perfectThreshold) {
      quality = 5; // ★★★★★ (最高)
    } else if (distance <= goodThreshold) {
      quality = 3; // ★★★☆☆ (普通)
    } else {
      quality = 1; // ★☆☆☆☆ (劣悪)
    }
    
    // コールバックの実行
    this.onComplete({
      position: this.position,
      distance: distance,
      quality: quality
    });
  }
  
  /**
   * クリーアップ処理
   */
  destroy() {
    this.isActive = false;
    cancelAnimationFrame(this.animationFrameId);
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
    }
  }
}
