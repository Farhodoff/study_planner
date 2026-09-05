import { useRef, useCallback, useEffect, useState } from 'react';
import { trackTTSTelemetry } from '../lib/errorTracking';
import { cleanJapaneseTTS } from '../utils/ai';
import { supabase } from '../lib/supabase';

// Cached access token to avoid calling getSession() repeatedly on every sentence chunk
let cachedAuthToken: string | null = null;
let lastTokenFetchTime = 0;

async function getAuthToken(): Promise<string> {
  const now = Date.now();
  if (cachedAuthToken && now - lastTokenFetchTime < 60000) {
    return cachedAuthToken;
  }
  try {
    if (typeof supabase?.auth?.getSession === 'function') {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        cachedAuthToken = data.session.access_token;
        lastTokenFetchTime = now;
        return cachedAuthToken;
      }
    }
  } catch {}
  return import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_6g0Ei_1Cw46e1mJLKj_1Ug_sOmhlgoI';
}

// High-speed In-Memory Audio Cache for 0ms TTS playback on repeated or prefetched text
const TTS_AUDIO_CACHE = new Map<string, Blob>();
const IN_FLIGHT_REQUESTS = new Map<string, Promise<Blob | null>>();
const MAX_TTS_CACHE_ENTRIES = 80;

export function clearTTSAudioCache(): void {
  TTS_AUDIO_CACHE.clear();
  IN_FLIGHT_REQUESTS.clear();
}

interface UseTTSOptions {
  language: 'en' | 'ja';
  isLiveSessionRef?: React.MutableRefObject<boolean>;
  isProcessingRef?: React.MutableRefObject<boolean>;
  onSpeakStart: () => void;
  onSpeakEnd: () => void;
  onAudioPreparing?: (isPreparing: boolean) => void;
}

export interface UseTTSReturn {
  speakText: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  audioPlayerRef: React.MutableRefObject<HTMLAudioElement | null>;
  synthRef: React.MutableRefObject<SpeechSynthesis | null>;
  unlockAudio: () => void;
  enqueueStreamSentence: (sentence: string) => void;
  endStreamPlayback: () => void;
  isPreparingAudio: boolean;
  speechSpeed: number;
  setSpeechSpeed: (speed: number) => void;
}

/**
 * Splits text into natural, cohesive speech chunks.
 * To eliminate artificial silence gaps and encoder padding between multiple clips,
 * it avoids fragmenting at every punctuation mark.
 * Instead:
 * - If text is under maxChunkLen (185 chars), it remains a single cohesive audio chunk.
 * - If text exceeds maxChunkLen, it splits into at most 2 chunks: (a) the first short sentence for instant playback,
 *   and (b) the remaining text as a single cohesive block.
 */
