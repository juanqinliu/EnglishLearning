export const isSpeechSupported = (): boolean => 'speechSynthesis' in window;

export const speak = (text: string, lang: string = 'en-US'): void => {
  if (isSpeechSupported()) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  } else {
    alert('您的浏览器不支持语音合成功能');
  }
};

export const speakAsync = (text: string, lang: string = 'en-US'): Promise<void> => {
  return new Promise((resolve) => {
    if (isSpeechSupported()) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    } else {
      resolve();
    }
  });
};
 
