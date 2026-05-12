import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API } from '../config';

const ModelGenerationStatus = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'generating' | 'finished' | 'hidden'>('hidden');
  const [title, setTitle] = useState("IELTS Writing");
  const [type, setType] = useState<'model_answer' | 'outline'>('model_answer');
  const [examId, setExamId] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let pollInterval: any;
    let timerInterval: any;

    const checkStatus = async () => {
      if (!isAuthenticated || !user?.username) return;
      try {
        const res = await fetch(`${API}/model-answer/status?user_id=${user.username}`);
        if (res.ok) {
          const data = await res.json();
          if (data.is_generating) {
            if (status !== 'generating') {
              setStatus('generating');
              setElapsedTime(0);
            }
            setTitle(data.title || "IELTS Writing");
            setExamId(data.exam_id);
            setType(data.type || 'model_answer');
          } else {
            if (status === 'generating') {
              setStatus('finished');
            }
          }
        }
      } catch (e) {
        console.error("Status polling error:", e);
      }
    };

    if (isAuthenticated) {
      checkStatus();
      pollInterval = setInterval(checkStatus, 3000);
    }

    if (status === 'generating') {
      timerInterval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      clearInterval(pollInterval);
      clearInterval(timerInterval);
    };
  }, [isAuthenticated, user?.username, status]);

  if (status === 'hidden') return null;

  const handleView = () => {
    if (examId) {
      const tabParam = type === 'outline' ? 'outline' : 'model_answer';
      navigate(`/exam-detail/${examId}?tab=${tabParam}`);
    }
    setStatus('hidden');
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-right-10 fade-in duration-500">
      <div className={`bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.12)] border p-4 min-w-[340px] relative overflow-hidden transition-all duration-500 ${status === 'finished' ? 'border-emerald-100' : 'border-slate-100'}`}>
        <div className="flex items-center gap-4">
          {/* Spinner/Icon Section */}
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center relative transition-colors ${status === 'finished' ? 'bg-emerald-50' : 'bg-indigo-50'}`}>
            {status === 'generating' ? (
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : (
              <CheckCircle className="text-emerald-500 w-8 h-8 animate-in zoom-in duration-500" />
            )}
          </div>

          {/* Content Section */}
          <div className="flex-1 pr-6">
            <h4 className={`text-[13px] font-black uppercase tracking-tight mb-0.5 ${status === 'finished' ? 'text-emerald-600' : 'text-slate-900'}`}>
              {status === 'generating' 
                ? (type === 'outline' ? 'ĐANG TẠO DÀN BÀI...' : 'ĐANG TẠO BÀI MẪU...') 
                : 'ĐÃ HOÀN TẤT!'}
            </h4>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1 line-clamp-1">{title}</p>
            
            {status === 'generating' ? (
              <p className="text-[11px] font-black text-indigo-600 uppercase">THỜI GIAN CHỜ: {elapsedTime}S</p>
            ) : (
              <button 
                onClick={handleView}
                className="text-[11px] font-black text-emerald-600 uppercase hover:underline flex items-center gap-1"
              >
                {type === 'outline' ? 'XEM CHI TIẾT DÀN BÀI' : 'XEM BÀI MẪU NGAY'} ➜
              </button>
            )}
          </div>

          {/* Close Button */}
          <button 
            onClick={() => setStatus('hidden')}
            className="text-slate-300 hover:text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-50">
          <div 
            className={`h-full transition-all duration-500 ${status === 'finished' ? 'bg-emerald-500 w-full' : 'bg-indigo-600'}`}
            style={status === 'generating' ? { width: `${Math.min(95, elapsedTime * 2.5)}%` } : {}}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default ModelGenerationStatus;