export function splitIntoTTSChunks(text: string, maxChunkLen: number = 185): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // If text is already within maxChunkLen, return as 1 whole chunk for seamless audio
  if (trimmed.length <= maxChunkLen) {
    return [trimmed];
  }

  // Find the first natural sentence boundary for instant low-latency playback
  const firstSentenceMatch = trimmed.match(/^([^。！？.!?\n]+[。！？.!?\n]+)/);

  if (
    firstSentenceMatch &&
    firstSentenceMatch[1].length < trimmed.length &&
    firstSentenceMatch[1].length <= maxChunkLen
  ) {
    const firstSentence = firstSentenceMatch[1].trim();
    const remainder = trimmed.slice(firstSentenceMatch[0].length).trim();

    if (firstSentence.length > 0 && remainder.length > 0) {
      if (remainder.length <= maxChunkLen) {
        // Exactly 2 chunks: first sentence + entire remaining text as one piece!
        return [firstSentence, remainder];
      }

      // If remainder is still long (> maxChunkLen), split remainder into large blocks
      const remainingChunks: string[] = [];
      let current = remainder;
      while (current.length > 0) {
        if (current.length <= maxChunkLen) {
          remainingChunks.push(current.trim());
          break;
        }
        // Try finding a sentence break near maxChunkLen
        const subSlice = current.slice(0, maxChunkLen);
        const lastPunct = Math.max(
          subSlice.lastIndexOf('。'),
          subSlice.lastIndexOf('！'),
          subSlice.lastIndexOf('？'),
          subSlice.lastIndexOf('.'),
          subSlice.lastIndexOf('!'),
          subSlice.lastIndexOf('?'),
          subSlice.lastIndexOf('\n'),
        );

        if (lastPunct > 0) {
          remainingChunks.push(current.slice(0, lastPunct + 1).trim());
          current = current.slice(lastPunct + 1).trim();
        } else {
          const lastComma = Math.max(
            subSlice.lastIndexOf('、'),
            subSlice.lastIndexOf(','),
            subSlice.lastIndexOf(' '),
          );
          if (lastComma > 0) {
            remainingChunks.push(current.slice(0, lastComma + 1).trim());
            current = current.slice(lastComma + 1).trim();
          } else {
            remainingChunks.push(current.slice(0, maxChunkLen).trim());
            current = current.slice(maxChunkLen).trim();
          }
        }
      }

      return [firstSentence, ...remainingChunks.filter((c) => c.length > 0)];
    }
  }

  // Fallback for long text without clean first sentence: split on sentence/comma boundaries up to maxChunkLen
  const chunks: string[] = [];
  let current = trimmed;
  while (current.length > 0) {
    if (current.length <= maxChunkLen) {
      chunks.push(current.trim());
      break;
    }
    const subSlice = current.slice(0, maxChunkLen);
    const lastPunct = Math.max(
      subSlice.lastIndexOf('。'),
      subSlice.lastIndexOf('！'),
      subSlice.lastIndexOf('？'),
      subSlice.lastIndexOf('.'),
      subSlice.lastIndexOf('!'),
      subSlice.lastIndexOf('?'),
      subSlice.lastIndexOf('\n'),
    );
    if (lastPunct > 0) {
      chunks.push(current.slice(0, lastPunct + 1).trim());
      current = current.slice(lastPunct + 1).trim();
    } else {
      const lastComma = Math.max(
        subSlice.lastIndexOf('、'),
        subSlice.lastIndexOf(','),
        subSlice.lastIndexOf(' '),
      );
      if (lastComma > 0) {
        chunks.push(current.slice(0, lastComma + 1).trim());
        current = current.slice(lastComma + 1).trim();
      } else {
        chunks.push(current.slice(0, maxChunkLen).trim());
        current = current.slice(maxChunkLen).trim();
      }
    }
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Searches available SpeechSynthesis voices for a high-quality native voice.
 * Returns null if no voice is available for the given language.
 */
export function selectBestVoice(
  voices: SpeechSynthesisVoice[],
  isJa: boolean,
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;
  const langPrefix = isJa ? 'ja' : 'en';

  const matchingVoices = voices.filter(
    (v) =>
      v.lang.toLowerCase().startsWith(langPrefix) ||
      v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix),
  );

  if (matchingVoices.length === 0) {
    return null;
  }

  if (isJa) {
    const naturalJa = matchingVoices.find((v) => {
      const name = v.name.toLowerCase();
      return (
        name.includes('google') ||
        name.includes('natural') ||
        name.includes('neural') ||
        name.includes('kyoko') ||
        name.includes('otoya') ||
        name.includes('haruka') ||
        name.includes('nanami') ||
        name.includes('mei')
      );
    });
    return naturalJa || matchingVoices[0];
  } else {
    const naturalEn = matchingVoices.find((v) => {
      const name = v.name.toLowerCase();
      return (
        name.includes('google') ||
        name.includes('natural') ||
        name.includes('neural') ||
        name.includes('samantha') ||
        name.includes('daniel') ||
        name.includes('karen') ||
        name.includes('jenny') ||
        name.includes('guy')
      );
    });
    return naturalEn || matchingVoices[0];
  }
}

const TTS_CACHE_NAME = 'tts-audio-v1';

async function getPersistentAudioBlob(cacheKey: string): Promise<Blob | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await caches.open(TTS_CACHE_NAME);
    const match = await cache.match(`https://tts.local/${encodeURIComponent(cacheKey)}`);
    if (match) {
      return await match.blob();
    }
  } catch {}
  return null;
}

