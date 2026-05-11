import React from 'react';
import type { ScoreResult } from '../types';

interface ResultCardProps {
  results: ScoreResult | null;
  onClose?: () => void;
  isInline?: boolean;
}

const renderHeatmap = (results: ScoreResult) => {
  if (!results.heatmap || results.heatmap.length === 0) return results.essay_text;

  let text = results.essay_text;
  const heatmap = [...results.heatmap];
  
  // Sort by length of snippet descending to avoid partial matches
  heatmap.sort((a, b) => b.original_snippet.length - a.original_snippet.length);

  const parts: (string | JSX.Element)[] = [text];

  heatmap.forEach((item, index) => {
    const { original_snippet, target_text, type, suggestion, reason_vi } = item;
    if (!original_snippet) return;

    for (let i = 0; i < parts.length; i++) {
      if (typeof parts[i] === 'string') {
        const content = parts[i] as string;
        const snippetIndex = content.indexOf(original_snippet);
        
        if (snippetIndex !== -1) {
          const before = content.substring(0, snippetIndex);
          const after = content.substring(snippetIndex + original_snippet.length);
          
          // Use provided target_text or fallback to the whole original_snippet
          let effectiveTarget = target_text;
          let highlightIndex = effectiveTarget ? original_snippet.indexOf(effectiveTarget) : -1;
          
          if (highlightIndex === -1) {
            effectiveTarget = original_snippet;
            highlightIndex = 0;
          }
          
          const sBefore = original_snippet.substring(0, highlightIndex);
          const sHighlight = original_snippet.substring(highlightIndex, highlightIndex + effectiveTarget.length);
          const sAfter = original_snippet.substring(highlightIndex + effectiveTarget.length);
          
          const typeLabel = type === 'GRA' ? 'Grammar' : (type === 'LR' ? 'Vocabulary' : 'Cohesion');
          const colorClass = 
            type === 'GRA' ? 'bg-rose-500/15 text-rose-700 border-rose-300' :
            type === 'LR' ? 'bg-amber-500/15 text-amber-700 border-amber-300' :
            'bg-emerald-500/15 text-emerald-700 border-emerald-300';

          const dotClass = 
            type === 'GRA' ? 'bg-rose-500' :
            type === 'LR' ? 'bg-amber-500' :
            'bg-emerald-500';

          const snippetContent = [
            sBefore,
            <span key={`h-${index}`} className={`relative inline-block px-0.5 rounded-md border-b-2 cursor-help group/err transition-all hover:bg-opacity-30 ${colorClass}`}>
              {sHighlight}
              {/* Tooltip */}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover/err:opacity-100 group-hover/err:visible transition-all z-[100] text-[11px] leading-relaxed pointer-events-none text-left">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dotClass}`}></span>
                    <span className="font-black text-slate-800 uppercase tracking-widest text-[9px]">{typeLabel} Error</span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">IELTS AI Feedback</span>
                </div>
                <div className="text-slate-400 font-bold mb-1">Gợi ý sửa:</div>
                <div className="text-emerald-600 font-black mb-3 text-[13px] bg-emerald-50 p-2 rounded-xl">{suggestion}</div>
                <div className="text-slate-500 font-medium italic">{reason_vi}</div>
              </span>
            </span>,
            sAfter
          ];

          parts.splice(i, 1, before, ...snippetContent, after);
          break; // Move to next heatmap item
        }
      }
    }
  });

  return parts;
};

