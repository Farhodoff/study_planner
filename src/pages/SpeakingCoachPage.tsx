import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import {
  converseWithCoachStructured,
  streamCoachDialogue,
  CoachStructuredResponse,
  CoachVocabularyItem,
  analyzeSpeakingSession,
  SessionAnalysisReport,
  translateTextToUzbek,
  parseMicroErrors,
  extractSpeechAudioText,
  cleanJapaneseTTS,
} from '../utils/ai';
import { useStudyData } from '../context/StudyPlannerContext';
import { ErrorVaultService } from '../services/ErrorVaultService';
import { MasteryEngine } from '../services/MasteryEngine';
import { isAdminEmail, isSuperAdmin } from '../utils/admin';
import { toast } from '../hooks/use-toast';
import { useSEO } from '../hooks/useSEO';
import SessionReportModal from '../components/speaking/SessionReportModal';
import {
  PERSONAS_BY_LANG,
  CoachPersona,
  CoachChatMessage,
} from '../components/speaking/speakingTypes';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { useTTS, fetchTTSAudioBlob } from '../hooks/useTTS';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import { ConversationScenario, ScenarioSessionResult } from '../components/speaking/scenarioTypes';
import { ScenarioService } from '../services/ScenarioService';
import { evaluateScenarioSession } from '../utils/ai/aiScenarioEval';
import { ScenarioReportModal } from '../components/speaking/ScenarioReportModal';
import { CoachTopBar } from '../components/speaking/CoachTopBar';
import { CoachWelcomeScreen } from '../components/speaking/CoachWelcomeScreen';
import { CoachChatArea } from '../components/speaking/CoachChatArea';
import { CoachControlBar } from '../components/speaking/CoachControlBar';
import { CoachSettingsModal } from '../components/speaking/CoachSettingsModal';
import { CoachProgressDashboard } from '../components/speaking/CoachProgressDashboard';
import { RealtimeVoiceOverlay, ErrorTag } from '../components/speaking/RealtimeVoiceOverlay';
import { playConversationChime } from '../utils/audioChime';
import { isAcousticEcho } from '../utils/echoFilter';
import { SpeakingVocabularyService } from '../services/SpeakingVocabularyService';
import { AudioStorageService } from '../services/AudioStorageService';
import { getOrEnsureSpeakingDeck } from '../utils/subjectResolver';
import { supabase } from '../lib/supabase';
import { PitchAccentService, PitchAccentInfo } from '../services/PitchAccentService';
import { PitchAccentModal } from '../components/speaking/PitchAccentModal';

const PROMPT_SUGGESTIONS_BY_LANG: Record<
  'en' | 'ja',
  { title: string; text: string; icon: string }[]
> = {
  en: [
    {
      title: 'Introduce Yourself',
      text: "Hajimemashite. Let's practice self-introduction in Japanese. Can you ask me questions to prompt my self-intro?",
      icon: '👋',
    },
    {
      title: 'Roast My Japanese',
      text: 'I want you to be a strict Japanese teacher. Correct every grammatical or pronunciation mistake I make in Japanese!',
      icon: '🔥',
    },
    {
      title: 'JLPT Speaking Mock',
      text: "Let's practice for JLPT speaking. Give me a daily conversation topic to talk about.",
      icon: '📝',
    },
    {
      title: 'IT Mock Interview',
      text: 'Act as a Japanese IT recruiter and ask me 3 interview questions in Japanese.',
      icon: '💼',
    },
  ],
  ja: [
    {
      title: '自己紹介 (Jikoshoukai)',
      text: 'はじめまして。自己紹介の練習をしたいです。',
      icon: '🙋',
    },
    {
      title: 'IT面接 (IT Mock Interview)',
      text: '日本のIT企業の面接練習をお願いします。自己紹介からスタートしてください。',
      icon: '💻',
    },
    {
      title: '敬語チェック (Keigo Check)',
      text: '私の敬語の使い方をチェックしてアドバイスをください。',
      icon: '📖',
    },
    {
      title: '日常会話 (Daily Japanese)',
      text: '日本語で楽しい日常会話をしましょう！',
      icon: '🗣️',
    },
  ],
};

export const getCoachInitialGreeting = (lang: 'en' | 'ja', p: CoachPersona): string => {
  if (lang === 'ja') {
    switch (p) {
      case 'roast':
        return 'こんにちは！鬼先生です。遠慮せずに日本語で話してください！';
      case 'gentle':
        return 'こんにちは！日本語の先生です。いつでもお話ししてくださいね。';
      case 'ielts':
        return 'こんにちは！JLPTスピーキングの練習を始めましょう！';
      case 'interview':
        return 'こんにちは。本日のIT面接を担当いたします。自己紹介をお願いします。';
      case 'travel':
        return 'いらっしゃいませ！成田空港へようこそ。どのようなご要件でしょうか？';
      case 'casual':
        return 'やあ！元気？今日は何について話そうか！';
    }
  } else {
    switch (p) {
      case 'roast':
        return 'Hello! Strict Japanese Roast Coach here. Speak in Japanese and prepare for corrections!';
      case 'gentle':
        return "Hello! I'm your Japanese language tutor. Feel free to start talking in Japanese whenever you're ready!";
      case 'ielts':
        return "Good day! Let's practice Japanese JLPT Speaking. Shall we begin?";
      case 'interview':
        return "Hello! Welcome to your Japanese IT Job Mock Interview. Let's start with a self-introduction in Japanese.";
      case 'travel':
        return "Konnichiwa! Welcome to Narita Airport. Let's practice travel Japanese.";
      case 'casual':
        return "Hey friend! Let's chat in casual Japanese. What's on your mind today?";
    }
  }
};

