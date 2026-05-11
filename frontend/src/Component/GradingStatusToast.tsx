import React, { useEffect, useState } from 'react';
import { useGrading } from '../context/GradingContext';
import { Loader2, CheckCircle2, AlertCircle, X, ChevronRight } from 'lucide-react';

const GradingStatusToast: React.FC = () => {
  const { jobs, clearJob, showResultPopup } = useGrading();
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, number>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTimes(prev => {
        const next = { ...prev };
        jobs.forEach(job => {
          if (job.status === 'grading') {
            next[job.id] = Math.floor((Date.now() - job.startTime) / 1000);
          }
        });
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [jobs]);

  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-4 max-w-sm w-full animate-in slide-in-from-right-10 duration-300">
      {jobs.map(job => (
        <div 
          key={job.id} 
          className={`relative overflow-hidden bg-white/90 backdrop-blur-xl border rounded-[24px] shadow-2xl p-5 flex items-center gap-4 transition-all duration-500 ${
            job.status === 'completed' ? 'border-emerald-100' : job.status === 'error' ? 'border-rose-100' : 'border-indigo-100'
          }`}
        >
          {/* Progress Bar for Grading */}
          {job.status === 'grading' && (
            <div className="absolute bottom-0 left-0 h-1 bg-indigo-600/20 w-full overflow-hidden">
              <div className="h-full bg-indigo-600 animate-progress origin-left"></div>
            </div>
          )}

          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            job.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
            job.status === 'error' ? 'bg-rose-50 text-rose-600' : 
            'bg-indigo-50 text-indigo-600'
          }`}>
            {job.status === 'grading' ? <Loader2 size={24} className="animate-spin" /> : 
             job.status === 'completed' ? <CheckCircle2 size={24} /> : 
             <AlertCircle size={24} />}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-slate-900 truncate uppercase tracking-tight">
              {job.status === 'grading' ? 'Đang chấm bài...' : 
               job.status === 'completed' ? 'Đã chấm xong!' : 
               'Lỗi khi chấm bài'}
            </h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase truncate mt-0.5">
              {job.examTitle || 'IELTS Mock Test'}
            </p>
            {job.status === 'grading' && (
              <p className="text-[10px] font-black text-indigo-500 mt-1 uppercase">
                Thời gian chờ: {elapsedTimes[job.id] || 0}s
              </p>
            )}
            {job.status === 'completed' && (
              <button 
                onClick={() => {
                  if (job.results) showResultPopup(job.results, job.examTitle);
                  clearJob(job.id);
                }}
                className="mt-2 text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase flex items-center gap-1 group"
              >
                Xem chi tiết ngay <ChevronRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>

          <button 
            onClick={() => clearJob(job.id)}
            className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X size={16} />
          </button>
        </div>
      ))}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress {
          0% { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }
        .animate-progress {
          animation: progress 30s linear infinite;
        }
      `}} />
    </div>
  );
};

export default GradingStatusToast;