const ResultCard: React.FC<ResultCardProps> = ({ results, onClose, isInline = false }) => {
  if (!results) return null;

  const content = (
    <div className={`${isInline ? 'w-full' : 'bg-[#f8fafc] w-full max-w-7xl max-h-[90vh] overflow-y-auto rounded-[48px] p-6 md:p-12 relative shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] animate-in slide-in-from-bottom-10 duration-500 custom-scrollbar'}`}>
      
      {!isInline && (
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 w-12 h-12 bg-white rounded-full flex items-center justify-center hover:bg-slate-50 transition-all shadow-sm border border-slate-100 active:scale-90 z-10"
        >
          <i className="fas fa-times text-slate-400"></i>
        </button>
      )}

      <div className="flex flex-col lg:flex-row gap-12 text-left">
        
        {/* Left Side: Scores & Summary */}
        <div className="lg:w-1/3 space-y-8">
          <div className="text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              Analysis Completed
            </div>
            <h2 className="text-4xl font-black font-display text-slate-800 leading-tight">Kết quả<br />đánh giá cụ thể</h2>
          </div>

          {/* Main Score Box */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[40px] blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
            <div className="relative bg-white p-8 rounded-[38px] border border-slate-100 shadow-sm flex flex-col items-center">
              <div className="flex items-center gap-2 mb-2">
                 <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Overall Band Score</span>
                 {results.is_corrected && (
                   <div className="w-5 h-5 bg-amber-100 rounded-full flex items-center justify-center" title="Điểm đã được kiểm chứng và điều chỉnh bởi Gemini AI">
                     <i className="fas fa-magic text-[10px] text-amber-600"></i>
                   </div>
                 )}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-8xl font-black font-display text-slate-900 leading-none">{results.overall.toFixed(1)}</span>
                <i className="fas fa-star text-amber-400 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Sub-scores Grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Task Response', val: results.tr, color: 'bg-blue-50 text-blue-600' },
              { label: 'Cohesion', val: results.cc, color: 'bg-emerald-50 text-emerald-600' },
              { label: 'Lexical Res', val: results.lr, color: 'bg-violet-50 text-violet-600' },
              { label: 'Grammar', val: results.gra, color: 'bg-orange-50 text-orange-600' }
            ].map((item, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col items-center shadow-sm">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-center">{item.label}</span>
                <span className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center font-bold text-lg`}>
                  {item.val.toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          {/* General Feedback Summary */}
          <div className="p-6 bg-slate-900 rounded-[32px] text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <i className="fas fa-quote-right text-4xl"></i>
            </div>
            <h3 className="text-xs font-bold tracking-widest uppercase opacity-50 mb-4 flex items-center gap-2">
              <i className="fas fa-sparkles"></i> Tổng quan
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed font-medium">
              {results.feedback}
            </p>
          </div>
        </div>

        {/* Right Side: Detailed Criterion Feedback */}
        <div className="lg:w-2/3 space-y-6">
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm relative">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 mb-6">
              <div className="w-1.5 h-6 bg-primary rounded-full"></div>
              Bản đồ nhiệt lỗi sai (Heatmap)
            </h3>
            
            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1 bg-rose-50 rounded-lg border border-rose-100">
                <div className="w-3 h-3 bg-rose-500 rounded-sm"></div>
                <span className="text-[10px] font-bold text-rose-700 uppercase">Ngữ pháp (GRA)</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 rounded-lg border border-amber-100">
                <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
                <span className="text-[10px] font-bold text-amber-700 uppercase">Từ vựng (LR)</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
                <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase">Câu nối (CC)</span>
              </div>
            </div>

            <div className="prose prose-slate max-w-none text-left">
              <div className="text-slate-700 p-6 bg-slate-50/50 rounded-2xl border border-slate-100 leading-[2.2] font-medium text-sm tracking-normal whitespace-pre-wrap">
                {renderHeatmap(results)}
              </div>
            </div>
          </div>

          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 ml-2">
            <div className="w-1.5 h-6 bg-primary rounded-full"></div>
            Nhận xét chi tiết từng tiêu chí
          </h3>

          <div className="space-y-4">
            {results.detailed_feedback ? (
              Object.entries(results.detailed_feedback).map(([criterion, comment], idx) => {
                const icons: Record<string, string> = {
                  "Task Response": "fa-bullseye",
                  "Coherence and Cohesion": "fa-layer-group",
                  "Lexical Resource": "fa-font",
                  "Grammatical Range and Accuracy": "fa-check-double"
                };
                return (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group text-left">
                    <div className="flex items-start gap-5">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/5 transition-colors">
                        <i className={`fas ${icons[criterion] || 'fa-info-circle'} text-primary/60`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-800 mb-2 uppercase tracking-wide">{criterion}</h4>
                        <p className="text-slate-600 text-[13px] leading-relaxed whitespace-pre-wrap">
                          {comment}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : null}
          </div>
          
          {/* Feature 1: Vocabulary Suggestions */}
          {results.vocabulary_suggestions && results.vocabulary_suggestions.length > 0 && (
            <div className="mt-12 text-left">
              <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                Gợi ý nâng cấp từ vựng
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.vocabulary_suggestions.map((item, idx) => (
                  <div key={idx} className="bg-emerald-50/50 p-5 rounded-3xl border border-emerald-100/50 group hover:bg-emerald-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-400 line-through">{item.basic_word}</span>
                        <i className="fas fa-arrow-right text-[10px] text-emerald-400"></i>
                        <span className="text-sm font-black text-emerald-700">{item.upgraded_words.join(", ")}</span>
                      </div>
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Band {item.band_range.split("-")[1]}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 italic mb-2 leading-relaxed">
                      "{item.example_sentence}"
                    </p>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-100/30">
                      <span className="text-[10px] font-bold text-emerald-600/70 italic">{item.usage_note_vi}</span>
                      <span className="text-[10px] font-black text-slate-300">Dùng {item.frequency} lần</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {!isInline && (
            <div className="p-10 flex flex-col items-center">
                <button onClick={onClose} className="btn-premium w-full max-w-xs justify-center rounded-2xl">
                   Quay lại soạn thảo
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (isInline) return content;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center z-[1000] p-4 animate-in fade-in duration-300">
      {content}
    </div>
  );
};

export default ResultCard;