const SpeakingCoachPage: React.FC = () => {
  useSEO({
    title: 'AI Yapon Tili Muloqot Murabbiyi (Yuki-sensei)',
    description:
      "Yapon tilida erkin gapirishni o'rganing. Real vaqtda talaffuz, xatolar tahlili va interaktiv hayotiy dialoglar.",
    canonical: '/speaking',
    keywords:
      'yapon tili speaking, AI yapon tili suhbatdosh, Yuki sensei, yaponcha talaffuz, JLPT kaiwa',
  });

  const navigate = useNavigate();
  const { primaryLanguage } = useStudyData();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    user,
    addCoachSession,
    addFlashcardsBatch,
    subjects,
    addSubject,
    flashcards,
    updateFlashcard,
  } = useStudyData();
  const isAdmin = isAdminEmail(user?.email);
  const isSuper = isSuperAdmin(user?.email);

  // Clean up any legacy cards that contain "🎙️ Manba:" to keep cards clean and distraction-free
  useEffect(() => {
    if (flashcards && flashcards.length > 0 && updateFlashcard) {
      flashcards.forEach((card) => {
        if (card.back && card.back.includes('🎙️ Manba:')) {
          const cleanedBack = card.back.replace(/\n*🎙️\s*Manba:[^\n]*/gi, '').trim();
          updateFlashcard(card.id, { back: cleanedBack }).catch(() => {});
        }
      });
    }
  }, [flashcards, updateFlashcard]);

  const urlLang = searchParams.get('lang');
  const scenarioIdParam = searchParams.get('scenario');

  const initialLang: 'en' | 'ja' = isSuper && urlLang === 'en' ? 'en' : 'ja';
  const [language, setLanguage] = useState<'en' | 'ja'>(initialLang);

  useEffect(() => {
    if (!isSuper) {
      setLanguage('ja');
      return;
    }
    if (urlLang === 'ja' || urlLang === 'en') {
      setLanguage((prev) => (prev !== urlLang ? urlLang : prev));
    } else if (primaryLanguage === 'ja' || primaryLanguage === 'en') {
      setLanguage((prev) => (prev !== primaryLanguage ? primaryLanguage : prev));
    }
  }, [urlLang, primaryLanguage, isSuper]);

  // Scenario & Voice Recorder state
  const [activeScenario, setActiveScenario] = useState<ConversationScenario | null>(() => {
    if (!scenarioIdParam) return null;
    const normalizedParam = scenarioIdParam.trim().replace(/\s+/g, '_');
    const immediate = ScenarioService.getImmediateScenarios();
    return immediate.find((s) => s.id === scenarioIdParam || s.id === normalizedParam) || null;
  });
  const [isScenarioReportOpen, setIsScenarioReportOpen] = useState(false);
  const [isScenarioEvalLoading, setIsScenarioEvalLoading] = useState(false);
  const [scenarioEvalResult, setScenarioEvalResult] = useState<ScenarioSessionResult | null>(null);

  const voiceRecorder = useVoiceRecorder();

  const handleLanguageChange = (newLang: 'en' | 'ja') => {
    if (isLiveSession) return;
    setLanguage(newLang);
    setSearchParams({ lang: newLang });
  };

  const [persona, setPersona] = useState<CoachPersona>('roast');
  const [targetBand, setTargetBand] = useState<'5.0' | '6.0' | '7.0' | '7.5' | '8.0' | '9.0'>(
    '7.5',
  );
  const [isLiveSession, setIsLiveSession] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [chatHistory, setChatHistory] = useState<CoachChatMessage[]>(() => {
    if (scenarioIdParam) {
      const normalizedParam = scenarioIdParam.trim().replace(/\s+/g, '_');
      const immediate = ScenarioService.getImmediateScenarios();
      const found = immediate.find((s) => s.id === scenarioIdParam || s.id === normalizedParam);
      if (found) {
        const sLang = found.language || (found.title_en ? 'en' : 'ja');
        const greeting =
          (sLang === 'en' ? found.opening_line_en : found.opening_line_ja) ||
          found.opening_line_ja ||
          found.opening_line_en ||
          "Hello! Let's start our conversation practice.";
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return [{ role: 'assistant', content: greeting, timestamp: timeStr }];
      }
    }
    // Clean fresh session without old persistent mock chat
    return [];
  });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [liveErrors, setLiveErrors] = useState<ErrorTag[]>([]);

  // Session Analysis Report Modal state
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [reportData, setReportData] = useState<SessionAnalysisReport | null>(null);

  // Open access for all users
  const isPaidUser = true;
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const activeScenarioRef = useRef(activeScenario);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);
  const isLiveSessionRef = useRef(false);
  const chatHistoryRef = useRef<CoachChatMessage[]>([]);
  const languageRef = useRef(language);
  const personaRef = useRef(persona);

  useEffect(() => {
    activeScenarioRef.current = activeScenario;
  }, [activeScenario]);

  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  useEffect(() => {
    languageRef.current = language;
    personaRef.current = persona;
  }, [language, persona]);

  // Timer logic
  useEffect(() => {
    let interval: any;
    if (isLiveSession) {
      interval = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSessionSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isLiveSession]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Voice Mode: Hands-Free by default for natural spoken conversation, with localStorage persistence
  const [isHandsFree, setIsHandsFree] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('coach_hands_free');
      if (saved !== null) return saved === 'true';
    }
    return true;
  });
  const isHandsFreeRef = useRef(isHandsFree);
  useEffect(() => {
    isHandsFreeRef.current = isHandsFree;
    if (typeof window !== 'undefined') {
      localStorage.setItem('coach_hands_free', String(isHandsFree));
    }
  }, [isHandsFree]);

  // Pitch Accent inspection modal state
  const [inspectingPitch, setInspectingPitch] = useState<PitchAccentInfo | null>(null);
  const handleInspectPitch = useCallback((word: string, kanaHint?: string) => {
    const info = PitchAccentService.getPitchAccent(word, kanaHint);
    setInspectingPitch(info);
  }, []);

  // Fullscreen Toggle Support (⛶ Zoom/Fullscreen mode)
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen((prev) => !prev);
        });
      } else if ((containerRef.current as any)?.webkitRequestFullscreen) {
        (containerRef.current as any).webkitRequestFullscreen();
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          setIsFullscreen(false);
        });
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else {
        setIsFullscreen(false);
      }
    }
  }, []);

  const isSpeakingRef = useRef(isSpeaking);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const lastCoachSpokenTextRef = useRef<string>('');
  const streamAbortControllerRef = useRef<AbortController | null>(null);

  // TTS Hook
  const {
    speakText,
    stopSpeaking,
    unlockAudio,
    isPreparingAudio,
    enqueueStreamSentence,
    endStreamPlayback,
    speechSpeed,
    setSpeechSpeed,
  } = useTTS({
    language,
    isLiveSessionRef,
    isProcessingRef,
    onSpeakStart: () => {
      setIsSpeaking(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      transcriptBufferRef.current = '';
      setCurrentTranscript('');
    },
    onSpeakEnd: () => {
      setIsSpeaking(false);
      isProcessingRef.current = false;
      // Start recording student session after coach finishes speaking
      if (isLiveSessionRef.current && !voiceRecorder.isRecording) {
        voiceRecorder.startRecording().catch(() => {});
      }
      // In Click-to-Talk mode (default), mic stays off so user can press "Gapirish" when ready.
      if (isLiveSessionRef.current && isHandsFreeRef.current && !isMuted) {
        setTimeout(() => {
          if (
            isLiveSessionRef.current &&
            isHandsFreeRef.current &&
            !isSpeakingRef.current &&
            !isProcessingRef.current
          ) {
            startListening();
          }
        }, 400);
      }
    },
  });

  // Warm-cache prefetch active coach greeting only (0ms start)
  useEffect(() => {
    if (!activeScenario) {
      const activeGreeting = getCoachInitialGreeting(language, persona);
      if (activeGreeting) {
        fetchTTSAudioBlob(activeGreeting, language).catch(() => {});
      }
    }
  }, [language, persona, activeScenario]);

  // Handle Scenario selection / loading and auto-speaking opening line with 0ms delay
  useEffect(() => {
    if (scenarioIdParam) {
      const normalizedParam = scenarioIdParam.trim().replace(/\s+/g, '_');
      const immediateList = ScenarioService.getImmediateScenarios();
      const immediateFound = immediateList.find(
        (s) => s.id === scenarioIdParam || s.id === normalizedParam,
      );

      const applyScenarioGreeting = (scenario: ConversationScenario) => {
        setActiveScenario(scenario);
        activeScenarioRef.current = scenario;
        const sLang = scenario.language || (scenario.title_en ? 'en' : 'ja');
        setLanguage((prev) => (prev !== sLang ? sLang : prev));

        const scenarioGreeting =
          (sLang === 'en' ? scenario.opening_line_en : scenario.opening_line_ja) ||
          scenario.opening_line_ja ||
          scenario.opening_line_en ||
          "Hello! Let's start our conversation practice.";
        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const freshHistory: CoachChatMessage[] = [
          { role: 'assistant', content: scenarioGreeting, timestamp: timeStr },
        ];
        setChatHistory(freshHistory);
        chatHistoryRef.current = freshHistory;

        const speechAudio = extractSpeechAudioText(scenarioGreeting);
        lastCoachSpokenTextRef.current = speechAudio;
        unlockAudio();
        // Instant trigger with 0ms artificial delay
        speakText(speechAudio);
      };

      if (immediateFound) {
        applyScenarioGreeting(immediateFound);
      } else {
        ScenarioService.getScenarios()
          .then((scenarios) => {
            const found = scenarios.find(
              (s) => s.id === scenarioIdParam || s.id === normalizedParam,
            );
            if (found) {
              applyScenarioGreeting(found);
            }
          })
          .catch((err) => {
            console.error('Scenario load error:', err);
          });
      }
    } else {
      setActiveScenario((prev) => (prev !== null ? null : prev));
    }
  }, [scenarioIdParam, unlockAudio, speakText]);

  // Speech Recognition Hook
  const {
    recognitionRef,
    isListening,
    currentTranscript,
    setCurrentTranscript,
    transcriptBufferRef,
    error,
    setError,
    audioVolume,
    startListening,
    commitSpeechNow,
  } = useSpeechRecognition({
    language,
    isLiveSessionRef,
    isProcessingRef,
    isSpeaking,
    isThinking,
    isMuted,
    onValidSpeech: (spokenText) => {
      handleSendUserText(spokenText);
    },
    onResumeListening: () => {},
  });

  const handleBargeIn = useCallback(() => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
      streamAbortControllerRef.current = null;
    }
    if (isSpeaking) {
      playConversationChime('barge_in');
      stopSpeaking();
      setIsSpeaking(false);
      isProcessingRef.current = false;
      setTimeout(() => {
        startListening();
      }, 100);
    }
  }, [isSpeaking, stopSpeaking, startListening]);

  const toggleMic = useCallback(() => {
    unlockAudio();
    if (isSpeaking) {
      handleBargeIn();
      return;
    }
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    } else {
      startListening();
    }
  }, [unlockAudio, isSpeaking, handleBargeIn, isListening, startListening]);

  const handleAddVocabToFlashcards = async (vocab: CoachVocabularyItem): Promise<boolean> => {
    try {
      const isJa =
        language === 'ja' || /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(vocab.word);
      const activeLang = isJa ? 'ja' : 'en';

      // 1. Direct PostgreSQL DB Persist into `speaking_vocabularies` table
      let effectiveUserId = user?.id;
      if (!effectiveUserId || effectiveUserId === 'local_user' || effectiveUserId === 'guest') {
        try {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.user?.id) effectiveUserId = data.session.user.id;
        } catch {}
      }
      const userId = effectiveUserId || 'local_user';
      const personaName = PERSONAS_BY_LANG[activeLang]?.[persona]?.name;
      const scenarioName = activeScenario
        ? activeScenario.title_uz || activeScenario.title_en || activeScenario.title_ja
        : undefined;
      await SpeakingVocabularyService.saveVocabulary(
        userId,
        vocab,
        activeLang,
        personaName || scenarioName || 'AI Speaking Coach',
      );

      // 2. Resolve or auto-create DEDICATED Speaking Flashcard Deck (ALOHIDA ALBOM)
      const targetSubjectId = await getOrEnsureSpeakingDeck(
        subjects,
        addSubject,
        isJa ? 'ja' : 'en',
      );

      const targetDeckName = isJa ? "🎙️ AI Speaking Lug'atlari" : '🎙️ AI Speaking Vocabulary';

      // 3. Extract or translate Uzbek and English meanings
      let uzbekMeaning = '';
      let englishMeaning = '';

      const raw = (vocab.meaning || '').trim();
      const parenMatch = raw.match(/^(.*?)\s*[([](.*)[)\]]$/);
      const bulletMatch = raw.match(/^(.*?)\s*[•|/]\s*(.*)$/);

      if (parenMatch) {
        uzbekMeaning = parenMatch[1].trim();
        englishMeaning = parenMatch[2].trim();
      } else if (bulletMatch) {
        uzbekMeaning = bulletMatch[1].trim();
        englishMeaning = bulletMatch[2].trim();
      } else if (isJa) {
        const isPrimarilyEnglish = /^[a-zA-Z\s/,\-–.?!'"]+$/.test(raw);
        if (isPrimarilyEnglish) {
          englishMeaning = raw;
          const knownTranslations: Record<string, string> = {
            'reason for applying / application motivation': 'Ishga topshirish sababi va maqsadi',
            'reason for applying': 'Ishga topshirish sababi',
            'application motivation': 'Topshirish maqsadi',
            'self-promotion / strengths presentation':
              "O'zini tanishtirish va kuchli tomonlarini taqdim etish",
            'self-promotion': "O'zini tanishtirish",
            'strengths presentation': 'Kuchli tomonlarni ko‘rsatish',
            'technology stack / skills': "Texnologiyalar to'plami va ko'nikmalar",
            'technology stack': "Texnologiyalar to'plami",
          };
          const lowerRaw = raw.toLowerCase().trim();
          if (knownTranslations[lowerRaw]) {
            uzbekMeaning = knownTranslations[lowerRaw];
          } else {
            try {
              uzbekMeaning = await translateTextToUzbek(raw);
            } catch {
              uzbekMeaning = raw;
            }
          }
        } else {
          uzbekMeaning = raw;
          englishMeaning = '';
        }
      } else {
        englishMeaning = raw;
      }

      // 4. Format cards with pedagogical excellence (MANBA KERAK EMAS - EXCLUDED)
      const front = isJa
        ? vocab.reading
          ? `${vocab.word}\n【${vocab.reading}】`
          : vocab.word
        : vocab.word;

      let back = '';
      if (isJa) {
        if (uzbekMeaning && englishMeaning) {
          back = `📌 O'zbekcha: ${uzbekMeaning}\n🌐 English: ${englishMeaning}`;
        } else if (uzbekMeaning) {
          back = `📌 Ma'nosi: ${uzbekMeaning}`;
        } else {
          back = `📌 Ma'nosi: ${vocab.meaning}`;
        }
      } else {
        back = `📌 Ma'nosi: ${vocab.meaning}`;
      }

      if (vocab.example && vocab.example.trim()) {
        back += `\n\n💬 Misol: ${vocab.example.trim()}`;
      }

      // 4. Duplicate prevention: check if this word already exists in this deck
      const isAlreadyInDeck = flashcards?.some(
        (f) => f.subjectId === targetSubjectId && f.front.includes(vocab.word.trim()),
      );

      if (!isAlreadyInDeck) {
        await addFlashcardsBatch([
          {
            front,
            back,
            subjectId: targetSubjectId || undefined,
          },
        ]);
      }

      toast({
        title: '🎴 Fleshkartaga Saqlandi!',
        description: `"${vocab.word}" so'zi alohida "${targetDeckName}" albomiga muvaffaqiyatli saqlandi.`,
        action: (
          <button
            type="button"
            onClick={() => navigate(targetSubjectId ? `/decks?study=${targetSubjectId}` : '/decks')}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            Fleshkartani Ochish
          </button>
        ) as any,
      });
      return true;
    } catch (err) {
      console.error('handleAddVocabToFlashcards error:', err);
      toast({
        variant: 'destructive',
        title: 'Xatolik',
        description: "So'zni saqlashda xatolik yuz berdi.",
      });
      return false;
    }
  };

  const handleSendUserText = async (text: string) => {
    const cleanText = (text || '').trim();
    if (!cleanText || cleanText.length < 2) return;

    // Acoustic Echo Suppression: Discard microphone loopback of coach's own audio
    if (isAcousticEcho(cleanText, lastCoachSpokenTextRef.current)) {
      console.warn('[SpeakingCoach] Discarded acoustic speaker echo loopback:', cleanText);
      isProcessingRef.current = false;
      setIsThinking(false);
      setCurrentTranscript('');
      transcriptBufferRef.current = '';
      if (
        isLiveSessionRef.current &&
        isHandsFreeRef.current &&
        !isMuted &&
        !isSpeakingRef.current
      ) {
        setTimeout(() => {
          if (!isSpeakingRef.current && !isProcessingRef.current) {
            startListening();
          }
        }, 500);
      }
      return;
    }

    isProcessingRef.current = true;
    setIsThinking(true);
    setError(null);

    stopSpeaking();
    setIsSpeaking(false);

    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
      streamAbortControllerRef.current = null;
    }
    const abortController = new AbortController();
    streamAbortControllerRef.current = abortController;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: CoachChatMessage = { role: 'user', content: cleanText, timestamp: timeStr };
    const updatedHistory = [...chatHistoryRef.current, userMsg];

    setChatHistory(updatedHistory);
    chatHistoryRef.current = updatedHistory;

    try {
      let structured: CoachStructuredResponse;
      let streamedSentences = 0;
      let accumulatedSpeech = '';

      try {
        structured = await streamCoachDialogue(
          cleanText,
          updatedHistory.map((h) => ({ role: h.role, content: h.content })),
          languageRef.current,
          personaRef.current,
          activeScenarioRef.current,
          (sentence, index) => {
            if (abortController.signal.aborted) return;
            streamedSentences++;
            accumulatedSpeech += (accumulatedSpeech ? ' ' : '') + sentence;
            lastCoachSpokenTextRef.current = accumulatedSpeech;
            if (index === 0) {
              setIsThinking(false);
              const liveAiMsg: CoachChatMessage = {
                role: 'assistant',
                content: sentence,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              };
              setChatHistory((prev) => {
                const next = [...prev, liveAiMsg];
                chatHistoryRef.current = next;
                return next;
              });
            } else {
              setChatHistory((prev) => {
                const copy = [...prev];
                const lastIdx = copy.length - 1;
                if (lastIdx >= 0 && copy[lastIdx].role === 'assistant') {
                  copy[lastIdx] = { ...copy[lastIdx], content: accumulatedSpeech };
                }
                chatHistoryRef.current = copy;
                return copy;
              });
            }
            enqueueStreamSentence(sentence);
          },
          abortController.signal,
        );
        endStreamPlayback();
      } catch (streamErr: any) {
        if (abortController.signal.aborted || streamErr?.name === 'AbortError') {
          return;
        }
        console.warn(
          '[SpeakingCoach] Streaming dialogue failed, fallback to non-streaming:',
          streamErr,
        );
        stopSpeaking();
        structured = await converseWithCoachStructured(
          cleanText,
          updatedHistory.map((h) => ({ role: h.role, content: h.content })),
          languageRef.current,
          personaRef.current,
          undefined,
          activeScenarioRef.current,
        );
      }

      if (abortController.signal.aborted) {
        return;
      }

      let cleanReply = (structured.reply || '').trim();
      if (
        cleanReply.startsWith('{') &&
        (cleanReply.includes('"reply"') || cleanReply.includes('"language"'))
      ) {
        try {
          const parsed = JSON.parse(cleanReply);
          if (parsed && parsed.reply && typeof parsed.reply === 'string') {
            cleanReply = parsed.reply.trim();
          }
        } catch {
          const m = cleanReply.match(/"(?:reply|message|content|text)"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
          if (m) {
            cleanReply = m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
          }
        }
      }
      if (cleanReply.startsWith('{') && cleanReply.endsWith('}')) {
        cleanReply =
          languageRef.current === 'ja'
            ? 'はい、よく分かりました！続けて日本語でお話ししましょう。'
            : "Understood! Let's continue speaking practice.";
      }

      const aiMsg: CoachChatMessage = {
        role: 'assistant',
        content: cleanReply,
        romaji: structured.romaji,
        ttsText: structured.ttsText,
        correction: structured.correction,
        vocabulary: structured.vocabulary,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const finalHistory = [...updatedHistory, aiMsg];

      // Record structured micro-error for real-time live overlay & persist immediately to ErrorVault/MasteryEngine
      if (
        structured.correction &&
        (structured.correction.hasError ||
          Boolean(
            structured.correction.corrected && structured.correction.corrected.trim().length > 0,
          )) &&
        structured.correction.corrected
      ) {
        const errorTag: ErrorTag = {
          id: Math.random().toString(36).substring(2, 9),
          type: 'grammar',
          originalText: structured.correction?.original || cleanText,
          correction: structured.correction?.corrected || '',
          explanation: structured.correction?.explanation || '',
        };
        setLiveErrors((prev) => [errorTag, ...prev].slice(0, 10));

        ErrorVaultService.logErrors([
          {
            verbatim: structured.correction.original || cleanText,
            correction: structured.correction.corrected,
            explanation: structured.correction.explanation || '',
            category: 'grammar',
            language: languageRef.current,
          },
        ]);

        const activeUserId = user?.id || 'default-user';
        MasteryEngine.recordEvidence(activeUserId, languageRef.current, {
          id: `ev_spk_err_${Date.now()}`,
          skill: 'speaking',
          timestamp: new Date().toISOString(),
          score: 40,
          activityType: 'speaking',
          details: `Speaking error corrected: ${structured.correction.corrected}`,
        });
      } else {
        const extractedErrs = parseMicroErrors(structured.rawText || structured.reply);
        if (extractedErrs.length > 0) {
          setLiveErrors((prev) => [...extractedErrs, ...prev].slice(0, 10));
        } else {
          const activeUserId = user?.id || 'default-user';
          MasteryEngine.recordEvidence(activeUserId, languageRef.current, {
            id: `ev_spk_turn_${Date.now()}`,
            skill: 'speaking',
            timestamp: new Date().toISOString(),
            score: 90,
            activityType: 'speaking',
            details: `Clean speaking turn with ${personaRef.current} persona`,
          });
        }
      }

      if (streamedSentences > 0) {
        setChatHistory((prev) => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].role === 'assistant') {
            copy[lastIdx] = aiMsg;
          } else {
            copy.push(aiMsg);
          }
          chatHistoryRef.current = copy;
          return copy;
        });
      } else {
        setChatHistory(finalHistory);
        chatHistoryRef.current = finalHistory;
      }

      setIsThinking(false);
      isProcessingRef.current = false;

      // If no sentences were streamed (e.g. non-streaming fallback or unpunctuated reply), play TTS directly
      if (streamedSentences === 0) {
        let speechToPlay = structured.ttsText || extractSpeechAudioText(structured.reply);
        if (!speechToPlay && structured.correction?.hasError) {
          const jaAdvice = structured.correction.explanation
            ? `${structured.correction.explanation} ${structured.correction.corrected || ''}`
            : structured.correction.corrected || '';
          speechToPlay = language === 'ja' ? cleanJapaneseTTS(jaAdvice) : jaAdvice;
        }
        lastCoachSpokenTextRef.current = speechToPlay;
        if (speechToPlay) {
          speakText(speechToPlay);
        }
      }
    } catch (err: any) {
      if (abortController.signal.aborted || err?.name === 'AbortError') {
        return;
      }
      console.error('Coach response error:', err);
      let errorMessage = err.message || 'Tahlil qilishda xatolik yuz berdi.';
      if (errorMessage.startsWith('RATE_LIMIT: ')) {
        errorMessage = errorMessage.substring('RATE_LIMIT: '.length);
      }
      stopSpeaking();
      setIsSpeaking(false);
      setError(errorMessage);
      toast({ variant: 'destructive', title: '❌ AI Xatosi', description: errorMessage });
      setIsThinking(false);
      isProcessingRef.current = false;
    }
  };

  const getInitialGreeting = getCoachInitialGreeting;

  const handleResetChat = useCallback(() => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
      streamAbortControllerRef.current = null;
    }
    stopSpeaking();
    setIsSpeaking(false);
    setIsThinking(false);
    const currentScenario = activeScenarioRef.current || activeScenario;
    let greeting = getInitialGreeting(language, persona);
    if (currentScenario) {
      greeting =
        (language === 'en' ? currentScenario.opening_line_en : currentScenario.opening_line_ja) ||
        currentScenario.opening_line_ja ||
        currentScenario.opening_line_en ||
        "Hello! Let's start our conversation practice.";
    }
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const freshHistory: CoachChatMessage[] = [
      { role: 'assistant', content: greeting, timestamp: timeStr },
    ];
    setChatHistory(freshHistory);
    chatHistoryRef.current = freshHistory;
    const speechAudio = extractSpeechAudioText(greeting);
    lastCoachSpokenTextRef.current = speechAudio;
    unlockAudio();
    speakText(speechAudio);
  }, [language, persona, activeScenario, unlockAudio, speakText, stopSpeaking]);

  // Keyboard Accessibility Hotkeys (Space: Mic toggle, Escape: Barge-in, R: Reset chat)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);
      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        toggleMic();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (isSpeaking) {
          handleBargeIn();
        } else if (isListening) {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.abort();
            } catch {}
          }
        }
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleResetChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMic, handleBargeIn, handleResetChat, isSpeaking, isListening, recognitionRef]);

  const startSession = (topicTitle?: unknown) => {
    unlockAudio();
    setIsLiveSession(true);
    isLiveSessionRef.current = true;
    setCurrentTranscript('');
    setError(null);

    const cleanTopic =
      typeof topicTitle === 'string' &&
      topicTitle.trim().length > 0 &&
      !topicTitle.includes('[object')
        ? topicTitle.trim()
        : undefined;

    const currentScenario = activeScenarioRef.current || activeScenario;
    let greeting = getInitialGreeting(language, persona);
    if (currentScenario) {
      greeting =
        (language === 'en' ? currentScenario.opening_line_en : currentScenario.opening_line_ja) ||
        currentScenario.opening_line_ja ||
        currentScenario.opening_line_en ||
        "Hello! Let's start our conversation practice.";
    } else if (cleanTopic) {
      if (language === 'ja') {
        greeting = `こんにちは！「${cleanTopic}」ですね。準備ができたら話しかけてください！`;
      } else {
        greeting = `Hello! Let's practice with "${cleanTopic}". Feel free to speak whenever you are ready!`;
      }
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const initHistory: CoachChatMessage[] = [
      { role: 'assistant', content: greeting, timestamp: timeStr },
    ];

    setChatHistory(initHistory);
    chatHistoryRef.current = initHistory;

    const speechAudio = extractSpeechAudioText(greeting);
    lastCoachSpokenTextRef.current = speechAudio;
    speakText(speechAudio);
  };

  const endSession = async () => {
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
      streamAbortControllerRef.current = null;
    }
    const historyToAnalyze = [...chatHistoryRef.current];
    const durSecs = sessionSeconds;

    // Stop voice recording and retrieve recorded Blob
    const audioBlob = await voiceRecorder.stopRecording();

    setIsLiveSession(false);
    isLiveSessionRef.current = false;
    isProcessingRef.current = false;
    setIsSpeaking(false);
    setIsThinking(false);
    setCurrentTranscript('');
    transcriptBufferRef.current = '';
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    stopSpeaking();

    // Generate valid UUID for session record
    const sessionUuid: string =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`;

    // Upload audio file to Supabase Storage in the background (100% non-blocking)
    let uploadedAudioPath: string | undefined;
    if (audioBlob && audioBlob.size > 0 && user?.id) {
      try {
        const uploadResult = await AudioStorageService.uploadSpeakingAudio(
          user.id,
          sessionUuid || `rec_${Date.now()}`,
          audioBlob,
        );
        if (uploadResult) {
          uploadedAudioPath = uploadResult;
        }
      } catch (storageErr) {
        console.warn('[SpeakingCoachPage] Audio upload skipped (non-blocking):', storageErr);
      }
    }

    // Trigger AI analysis report if user sent any messages
    const userSpoke = historyToAnalyze.some((h) => h.role === 'user');
    if (userSpoke) {
      if (activeScenario) {
        // Scenario Evaluation Flow
        setIsScenarioReportOpen(true);
        setIsScenarioEvalLoading(true);
        try {
          const evalResult = await evaluateScenarioSession({
            scenario: activeScenario,
            chatHistory: historyToAnalyze.map((h) => ({ role: h.role, content: h.content })),
            durationSeconds: durSecs,
            recordedUrl: voiceRecorder.recordedUrl,
          });

          evalResult.transcript = historyToAnalyze.map((h) => ({
            role: h.role,
            content: h.content,
            timestamp: h.timestamp,
            translation: h.translation,
          }));
          evalResult.audio_path = uploadedAudioPath;
          evalResult.audio_url = uploadedAudioPath;
          if (sessionUuid) {
            evalResult.id = sessionUuid;
          }

          setScenarioEvalResult(evalResult);
          await ScenarioService.saveSessionResult(evalResult, user?.id);
        } catch (err) {
          console.error('Scenario evaluation error:', err);
        } finally {
          setIsScenarioEvalLoading(false);
        }
      } else {
        // Standard Speaking Coach Report Flow
        setIsReportOpen(true);
        setIsReportLoading(true);
        try {
          const report = await analyzeSpeakingSession(
            historyToAnalyze.map((h) => ({ role: h.role, content: h.content })),
            languageRef.current,
            personaRef.current,
          );
          setReportData(report);

          if (report.grammar_corrections && report.grammar_corrections.length > 0) {
            ErrorVaultService.logErrors(
              report.grammar_corrections.map((c) => ({
                verbatim: c.original,
                correction: c.corrected,
                category: 'grammar',
                explanation: c.explanation,
                language: languageRef.current,
              })),
            );
          }

          const personaTitle = PERSONAS_BY_LANG[languageRef.current][personaRef.current].name;
          const fluency = report.fluency_score || 75;
          const vocab = Math.max(0, 100 - (report.better_vocabulary?.length || 0) * 5);
          const grammar = Math.max(0, 100 - (report.grammar_corrections?.length || 0) * 5);
          const overall = Math.round((fluency + vocab + grammar) / 3);

          await addCoachSession({
            personaTitle,
            fluencyScore: fluency,
            vocabularyScore: vocab,
            grammarScore: grammar,
            pronunciationScore: fluency,
            feedback: report.overall_feedback || '',
          });

          // Save session with transcript into Supabase speaking_sessions
          await ScenarioService.saveSessionResult(
            {
              id: sessionUuid,
              scenario_id: 'general_speaking',
              scenario_title: personaTitle,
              fluency_score: fluency,
              vocabulary_score: vocab,
              grammar_score: grammar,
              pronunciation_score: fluency,
              overall_score: overall,
              duration_seconds: durSecs,
              audio_path: uploadedAudioPath,
              audio_url: uploadedAudioPath,
              ai_feedback: report.overall_feedback || 'Bajarildi',
              key_phrases_used: [],
              key_phrases_missed: [],
              transcript: historyToAnalyze.map((h) => ({
                role: h.role,
                content: h.content,
                timestamp: h.timestamp,
                translation: h.translation,
              })),
              created_at: new Date().toISOString(),
            },
            user?.id,
          );
        } catch (err) {
          console.error('Report generation error:', err);
        } finally {
          setIsReportLoading(false);
        }
      }
    }
  };

  const toggleSession = () => {
    if (isLiveSession) {
      endSession();
    } else {
      startSession();
    }
  };

  const handleTranslateMessage = async (idx: number) => {
    const msg = chatHistory[idx];
    if (!msg || msg.role !== 'assistant') return;

    if (msg.translation) {
      setChatHistory((prev) =>
        prev.map((m, i) => (i === idx ? { ...m, showTranslation: !m.showTranslation } : m)),
      );
      return;
    }

    setChatHistory((prev) => prev.map((m, i) => (i === idx ? { ...m, isTranslating: true } : m)));

    try {
      const trans = await translateTextToUzbek(msg.content);
      setChatHistory((prev) =>
        prev.map((m, i) =>
          i === idx ? { ...m, translation: trans, showTranslation: true, isTranslating: false } : m,
        ),
      );
    } catch (err) {
      console.error('Translation failed:', err);
      setChatHistory((prev) =>
        prev.map((m, i) => (i === idx ? { ...m, isTranslating: false } : m)),
      );
    }
  };

  const handlePromptClick = (topicTitle: string) => {
    startSession(topicTitle);
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  useEffect(() => {
    if (!isAdmin && language === 'ja' && persona === 'interview') {
      setPersona('casual');
    }
  }, [isAdmin, language, persona]);

  // Auto-scroll chat container to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isThinking]);

  const PERSONAS = PERSONAS_BY_LANG[language];
  const PROMPT_SUGGESTIONS = PROMPT_SUGGESTIONS_BY_LANG[language];
  const currentPersona = PERSONAS[persona];

  return (
    <div
      ref={containerRef}
      onTouchStart={() => unlockAudio()}
      className={`pb-safe relative flex h-[100dvh] w-full select-none flex-col overflow-hidden ${
        isFullscreen ? 'fixed inset-0 z-50 m-0 h-screen w-screen bg-background p-0' : ''
      }`}
    >
      {/* Dynamic Ambient Background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${currentPersona.gradientBg} pointer-events-none transition-all duration-1000`}
      />
      <div className="pointer-events-none absolute left-0 top-0 -z-10 h-full w-full overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] animate-pulse rounded-full bg-primary/10 blur-[120px]" />
        <div
          className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-[#C9A961]/10 blur-[120px]"
          style={{ animationDelay: '2s' }}
        />
        {isLiveSession && (
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-primary/5 blur-[150px]" />
        )}
      </div>

      {/* TOP BAR */}
      <CoachTopBar
        language={language}
        persona={persona}
        isLiveSession={isLiveSession}
        sessionSeconds={sessionSeconds}
        chatHistoryLength={chatHistory.length}
        showPersonaSelector={showPersonaSelector}
        setShowPersonaSelector={setShowPersonaSelector}
        handleLanguageChange={handleLanguageChange}
        setPersona={setPersona}
        targetBand={targetBand}
        setTargetBand={setTargetBand}
        isPaidUser={isPaidUser}
        isAdmin={isAdmin}
        isSuperAdmin={isSuper}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onOpenSettings={() => setIsSettingsOpen(true)}
        formatTimer={formatTimer}
        activeScenario={activeScenario}
        speechSpeed={speechSpeed}
        onSpeedChange={setSpeechSpeed}
      />

      {/* Active Conversation Scenario Banner */}
      {activeScenario && (
        <div className="z-10 mx-3 mt-1.5 flex shrink-0 items-center justify-between gap-4 rounded-2xl border border-border bg-card p-3 text-foreground shadow-md backdrop-blur-md animate-in fade-in md:mx-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-xl border border-border bg-muted p-2 text-xl">
              {activeScenario.emoji}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-xs font-bold tracking-tight text-foreground">
                  {(activeScenario.language === 'en'
                    ? activeScenario.title_en
                    : activeScenario.title_ja) ||
                    activeScenario.title_en ||
                    activeScenario.title_ja}{' '}
                  ({activeScenario.title_uz})
                </span>
                <span className="rounded-full border border-[#C9A961]/30 bg-[#C9A961]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#C9A961]">
                  {activeScenario.language === 'en' ? 'CEFR / ' : 'JLPT '}
                  {activeScenario.difficulty}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {activeScenario.description_uz}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setSearchParams({ lang: language });
            }}
            className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-border bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition-all hover:bg-muted/80 hover:text-foreground"
            title="Ssenariydan chiqish"
          >
            <X size={13} />
            <span className="hidden sm:inline">Chiqish</span>
          </button>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mx-3 mb-2 flex items-center justify-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-center text-xs text-rose-600 backdrop-blur-sm animate-in fade-in dark:text-rose-400 md:mx-5">
          <ShieldAlert size={14} />
          <span className="font-medium">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 rounded-md p-0.5 hover:bg-rose-500/20"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="relative mx-3 mb-2 flex min-h-0 flex-1 flex-col overflow-hidden md:mx-5">
        {chatHistory.length === 0 && !isLiveSession ? (
          <div className="flex-1 space-y-6 overflow-y-auto pr-1">
            <CoachWelcomeScreen
              currentPersona={currentPersona}
              isLiveSession={isLiveSession}
              isSpeaking={isSpeaking}
              isThinking={isThinking}
              isListening={isListening}
              promptSuggestions={PROMPT_SUGGESTIONS}
              onStartSession={() => startSession()}
              onPromptClick={handlePromptClick}
            />
            <div className="mx-auto max-w-2xl pb-8">
              <CoachProgressDashboard />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-2.5 overflow-hidden sm:gap-4">
            <RealtimeVoiceOverlay
              isRecording={isListening}
              isAiSpeaking={isSpeaking}
              audioVolume={audioVolume}
              transcript={currentTranscript}
              errors={liveErrors}
              activeCefrLevel="B2"
              activeJlptLevel={language === 'ja' ? 'N3' : undefined}
              isHandsFree={isHandsFree}
              onToggleHandsFree={() => setIsHandsFree((prev) => !prev)}
              onBargeIn={handleBargeIn}
              onToggleRecording={toggleMic}
              onCommitNow={commitSpeechNow}
              onSpeakText={speakText}
            />
            <CoachChatArea
              chatHistory={chatHistory}
              isLiveSession={isLiveSession}
              currentPersona={currentPersona}
              currentTranscript={currentTranscript}
              isListening={isListening}
              isThinking={isThinking}
              copiedIndex={copiedIndex}
              chatContainerRef={chatContainerRef}
              handleTranslateMessage={handleTranslateMessage}
              copyToClipboard={copyToClipboard}
              speakText={speakText}
              setChatHistory={setChatHistory}
              onAddVocabulary={handleAddVocabToFlashcards}
              onInspectPitch={handleInspectPitch}
              activeScenario={activeScenario}
              onSelectHint={handleSendUserText}
            />
          </div>
        )}
      </div>

      {/* BOTTOM CONTROL DOCK */}
      <CoachControlBar
        isLiveSession={isLiveSession}
        isSpeaking={isSpeaking}
        isThinking={isThinking}
        isListening={isListening}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        sessionSeconds={sessionSeconds}
        chatHistoryLength={chatHistory.length}
        toggleSession={toggleSession}
        onClearHistory={handleResetChat}
        formatTimer={formatTimer}
        onForceStartListening={toggleMic}
        isHandsFree={isHandsFree}
        onToggleHandsFree={() => setIsHandsFree((prev) => !prev)}
        onBargeIn={handleBargeIn}
        isPreparingAudio={isPreparingAudio}
      />

      {/* SETTINGS MODAL */}
      <CoachSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* SESSION REPORT MODAL */}
      <SessionReportModal
        isOpen={isReportOpen}
        onClose={() => {
          setIsReportOpen(false);
          setChatHistory([]);
          chatHistoryRef.current = [];
        }}
        report={reportData}
        isLoading={isReportLoading}
        personaTitle={PERSONAS[persona].name}
      />

      {/* SCENARIO EVALUATION REPORT MODAL */}
      <ScenarioReportModal
        isOpen={isScenarioReportOpen}
        onClose={() => {
          setIsScenarioReportOpen(false);
          setChatHistory([]);
          chatHistoryRef.current = [];
        }}
        result={scenarioEvalResult}
        isLoading={isScenarioEvalLoading}
        recordedUrl={voiceRecorder.recordedUrl}
        durationSeconds={voiceRecorder.durationSeconds}
        isPlayingRecorded={voiceRecorder.isPlaying}
        audioProgressRecorded={voiceRecorder.audioProgress}
        onPlayRecorded={voiceRecorder.playRecorded}
        onPauseRecorded={voiceRecorder.pauseRecorded}
        onRetry={() => startSession()}
      />

      {/* PITCH ACCENT MODAL */}
      <PitchAccentModal
        isOpen={!!inspectingPitch}
        onClose={() => setInspectingPitch(null)}
        accentInfo={inspectingPitch}
      />
    </div>
  );
};

export default SpeakingCoachPage;
