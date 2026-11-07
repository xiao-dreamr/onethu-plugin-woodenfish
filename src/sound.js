/**
 * 木鱼音效（WebAudio 合成，零素材、零网络）。
 *
 * 为什么合成而不是打包音频：插件是单文件文本，塞 base64 音频会让体积暴涨；
 * 木鱼声本质是「短促的木质敲击」= 一段快速衰减的三角波（腔体）+ 一小段带通噪声
 * （敲击瞬间），合成出来足够像，而且能每次微调音高，连敲不呆板。
 *
 * 边界：
 *   - 浏览器自动播放策略：AudioContext 必须在用户手势里创建/恢复。插件页第一次点击
 *     天然满足；白板卡片点击时命令在点击回调里同步执行，通常也能过（不保证，失败静默）。
 *   - Node/无 WebAudio 环境（测试）返回 false，不抛错。
 */

let WfAudioContext = null;

function wfAudioCtor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function wfEnsureAudio() {
  try {
    const Ctor = wfAudioCtor();
    if (!Ctor) return null;
    if (!WfAudioContext) WfAudioContext = new Ctor();
    if (WfAudioContext.state === "suspended") void WfAudioContext.resume();
    return WfAudioContext;
  } catch {
    return null;
  }
}

/**
 * 敲一下。
 * @param {number} intensity 0.05–1，默认 1（自动连敲时可调低）
 * @returns {boolean} 是否真的发声（无 WebAudio / 被策略拦截 → false）
 */
export function playWoodfish(intensity = 1) {
  const ac = wfEnsureAudio();
  if (!ac) return false;
  try {
    const t0 = ac.currentTime + 0.001;
    const vol = Math.max(0.05, Math.min(1, Number(intensity) || 1));

    /* 腔体：三角波快速下滑 + 指数衰减，给出"咚"的木质主体 */
    const body = ac.createOscillator();
    const bodyGain = ac.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(720 + Math.random() * 90, t0);
    body.frequency.exponentialRampToValueAtTime(170 + Math.random() * 30, t0 + 0.07);
    bodyGain.gain.setValueAtTime(0.0001, t0);
    bodyGain.gain.exponentialRampToValueAtTime(0.5 * vol, t0 + 0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
    body.connect(bodyGain).connect(ac.destination);
    body.start(t0);
    body.stop(t0 + 0.12);

    /* 敲击：一小段衰减噪声过带通，给出"嗒"的瞬态 */
    const len = Math.max(1, Math.floor(ac.sampleRate * 0.035));
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const hit = ac.createBufferSource();
    hit.buffer = buffer;
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1350 + Math.random() * 450;
    band.Q.value = 1.1;
    const hitGain = ac.createGain();
    hitGain.gain.value = 0.2 * vol;
    hit.connect(band).connect(hitGain).connect(ac.destination);
    hit.start(t0);

    return true;
  } catch {
    return false;
  }
}

/** 预热（用户第一次点木鱼时调用；失败静默）。 */
export function warmWoodfishAudio() {
  return wfEnsureAudio() !== null;
}

export function disposeWoodfishAudio() {
  try {
    if (WfAudioContext && typeof WfAudioContext.close === "function") void WfAudioContext.close();
  } catch {
    /* 关不掉就算了，进程退出会回收 */
  }
  WfAudioContext = null;
}