async function setPersistentAudioBlob(cacheKey: string, blob: Blob): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open(TTS_CACHE_NAME);
    const res = new Response(blob, {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
    await cache.put(`https://tts.local/${encodeURIComponent(cacheKey)}`, res);
  } catch {}
}

/**
 * Fetches high-quality Google TTS audio from the serverless /api/tts endpoint
 * with in-memory (0ms) and CacheStorage persistence
 */
export async function fetchTTSAudioBlob(text: string, lang: 'ja' | 'en'): Promise<Blob | null> {
  const cleanKey = `${lang}:${(text || '').trim()}`;
  if (TTS_AUDIO_CACHE.has(cleanKey)) {
    return TTS_AUDIO_CACHE.get(cleanKey)!;
  }

  // Fast-path: Check browser persistent CacheStorage
  const diskBlob = await getPersistentAudioBlob(cleanKey);
  if (diskBlob && diskBlob.size > 0) {
    TTS_AUDIO_CACHE.set(cleanKey, diskBlob);
    return diskBlob;
  }

  if (IN_FLIGHT_REQUESTS.has(cleanKey)) {
    return IN_FLIGHT_REQUESTS.get(cleanKey)!;
  }

  const fetchPromise = (async (): Promise<Blob | null> => {
    try {
      const token = await getAuthToken();

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          lang,
        }),
        signal:
          typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
            ? AbortSignal.timeout(8000)
            : undefined,
      });

      if (!response.ok) {
        console.warn('[useTTS] /api/tts HTTP error:', response.status);
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      if (
        !contentType.includes('audio') &&
        !contentType.includes('mpeg') &&
        !contentType.includes('octet-stream')
      ) {
        console.warn('[useTTS] /api/tts invalid content-type:', contentType);
        return null;
      }

      const blob = await response.blob();
      if (!blob || blob.size === 0) return null;

      // Cache the audio blob in memory
      if (TTS_AUDIO_CACHE.size >= MAX_TTS_CACHE_ENTRIES) {
        const oldestKey = TTS_AUDIO_CACHE.keys().next().value;
        if (oldestKey) TTS_AUDIO_CACHE.delete(oldestKey);
      }
      TTS_AUDIO_CACHE.set(cleanKey, blob);

      // Persist to native CacheStorage asynchronously
      setPersistentAudioBlob(cleanKey, blob).catch(() => {});

      return blob;
    } catch (err) {
      console.warn('[useTTS] fetchTTSAudioBlob error:', err);
      return null;
    } finally {
      IN_FLIGHT_REQUESTS.delete(cleanKey);
    }
  })();

  IN_FLIGHT_REQUESTS.set(cleanKey, fetchPromise);
  return fetchPromise;
}

