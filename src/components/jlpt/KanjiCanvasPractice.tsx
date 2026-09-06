import React, { useRef, useState, useEffect } from 'react';
import { Trash2, HelpCircle, Eye, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';

interface KanjiPracticeItem {
  kanji: string;
  meaning: string;
  meaningJa?: string;
  strokesCount: number;
  strokePaths: string[]; // Mock relative coordinates for stroke simulation
}

const KANJI_PRACTICE_LIST: KanjiPracticeItem[] = [
  {
    kanji: '日',
    meaning: 'Kun, Quyosh (Sun/Day)',
    meaningJa: '太陽・日・日付・毎日 (ひ / にち)',
    strokesCount: 4,
    strokePaths: [
      'M 30,20 L 30,80', // 1st stroke: left vertical
      'M 30,20 L 70,20 L 70,80', // 2nd stroke: top & right
      'M 30,50 L 70,50', // 3rd stroke: middle horizontal
      'M 30,80 L 70,80', // 4th stroke: bottom horizontal
    ],
  },
  {
    kanji: '本',
    meaning: 'Kitob, Asos (Book/Origin)',
    meaningJa: 'もと・書籍・基本・日本 (ほん / もと)',
    strokesCount: 5,
    strokePaths: [
      'M 20,40 L 80,40', // 1st stroke: main horizontal
      'M 50,15 L 50,80', // 2nd stroke: main vertical
      'M 50,40 L 25,75', // 3rd stroke: left slant
      'M 50,40 L 75,75', // 4th stroke: right slant
      'M 35,58 L 65,58', // 5th stroke: cross horizontal line
    ],
  },
  {
    kanji: '人',
    meaning: 'Odam (Person)',
    meaningJa: 'ひと・人間・人類 (ひと / じん / にん)',
    strokesCount: 2,
    strokePaths: [
      'M 50,20 L 25,80', // 1st stroke: left slant
      'M 45,45 L 75,80', // 2nd stroke: right slant
    ],
  },
];

export const KanjiCanvasPractice: React.FC = () => {
  const { language } = useLanguage();
  const isJa = language === 'ja';
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showGuides, setShowGuides] = useState(true);
  const [animationActive, setAnimationActive] = useState(false);
  const [currentStrokeAnim, setCurrentStrokeAnim] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const activeKanji = KANJI_PRACTICE_LIST[currentIndex];

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size configuration
    canvas.width = 300;
    canvas.height = 300;
    canvas.style.width = '300px';
    canvas.style.height = '300px';
    canvas.style.maxWidth = '100%';
    canvas.style.touchAction = 'none';

    const context = canvas.getContext('2d');
    if (!context) return;

    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = 'var(--foreground)'; // adaptive dark/light stroke
    context.lineWidth = 6;
    contextRef.current = context;

    clearCanvas();
  }, [currentIndex]);

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!contextRef.current || !canvasRef.current) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current || !canvasRef.current) return;

    let clientX, clientY;
    if ('touches' in e) {
      // Prevent scrolling on mobile while writing
      e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw crosshair grid lines for writing guidance
    context.strokeStyle = '#e2e8f0'; // light gray for grid lines
    context.lineWidth = 1;
    context.setLineDash([5, 5]);

    // Horizontal center
    context.beginPath();
    context.moveTo(0, canvas.height / 2);
    context.lineTo(canvas.width, canvas.height / 2);
    context.stroke();

    // Vertical center
    context.beginPath();
    context.moveTo(canvas.width / 2, 0);
    context.lineTo(canvas.width / 2, canvas.height);
    context.stroke();

    // Reset brush settings
    context.setLineDash([]);
    context.strokeStyle = '#E8483A'; // Hanko Vermillion signature brush
    context.lineWidth = 6;
  };

  // Playback Stroke-by-Stroke order animation
  const animateStrokes = () => {
    if (animationActive) return;
    setAnimationActive(true);
    clearCanvas();

    let currentStroke = 0;
    const total = activeKanji.strokePaths.length;

    const drawNext = () => {
      if (currentStroke >= total) {
        setAnimationActive(false);
        setCurrentStrokeAnim(null);
        return;
      }
      setCurrentStrokeAnim(currentStroke + 1);

      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!canvas || !context) return;

      // Draw current stroke with vermillion guidelines
      context.strokeStyle = '#E8483A'; // Hanko brush for active simulation stroke
      context.lineWidth = 5;

      const pathData = activeKanji.strokePaths[currentStroke];
      // Basic parsing of absolute coordinates (e.g. M 30,20 L 30,80)
      const commands = pathData.split(' ');

      context.beginPath();
      let cIdx = 0;
      while (cIdx < commands.length) {
        const cmd = commands[cIdx];
        if (cmd === 'M') {
          const [x, y] = commands[cIdx + 1].split(',').map(Number);
          context.moveTo(x * 3, y * 3); // Scale up to 300px (data is in 100px base)
          cIdx += 2;
        } else if (cmd === 'L') {
          const [x, y] = commands[cIdx + 1].split(',').map(Number);
          context.lineTo(x * 3, y * 3);
          cIdx += 2;
        } else {
          cIdx++;
        }
      }
      context.stroke();

      currentStroke++;
      setTimeout(drawNext, 1000); // 1s interval per stroke
    };

    drawNext();
  };

  return (
    <div className="max-w-full space-y-6 overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-xs sm:p-6">
      <div className="flex items-center gap-2.5 border-b border-border pb-3">
        <div className="rounded-xl border border-border bg-muted p-2 text-[#C9A961]">
          <Sparkles size={18} />
        </div>
        <div>
          <h3 className="font-display text-sm font-black text-foreground">
            {isJa ? 'インタラクティブ漢字書き順トレーナー' : 'Interactive Kanji Stroke Writer'}
          </h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {isJa
              ? '筆順アニメーションとガイド付きで漢字の書き順を正確に習得できます。'
              : "Yaponcha iyerogliflarni to'g'ri chizish ketma-ketligi (Canvas yordamida)."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
        {/* Canvas Area */}
        <div className="flex max-w-full flex-col items-center space-y-3">
          <div className="relative max-w-full overflow-hidden rounded-2xl border border-border bg-muted/20 shadow-inner">
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="block max-w-full cursor-crosshair bg-transparent"
            />

            {/* Background guide template */}
            {showGuides && !animationActive && (
              <div className="pointer-events-none absolute inset-0 flex select-none items-center justify-center opacity-10">
                <span className="font-japanese text-[180px] font-light text-muted-foreground">
                  {activeKanji.kanji}
                </span>
              </div>
            )}
          </div>

          {/* Canvas Controls */}
          <div className="flex max-w-full flex-wrap justify-center gap-2">
            <Button
              onClick={clearCanvas}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-muted/60 px-3 py-2 text-xs text-foreground hover:bg-muted"
            >
              <Trash2 size={14} />
              {isJa ? 'クリア' : 'Tozalash'}
            </Button>
            <Button
              onClick={() => setShowGuides((prev) => !prev)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs ${
                showGuides
                  ? 'border-amber-500/30 bg-amber-500/10 text-[#C9A961]'
                  : 'border-border bg-muted/60 text-muted-foreground'
              }`}
            >
              <Eye size={14} />
              {isJa ? 'ガイド線' : 'Qoliplar'}
            </Button>
            <Button
              onClick={animateStrokes}
              disabled={animationActive}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              <HelpCircle size={14} />
              {isJa ? '書き順再生' : "Tartibni Ko'rish"}
            </Button>
          </div>
        </div>

        {/* Info & Navigation */}
        <div className="space-y-4">
          <div className="space-y-2 rounded-2xl border border-border bg-muted/30 p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#C9A961]">
              {isJa ? '選択中の漢字' : 'Aktiv iyeroglif'}
            </span>
            <h4 className="font-japanese text-3xl font-black text-foreground">
              {activeKanji.kanji}
            </h4>
            <p className="text-xs font-semibold text-muted-foreground">
              {isJa
                ? `意味・用例: ${activeKanji.meaningJa || activeKanji.meaning}`
                : `Ma'nosi: ${activeKanji.meaning}`}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isJa
                ? `総画数: ${activeKanji.strokesCount} 画`
                : `Chiziqlar soni: ${activeKanji.strokesCount} ta`}
            </p>
            {currentStrokeAnim && (
              <span className="block animate-pulse text-[10px] font-extrabold text-[#E8483A]">
                {isJa
                  ? `✍️ アニメーション: 第 ${currentStrokeAnim} 画 / 全 ${activeKanji.strokesCount} 画`
                  : `✍️ Animatsiya: Chiziq ${currentStrokeAnim} / ${activeKanji.strokesCount}`}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {KANJI_PRACTICE_LIST.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`font-japanese rounded-xl border py-3.5 text-base font-black transition-all ${
                  currentIndex === idx
                    ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                    : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                {item.kanji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
export default KanjiCanvasPractice;
