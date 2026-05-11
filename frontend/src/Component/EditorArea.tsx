import React from 'react';

interface EditorAreaProps {
  question: string;
  essay: string;
  imageUrl?: string;
  isPracticeMode?: boolean;
  setQuestion: (val: string) => void;
  setEssay: (val: string) => void;
  inputMode: 'text' | 'upload';
  setInputMode: (mode: 'text' | 'upload') => void;
  onSubmit: () => void;
}

const EditorArea: React.FC<EditorAreaProps> = ({
  question,
  essay,
  imageUrl,
  isPracticeMode = false,
  setQuestion,
  setEssay,
  inputMode,
  setInputMode,
  onSubmit
}) => {
  const [isRephrasing, setIsRephrasing] = React.useState(false);
  const [rephraseData, setRephraseData] = React.useState<{
    original: string,
    improved: string,
    start: number,
    end: number,
    selectionWidth: number
  } | null>(null);
  const [popupPos, setPopupPos] = React.useState({ top: 0, left: 0 });
  const [isApplied, setIsApplied] = React.useState(false);
  
  // Track all upgraded sentences with their original versions
  const [upgradedMap, setUpgradedMap] = React.useState<Map<string, string>>(new Map());
  const [hoveredSentence, setHoveredSentence] = React.useState<{
    improved: string,
    original: string,
    top: number,
    left: number
  } | null>(null);
  
  const isHoveringPopup = React.useRef(false);
  const hoverTimeout = React.useRef<NodeJS.Timeout | null>(null);
  
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  // Sync scroll between textarea and highlight overlay
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (overlayRef.current) {
      overlayRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Detect hover over highlighted text using pointer-events trick
  const handleMouseMove = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (!textareaRef.current || !overlayRef.current || isHoveringPopup.current) return;

    const textarea = textareaRef.current;
    const { clientX, clientY } = e;

    // Temporarily disable pointer events to see what's behind
    textarea.style.pointerEvents = 'none';
    const elementBehind = document.elementFromPoint(clientX, clientY);
    textarea.style.pointerEvents = 'auto';

    if (elementBehind && elementBehind.tagName === 'MARK') {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
      
      const improved = elementBehind.textContent || '';
      const original = upgradedMap.get(improved);
      if (original) {
        const rect = elementBehind.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (containerRect) {
          setHoveredSentence({
            improved,
            original,
            top: rect.top - containerRect.top - 10,
            left: rect.left - containerRect.left + rect.width / 2
          });
        }
      }
    } else {
      // Small delay before closing to allow moving mouse to the popup
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
      hoverTimeout.current = setTimeout(() => {
        if (!isHoveringPopup.current) {
          setHoveredSentence(null);
        }
      }, 100);
    }
  };

  // Helper to highlight multiple sentences in text
  const renderHighlightedText = (text: string) => {
    if (upgradedMap.size === 0) return text;
    
    const sortedSentences = Array.from(upgradedMap.keys()).sort((a, b) => b.length - a.length);
    const escaped = sortedSentences.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'g');
    
    const parts = text.split(regex);
    return parts.map((part, i) => 
      upgradedMap.has(part) ? (
        <mark key={i} className="bg-emerald-400/25 text-transparent rounded-sm px-0 border-b-2 border-emerald-500/40 pointer-events-auto cursor-help">
          {part}
        </mark>
      ) : part
    );
  };

  // Perfect helper to get coordinates relative to container
  const getSelectionMetrics = (element: HTMLTextAreaElement, container: HTMLDivElement) => {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    
    const div = document.createElement('div');
    const style = window.getComputedStyle(element);
    
    const props = [
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
      'fontFamily', 'fontSize', 'lineHeight', 'fontWeight', 'whiteSpace', 'wordBreak', 'width'
    ];
    
    props.forEach(prop => {
      // @ts-ignore
      div.style[prop] = style[prop];
    });
    
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.boxSizing = 'border-box';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    
    const value = element.value;
    div.textContent = value.substring(0, start);
    
    const span = document.createElement('span');
    span.textContent = value.substring(start, end) || '.';
    div.appendChild(span);
    
    document.body.appendChild(div);
    
    // Position of span in mirror div
    const spanOffsetTop = span.offsetTop;
    const spanOffsetLeft = span.offsetLeft;
    const width = span.offsetWidth;
    
    document.body.removeChild(div);

    // Get textarea position relative to container
    const textareaRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    
    const relativeTextareaTop = textareaRect.top - containerRect.top;
    const relativeTextareaLeft = textareaRect.left - containerRect.left;

    // Final position: textarea relative + span relative - scroll
    const top = relativeTextareaTop + spanOffsetTop - element.scrollTop;
    const left = relativeTextareaLeft + spanOffsetLeft - element.scrollLeft;
    
    return { top, left, width };
  };

  const handleUpgrade = async () => {
    if (!textareaRef.current || !containerRef.current) return;

    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = essay.substring(start, end).trim();

    if (!selectedText || start === end) {
      alert("Vui lòng bôi đen câu hoặc đoạn văn bạn muốn nâng cấp.");
      return;
    }

    const metrics = getSelectionMetrics(textareaRef.current, containerRef.current);
    setPopupPos({ top: metrics.top - 10, left: metrics.left });

    setIsRephrasing(true);
    setRephraseData(null);
    setIsApplied(false);

    try {
      const response = await fetch('http://localhost:8000/api/rephrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: selectedText }),
      });
      
      if (!response.ok) throw new Error("Failed to rephrase");
      
      const data = await response.json();
      setRephraseData({
        original: selectedText,
        improved: data.improved,
        start,
        end,
        selectionWidth: metrics.width
      });
    } catch (error) {
      console.error(error);
      alert("Lỗi khi kết nối server nâng cấp câu.");
    } finally {
      setIsRephrasing(false);
    }
  };

  const applyUpgrade = () => {
    if (!rephraseData || !textareaRef.current) return;
    const { original, improved, start } = rephraseData;
    const end = rephraseData.end;
    
    const newEssay = essay.substring(0, start) + improved + essay.substring(end);
    setEssay(newEssay);
    setIsApplied(true);
    
    // Add to persistent highlighting map with original version
    setUpgradedMap(prev => new Map(prev).set(improved, original));
    
    // Highlight the new text (temporary selection)
    const newEnd = start + improved.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, newEnd);
      }
    }, 0);
    
    // Auto-close popup
    setRephraseData(null);
  };

  const previewOriginal = () => {
    if (!rephraseData || !textareaRef.current) return;
    const { original, improved, start, end } = rephraseData;
    const newEssay = essay.substring(0, start) + original + essay.substring(end);
    setEssay(newEssay);
    setIsApplied(false);
    
    // Remove from persistent highlighting map
    setUpgradedMap(prev => {
      const next = new Map(prev);
      next.delete(improved);
      return next;
    });

    // Highlight original text
    const newEnd = start + original.length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, newEnd);
      }
    }, 0);
    
    // Update data for next potential apply
    setRephraseData({ ...rephraseData, end: newEnd });
  };

  const revertToOriginal = (improved: string, original: string) => {
    // Literal replacement using split/join to avoid regex $ issues
    const parts = essay.split(improved);
    if (parts.length > 1) {
      const newEssay = parts.join(original);
      setEssay(newEssay);
      
      setUpgradedMap(prev => {
        const next = new Map(prev);
        next.delete(improved);
        return next;
      });
    }
    setHoveredSentence(null);
    isHoveringPopup.current = false;
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
  };

  return (
    <div ref={containerRef} className="card-premium animate-fade-in relative">
      {/* Hover Preview Button */}
      {hoveredSentence && (
        <div 
          className="absolute z-[110] animate-in fade-in zoom-in duration-200 pointer-events-auto"
          style={{ 
            top: `${hoveredSentence.top}px`, 
            left: `${hoveredSentence.left}px`,
            transform: 'translate(-50%, -100%)' 
          }}
          onMouseEnter={() => {
            isHoveringPopup.current = true;
            if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
          }}
          onMouseLeave={() => {
            isHoveringPopup.current = false;
            setHoveredSentence(null);
          }}
        >
          <div className="bg-slate-800 text-white p-3 rounded-xl shadow-2xl border border-slate-700 w-[280px]">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bản gốc:</div>
            <p className="text-[11px] leading-relaxed italic text-slate-200 mb-2">"{hoveredSentence.original}"</p>
            <button 
              onClick={() => revertToOriginal(hoveredSentence.improved, hoveredSentence.original)}
              className="w-full py-1.5 bg-primary hover:bg-primary/90 text-white text-[10px] font-bold rounded-lg transition-all"
            >
              Revert to Original
            </button>
          </div>
          <div className="w-2 h-2 bg-slate-800 rotate-45 mx-auto -mt-1"></div>
        </div>
      )}
      {/* Rephrase Popup */}
      {rephraseData && (
        <div 
          className="absolute z-[100] animate-in slide-in-from-bottom-2 fade-in duration-300 pointer-events-none"
          style={{ 
            top: `${popupPos.top}px`, 
            left: `${popupPos.left}px`,
            transform: 'translateY(-100%)',
            width: `${Math.max(rephraseData.selectionWidth, 320)}px`,
            maxWidth: '500px'
          }}
        >
          <div className="bg-white/95 backdrop-blur-2xl border border-primary/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl p-4 pointer-events-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse"></span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI SUGGESTION</span>
              </div>
              <button onClick={() => setRephraseData(null)} className="text-slate-300 hover:text-slate-500 transition-colors">
                <i className="fas fa-times text-xs"></i>
              </button>
            </div>
            
            <p className="text-sm text-slate-700 leading-relaxed font-medium bg-slate-50/50 p-3 rounded-xl border border-slate-100 mb-3">
              {isApplied ? (
                <span className="text-slate-400 line-through mr-2">{rephraseData.original}</span>
              ) : null}
              <span className="text-primary font-bold">
                {rephraseData.improved}
              </span>
            </p>

            <div className="flex gap-2">
              <button 
                onClick={applyUpgrade}
                className="flex-1 py-1.5 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary/90 transition-all active:scale-95"
              >
                Apply
              </button>
              <button 
                onClick={() => setRephraseData(null)}
                className="flex-1 py-1.5 bg-white text-slate-500 border border-slate-200 text-[11px] font-bold rounded-lg hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
          <div className="w-3 h-3 bg-white border-r border-b border-primary/10 rotate-45 ml-6 -mt-1.5 shadow-sm"></div>
        </div>
      )}

      <div className="px-8 py-5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
        {!isPracticeMode && (
          <div className="flex bg-white p-1 rounded-xl shadow-inner border border-slate-200">
            <button 
              onClick={() => setInputMode('text')}
              className={`px-6 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
                inputMode === 'text' 
                  ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Nhập liệu Text
            </button>
            <button 
              onClick={() => setInputMode('upload')}
              className={`px-6 py-2 text-xs font-bold rounded-lg transition-all duration-300 ${
                inputMode === 'upload' 
                  ? 'bg-white text-primary shadow-sm ring-1 ring-slate-200' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Tải ảnh OCR
            </button>
          </div>
        )}
        <div className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">
          Khung soạn thảo
        </div>
      </div>

      <div className="p-8">
        <div className="flex flex-col gap-6">
          <div>
            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block mb-3 ml-1">
              Đề bài (Question Prompt)
            </label>
            <textarea 
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={`input-premium min-h-[100px] text-sm leading-relaxed ${imageUrl ? 'mb-4' : ''}`}
              placeholder="Dán đề bài IELTS của bạn vào đây..."
            />
            {imageUrl && (
              <div className="mb-4 text-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <img src={imageUrl} alt="Task Image" className="max-w-full max-h-[350px] mx-auto rounded-lg" />
              </div>
            )}
          </div>
          <div className="relative group">
            <label className="text-[12px] font-bold text-slate-500 uppercase tracking-wider block mb-3 ml-1">
              Bài viết của bạn (Essay Content)
            </label>
            <div className="relative min-h-[350px]">
              {/* Highlight Overlay Layer */}
              <div 
                ref={overlayRef}
                className="absolute inset-0 pointer-events-none p-4 text-sm leading-relaxed whitespace-pre-wrap break-words text-transparent font-sans border border-transparent overflow-hidden"
                style={{ 
                  fontFamily: 'inherit',
                  padding: '1rem', // Match textarea padding (p-4 = 1rem)
                  lineHeight: '1.625', // Standard leading-relaxed
                }}
              >
                {renderHighlightedText(essay)}
              </div>
              
              <textarea 
                ref={textareaRef}
                value={essay}
                onChange={(e) => setEssay(e.target.value)}
                onScroll={handleScroll}
                onMouseMove={handleMouseMove}
                className="input-premium min-h-[350px] text-sm leading-relaxed relative z-[1] custom-scrollbar"
                placeholder="Bắt đầu viết bài của bạn hoặc tải ảnh để trích xuất tự động..."
                spellCheck="false"
                style={{
                  backgroundColor: 'transparent',
                  caretColor: '#334155'
                }}
              />
            </div>
            
            {isRephrasing && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center rounded-2xl z-10">
                <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl shadow-xl border border-slate-100">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-bold text-slate-700">Đang nâng cấp câu...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-4 justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 mr-2 uppercase">Words</span>
            <span className="text-sm font-bold text-slate-800">{wordCount}</span>
          </div>
          
          <div className="h-8 w-[1px] bg-slate-200 mx-1"></div>

          <button 
            onClick={handleUpgrade}
            disabled={isRephrasing}
            className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold transition-all hover:bg-primary hover:text-white"
          >
            <i className="fas fa-magic text-[10px]"></i>
            Upgrade
          </button>
        </div>
        
        {!isPracticeMode && (
          <button 
            onClick={onSubmit}
            className="btn-premium group"
          >
            <span>Chấm điểm bài làm</span>
            <i className="fas fa-arrow-right text-xs group-hover:translate-x-1 transition-transform"></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default EditorArea;