export const useTTS = ({
  language,
  onSpeakStart,
  onSpeakEnd,
  onAudioPreparing,
}: UseTTSOptions): UseTTSReturn => {
  const [isPreparingAudio, setIsPreparingAudio] = useState(false);
  const [speechSpeed, setSpeechSpeedState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('speaking_coach_speech_speed');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) return parsed;
      }
    }
    return 1.0;
  });

  const speechSpeedRef = useRef<number>(speechSpeed);
  useEffect(() => {
    speechSpeedRef.current = speechSpeed;
  }, [speechSpeed]);

  const setSpeechSpeed = useCallback((speed: number) => {
    const validSpeed = Math.min(2.0, Math.max(0.5, speed));
    setSpeechSpeedState(validSpeed);
    speechSpeedRef.current = validSpeed;
    if (typeof window !== 'undefined') {
      localStorage.setItem('speaking_coach_speech_speed', validSpeed.toString());
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.playbackRate = validSpeed;
    }
  }, []);

  const synthRef = useRef<SpeechSynthesis | null>(
    typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null,
  );
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const currentObjectUrlRef = useRef<string | null>(null);
  const ttsSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchdogIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isCancelledRef = useRef<boolean>(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Pipelined Streaming Queue State
  const streamQueueRef = useRef<string[]>([]);
  const isStreamingPlaybackActiveRef = useRef<boolean>(false);
  const isStreamCompletedRef = useRef<boolean>(false);

  const languageRef = useRef(language);
  languageRef.current = language;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;

    const updateVoices = () => {
      try {
        const available = synth.getVoices();
        if (available && available.length > 0) {
          voicesRef.current = available;
        }
      } catch (e) {
        console.debug('Failed to get voices:', e);
      }
    };

    updateVoices();
    synth.addEventListener('voiceschanged', updateVoices);

    return () => {
      synth.removeEventListener('voiceschanged', updateVoices);
    };
  }, []);

  const sharedAudioCtxRef = useRef<AudioContext | null>(null);

  const unlockAudio = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch (e) {
        console.debug('Unlock audio synth failed:', e);
      }
    }

    try {
      if (typeof window !== 'undefined') {
        // Unlock persistent AudioContext
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!sharedAudioCtxRef.current || sharedAudioCtxRef.current.state === 'closed') {
            sharedAudioCtxRef.current = new AudioCtx();
          }
          if (sharedAudioCtxRef.current.state === 'suspended') {
            sharedAudioCtxRef.current.resume().catch(() => {});
          }
        }

        // Pre-activate audioPlayerRef singleton under active user gesture
        if (!audioPlayerRef.current) {
          audioPlayerRef.current = new Audio();
        }
        const audio = audioPlayerRef.current;
        audio.src =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        audio.volume = 0.01;
        audio
          .play()
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1.0;
          })
          .catch(() => {});
      }
    } catch (e) {
      console.debug('Unlock audio element failed:', e);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    isCancelledRef.current = true;
    streamQueueRef.current = [];
    isStreamingPlaybackActiveRef.current = false;
    isStreamCompletedRef.current = true;

    if (watchdogIntervalRef.current) {
      clearInterval(watchdogIntervalRef.current);
      watchdogIntervalRef.current = null;
    }

    if (synthRef.current) {
      try {
        if (synthRef.current.speaking || synthRef.current.pending) {
          synthRef.current.cancel();
        }
      } catch (e) {
        console.debug('Synth cancel failed:', e);
      }
    }
    activeUtteranceRef.current = null;
    if (typeof window !== 'undefined') {
      (window as any).__speakingUtterance = null;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.onended = null;
      audioPlayerRef.current.onerror = null;
      try {
        audioPlayerRef.current.pause();
      } catch (e) {
        console.debug('Audio pause failed:', e);
      }
    }

    if (currentObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(currentObjectUrlRef.current);
      } catch (e) {
        console.debug('Revoke object URL failed:', e);
      }
      currentObjectUrlRef.current = null;
    }

    if (ttsSafetyTimeoutRef.current) {
      clearTimeout(ttsSafetyTimeoutRef.current);
      ttsSafetyTimeoutRef.current = null;
    }
  }, []);

  const fallbackWebAudio = useCallback(async (blob: Blob, onDone: () => void) => {
    try {
      let ctx = sharedAudioCtxRef.current;
      if (!ctx || ctx.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) {
          onDone();
          return;
        }
        ctx = new AudioCtx();
        sharedAudioCtxRef.current = ctx;
      }
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const arrayBuf = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuf);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = speechSpeedRef.current;
      source.connect(ctx.destination);
      source.onended = () => {
        onDone();
      };
      source.start(0);
    } catch (e) {
      console.warn('[useTTS] Web Audio API fallback failed:', e);
      onDone();
    }
  }, []);

  /**
   * Plays a pre-fetched Audio Blob directly with near 0ms latency.
   */
  const playAudioBlob = useCallback(
    async (blob: Blob): Promise<void> => {
      if (isCancelledRef.current || !blob) return;

      const objectUrl = URL.createObjectURL(blob);
      currentObjectUrlRef.current = objectUrl;

      await new Promise<void>((resolve) => {
        if (isCancelledRef.current) {
          URL.revokeObjectURL(objectUrl);
          if (currentObjectUrlRef.current === objectUrl) {
            currentObjectUrlRef.current = null;
          }
          resolve();
          return;
        }

        if (!audioPlayerRef.current) {
          audioPlayerRef.current = new Audio();
        }
        const audio = audioPlayerRef.current;
        audio.volume = 1.0;
        audio.playbackRate = speechSpeedRef.current;
        audio.src = objectUrl;
        try {
          audio.load();
        } catch {}

        const cleanup = () => {
          audio.onended = null;
          audio.onerror = null;
          if (currentObjectUrlRef.current === objectUrl) {
            URL.revokeObjectURL(objectUrl);
            currentObjectUrlRef.current = null;
          }
          resolve();
        };

        audio.onended = cleanup;
        audio.onerror = () => {
          fallbackWebAudio(blob, cleanup);
        };

        audio.play().catch(() => {
          fallbackWebAudio(blob, cleanup);
        });
      });
    },
    [fallbackWebAudio],
  );

  /**
   * Plays a single clause/sentence via Network Google TTS with Web Audio API fallback.
   */
  /**
   * Plays a single clause/sentence via Network Google TTS with Web Audio API fallback.
   * Returns true if audio was successfully fetched and played, false otherwise.
   */
  const playNetworkClause = useCallback(
    async (clause: string, isJa: boolean): Promise<boolean> => {
      if (isCancelledRef.current) return false;
      const blob = await fetchTTSAudioBlob(clause, isJa ? 'ja' : 'en');
      if (isCancelledRef.current || !blob) return false;
      await playAudioBlob(blob);
      return true;
    },
    [playAudioBlob],
  );

  /**
   * Plays a single clause: Prioritizes High-Quality Network Google TTS,
   * but seamlessly falls back to native browser SpeechSynthesis if network fails.
   */
  const playSingleClause = useCallback(
    async (clause: string, isJa: boolean): Promise<void> => {
      if (isCancelledRef.current) return;

      // 1. Try High-Quality Network Google TTS first (works for both ja and en)
      try {
        const played = await playNetworkClause(clause, isJa);
        if (played) return;
        console.warn(
          `[useTTS] Network TTS unavailable for "${clause.substring(0, 25)}...", falling back to browser SpeechSynthesis`,
        );
      } catch (netErr) {
        console.warn('[useTTS] Network TTS failed:', netErr);
      }

      // 2. Native SpeechSynthesis Fallback
      const synth =
        synthRef.current || (typeof window !== 'undefined' ? window.speechSynthesis : null);
      if (!synth) return;

      let currentVoices = voicesRef.current;
      if (!currentVoices || currentVoices.length === 0) {
        try {
          currentVoices = synth.getVoices() || [];
          voicesRef.current = currentVoices;
        } catch {}
      }

      if (!currentVoices || currentVoices.length === 0) {
        await new Promise<void>((r) => {
          let resolved = false;
          const onVoices = () => {
            if (resolved) return;
            resolved = true;
            try {
              currentVoices = synth.getVoices() || [];
              voicesRef.current = currentVoices;
              synth.removeEventListener('voiceschanged', onVoices);
            } catch {}
            r();
          };
          synth.addEventListener('voiceschanged', onVoices);
          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              try {
                synth.removeEventListener('voiceschanged', onVoices);
              } catch {}
              r();
            }
          }, 350);
        });
      }

      const selectedVoice = selectBestVoice(currentVoices, isJa);

      try {
        if (synth && synth.paused) synth.resume();
      } catch {}

      await new Promise<void>((resolve) => {
        if (isCancelledRef.current || !synth) {
          resolve();
          return;
        }

        let isFinished = false;
        let hasStarted = false;

        let startWatchdog: ReturnType<typeof setTimeout> | null = null;
        let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

        const finish = () => {
          if (isFinished) return;
          isFinished = true;
          if (startWatchdog) clearTimeout(startWatchdog);
          if (watchdogTimer) clearTimeout(watchdogTimer);
          activeUtteranceRef.current = null;
          resolve();
        };

        // Fast 800ms start watchdog: if native speech synthesis hasn't fired onstart within 800ms, finish
        startWatchdog = setTimeout(() => {
          if (!hasStarted && !isFinished) {
            console.warn(
              '[useTTS] Native speech failed to start within 800ms, finishing gracefully.',
            );
            try {
              synth.cancel();
            } catch {}
            finish();
          }
        }, 800);

        const maxDurationMs = Math.max(3500, clause.length * 350);
        watchdogTimer = setTimeout(() => {
          if (!isFinished) {
            console.warn(
              `[useTTS] Web Speech hang detected (${maxDurationMs}ms), finishing gracefully.`,
            );
            try {
              synth.cancel();
            } catch {}
            finish();
          }
        }, maxDurationMs);

        try {
          const utterance = new SpeechSynthesisUtterance(clause);
          utterance.lang = isJa ? 'ja-JP' : 'en-US';
          utterance.rate = (isJa ? 0.92 : 0.95) * speechSpeedRef.current;
          utterance.pitch = 1.0;

          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }

          activeUtteranceRef.current = utterance;
          if (typeof window !== 'undefined') {
            (window as any).__speakingUtterance = utterance;
          }

          utterance.onstart = () => {
            hasStarted = true;
            if (startWatchdog) clearTimeout(startWatchdog);
          };

          utterance.onend = () => {
            finish();
          };

          utterance.onerror = (event: any) => {
            if (isCancelledRef.current) {
              finish();
              return;
            }
            if (event?.error === 'canceled' || event?.error === 'interrupted') {
              finish();
              return;
            }
            finish();
          };

          synth.speak(utterance);
          if (synth.paused) synth.resume();
        } catch {
          finish();
        }
      });
    },
    [playNetworkClause],
  );

  /**
   * Processes the pipelined streaming sentence queue sequentially.
   */
  const processStreamQueue = useCallback(async () => {
    if (isStreamingPlaybackActiveRef.current || isCancelledRef.current) return;
    isStreamingPlaybackActiveRef.current = true;
    onSpeakStart();

    const isJa = languageRef.current === 'ja';

    while (!isCancelledRef.current) {
      if (streamQueueRef.current.length > 0) {
        const nextSentence = streamQueueRef.current.shift()!;
        await playSingleClause(nextSentence, isJa);
      } else {
        if (isStreamCompletedRef.current) {
          break;
        }
        // Micro-wait for the next streamed sentence to arrive
        await new Promise((r) => setTimeout(r, 60));
      }
    }

    isStreamingPlaybackActiveRef.current = false;
    if (!isCancelledRef.current) {
      onSpeakEnd();
    }
  }, [onSpeakStart, onSpeakEnd, playSingleClause]);

  const enqueueStreamSentence = useCallback(
    (sentence: string) => {
      isCancelledRef.current = false;
      const rawClean = (sentence || '').trim();
      if (!rawClean) return;

      const isJa =
        languageRef.current === 'ja' || /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(rawClean);
      const textToPlay = isJa
        ? cleanJapaneseTTS(rawClean)
        : rawClean.replace(/[*_#`~]/g, '').trim();

      if (!textToPlay) return;

      const chunks = splitIntoTTSChunks(textToPlay, 170);
      // Immediately prefetch audio blobs in parallel so upcoming sentences have 0ms delay
      chunks.forEach((chunk) => {
        fetchTTSAudioBlob(chunk, isJa ? 'ja' : 'en').catch(() => {});
      });
      streamQueueRef.current.push(...chunks);

      if (!isStreamingPlaybackActiveRef.current) {
        isStreamCompletedRef.current = false;
        processStreamQueue();
      }
    },
    [processStreamQueue],
  );

  const endStreamPlayback = useCallback(() => {
    isStreamCompletedRef.current = true;
    if (!isStreamingPlaybackActiveRef.current && streamQueueRef.current.length === 0) {
      onSpeakEnd();
    }
  }, [onSpeakEnd]);

  const speakText = useCallback(
    async (text: string) => {
      const startTime = Date.now();
      const rawClean = (text || '').trim();
      if (!rawClean) {
        onSpeakEnd();
        return;
      }

      stopSpeaking();
      isCancelledRef.current = false;

      const isJa =
        languageRef.current === 'ja' || /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(rawClean);
      const textToPlay = isJa
        ? cleanJapaneseTTS(rawClean)
        : rawClean.replace(/[*_#`~]/g, '').trim();

      if (!textToPlay) {
        onSpeakEnd();
        return;
      }

      setIsPreparingAudio(true);
      onAudioPreparing?.(true);

      const chunks = splitIntoTTSChunks(textToPlay, 185);
      if (chunks.length === 0) {
        setIsPreparingAudio(false);
        onAudioPreparing?.(false);
        onSpeakEnd();
        return;
      }

      const onSpeechFinish = (success: boolean = true, error?: string) => {
        setIsPreparingAudio(false);
        onAudioPreparing?.(false);
        if (watchdogIntervalRef.current) {
          clearInterval(watchdogIntervalRef.current);
          watchdogIntervalRef.current = null;
        }
        if (ttsSafetyTimeoutRef.current) {
          clearTimeout(ttsSafetyTimeoutRef.current);
          ttsSafetyTimeoutRef.current = null;
        }
        activeUtteranceRef.current = null;
        if (typeof window !== 'undefined') {
          (window as any).__speakingUtterance = null;
        }
        trackTTSTelemetry({ durationMs: Date.now() - startTime, success, error });
        onSpeakEnd();
      };

      const safetyTimeoutMs = Math.min(60000, Math.max(15000, chunks.length * 9000));
      ttsSafetyTimeoutRef.current = setTimeout(() => {
        onSpeechFinish(false, `TTS timeout ${safetyTimeoutMs}ms exceeded`);
      }, safetyTimeoutMs);

      // Check if native browser SpeechSynthesis has voices for this language
      const synth =
        synthRef.current || (typeof window !== 'undefined' ? window.speechSynthesis : null);
      let currentVoices = voicesRef.current;
      if (synth && (!currentVoices || currentVoices.length === 0)) {
        try {
          currentVoices = synth.getVoices() || [];
          voicesRef.current = currentVoices;
        } catch {}
      }
      const hasLanguageVoice = isJa
        ? (currentVoices || []).some((v) => v.lang.toLowerCase().startsWith('ja'))
        : (currentVoices || []).some((v) => v.lang.toLowerCase().startsWith('en'));

      // High-Quality Network Google TTS is ALWAYS used for Japanese to avoid 12s silent-hang and robotic audio
      const useNetworkTTS = isJa || !synth || !hasLanguageVoice;

      onSpeakStart();

      if (useNetworkTTS) {
        // --- HIGH-SPEED PARALLEL PREFETCH & STREAMING PLAYBACK ---
        // 1. Kick off network requests for ALL chunks in parallel AT THE SAME TIME!
        const chunkPromises = chunks.map((c) => fetchTTSAudioBlob(c, isJa ? 'ja' : 'en'));

        // 2. Play sequentially as each chunk's audio becomes ready with 0ms gap
        for (let i = 0; i < chunks.length; i++) {
          if (isCancelledRef.current) break;

          const blob = await chunkPromises[i];

          if (i === 0) {
            setIsPreparingAudio(false);
            onAudioPreparing?.(false);
          }

          if (isCancelledRef.current) break;

          if (blob) {
            console.log(
              `[useTTS] Chunk ${i + 1}/${chunks.length} playback started at +${Date.now() - startTime}ms: "${chunks[i].substring(0, 30)}..."`,
            );
            await playAudioBlob(blob);
          } else {
            console.warn(
              `[useTTS] Network chunk ${i + 1} unavailable, fallback to browser SpeechSynthesis: "${chunks[i].substring(0, 30)}..."`,
            );
            await playSingleClause(chunks[i], isJa);
          }
        }
      } else {
        // --- NATIVE BROWSER SPEECH SYNTHESIS ---
        for (let i = 0; i < chunks.length; i++) {
          if (isCancelledRef.current) break;
          if (i === 0) {
            setIsPreparingAudio(false);
            onAudioPreparing?.(false);
          }
          await playSingleClause(chunks[i], isJa);
        }
      }

      onSpeechFinish(true);
    },
    [onSpeakStart, onSpeakEnd, onAudioPreparing, stopSpeaking, playSingleClause, playAudioBlob],
  );

  return {
    speakText,
    stopSpeaking,
    audioPlayerRef,
    synthRef,
    unlockAudio,
    enqueueStreamSentence,
    endStreamPlayback,
    isPreparingAudio,
    speechSpeed,
    setSpeechSpeed,
  };
};
