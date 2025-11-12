export const speak = (text: string, lang: string = 'en-US'): void => {
  if ('speechSynthesis' in window) {
    // 停止当前正在播放的语音
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // 稍微慢一点，便于学习
    utterance.pitch = 1;
    utterance.volume = 1;
    
    window.speechSynthesis.speak(utterance);
  } else {
    alert('您的浏览器不支持语音合成功能');
  }
};

export const isSpeechSupported = (): boolean => {
  return 'speechSynthesis' in window;
};

