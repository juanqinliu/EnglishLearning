// A pool of Audio objects to allow for rapid succession of sounds
const audioPool: { [key: string]: HTMLAudioElement[] } = {};
const poolSize = 5; // Number of audio objects per sound
let isInitialized = false;

const sounds = {
  type: './sounds/type.wav',
  error: './sounds/error.wav',
  correct: './sounds/correct.wav',
};

const createAudioPool = (src: string) => {
  if (!audioPool[src]) {
    audioPool[src] = [];                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               
    for (let i = 0; i < poolSize; i++) {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audioPool[src].push(audio);
    }
  }
};

let poolIndex: { [key: string]: number } = {};

// This function should be called after a user interaction
export const initAudio = () => {
  if (isInitialized) return;
  console.log('Initializing audio...');
  Object.values(sounds).forEach(src => {
    createAudioPool(src);
    poolIndex[src] = 0;
  });
  isInitialized = true;
};

export const playSound = (sound: keyof typeof sounds) => {
  if (!isInitialized) {
    console.warn('Audio not initialized. Call initAudio() on user interaction.');
    return;
  }
  try {
    const src = sounds[sound];
    if (audioPool[src]) {
      const audio = audioPool[src][poolIndex[src]];
      audio.currentTime = 0;
      audio.play().catch(e => {
        console.error(`Error playing sound: ${sound}`, e);
      });
      poolIndex[src] = (poolIndex[src] + 1) % poolSize;
    }
  } catch (error) {
    console.error(`Error playing sound: ${sound}`, error);
  }
};