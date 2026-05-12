import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import type { ExamDetailResponse } from '../types';
import { useAuth } from '../context/AuthContext';
import { useGrading } from '../context/GradingContext';
import { API } from '../config';
import { History, Eye, Clock, Calendar, CheckCircle2, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Comment {
  id: string;
  exam_id: string;
  user_id: string;
  username: string;
  content: string;
  parent_id: string | null;
  likes: number;
  reactions: Record<string, string[]>;
  created_at: string;
  replies: Comment[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function getAvatar(username: string) {
  return username ? username[0].toUpperCase() : '?';
}

const AVATAR_COLORS = [
  'bg-violet-500', 'bg-indigo-500', 'bg-sky-500', 'bg-emerald-500',
  'bg-amber-500', 'bg-rose-500', 'bg-pink-500', 'bg-teal-500',
];
function avatarColor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── CommentBox ───────────────────────────────────────────────────────────────
const CommentBox: React.FC<{
  placeholder?: string;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}> = ({ placeholder = 'Viết bình luận...', onSubmit, onCancel, autoFocus }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    await onSubmit(text.trim());
    setText('');
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition bg-white shadow-sm"
        onKeyDown={e => { 
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(); 
          }
        }}
      />
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button onClick={onCancel} className="px-4 py-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition">
            Hủy
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
          className="px-5 py-1.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
        >
          {loading ? 'Đang gửi...' : 'Gửi'}
        </button>
      </div>
    </div>
  );
};

// ─── CommentItem ──────────────────────────────────────────────────────────────
const CommentItem: React.FC<{
  comment: Comment;
  currentUserId?: string;
  onReply: (parentId: string, text: string) => Promise<void>;
  onReact: (commentId: string, type: string) => void;
  onDelete: (commentId: string) => void;
  isReply?: boolean;
}> = ({ comment, currentUserId, onReply, onReact, onDelete, isReply }) => {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [showReactions, setShowReactions] = useState(false);

  const REACTION_TYPES = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  return (
    <div className={`flex gap-3 ${isReply ? '' : ''}`}>
      {/* Avatar */}
      <div className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold ${avatarColor(comment.username)}`}>
        {getAvatar(comment.username)}
      </div>

      <div className="flex-1 min-w-0">
        {/* Bubble */}
        <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-bold text-sm text-slate-800">{comment.username}</span>
            <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(comment.created_at)}</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4 mt-1.5 ml-1 relative">
          <div 
            className="flex items-center gap-1 group relative"
            onMouseEnter={() => setShowReactions(true)}
            onMouseLeave={() => setShowReactions(false)}
          >
            <button
              onClick={() => onReact(comment.id, '👍')}
              className={`flex items-center gap-1 text-xs font-semibold transition-colors ${
                currentUserId && Object.values(comment.reactions || {}).some(users => users.includes(currentUserId))
                  ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-500'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              Thích
            </button>

            {/* Reaction Picker Overlay */}
            {showReactions && currentUserId && (
              <div className="absolute bottom-full left-0 pb-2 z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="bg-white shadow-xl border border-slate-100 rounded-full px-2 py-1.5 flex gap-2">
                  {REACTION_TYPES.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => { onReact(comment.id, emoji); setShowReactions(false); }}
                      className="hover:scale-125 transition-transform text-lg leading-none"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reaction Counts */}
          {comment.reactions && Object.keys(comment.reactions).length > 0 && (
            <div className="flex -space-x-1 items-center">
              {Object.entries(comment.reactions).map(([emoji, users]) => (
                <div key={emoji} className="flex items-center bg-slate-50 border border-slate-100 rounded-full px-1.5 py-0.5 text-[10px] text-slate-500 shadow-sm">
                  <span>{emoji}</span>
                  <span className="ml-0.5 font-bold">{users.length}</span>
                </div>
              ))}
            </div>
          )}

          {currentUserId && (
            <button
              onClick={() => setShowReplyBox(v => !v)}
              className="text-xs font-semibold text-slate-400 hover:text-indigo-500 transition-colors"
            >
              Trả lời
            </button>
          )}

          {currentUserId === comment.user_id && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-xs font-semibold text-slate-300 hover:text-red-500 transition-colors ml-auto"
            >
              Xóa
            </button>
          )}
        </div>

        {/* Reply Box */}
        {showReplyBox && (
          <div className="mt-3">
            <CommentBox
              placeholder={`Trả lời ${comment.username}...`}
              autoFocus
              onSubmit={async (text) => {
                await onReply(comment.id, text);
                setShowReplyBox(false);
              }}
              onCancel={() => setShowReplyBox(false)}
            />
          </div>
        )}

        {/* Nested replies */}
        {comment.replies.length > 0 && (
          <div className="mt-3 pl-2 border-l-2 border-slate-100 space-y-3">
            {comment.replies.map(reply => (
              <CommentItem
                key={reply.id}
                comment={reply}
                currentUserId={currentUserId}
                onReply={onReply}
                onReact={onReact}
                onDelete={onDelete}
                isReply
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── DiscussionTab ────────────────────────────────────────────────────────────
const DiscussionTab = React.forwardRef<{ scrollIntoView: (options?: ScrollIntoViewOptions) => void }, { examId: string }>(({ examId }, ref) => {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'newest' | 'top'>('newest');

  const fetchComments = async () => {
    try {
      const res = await fetch(`${API}/exam/${examId}/comments`);
      if (res.ok) setComments(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComments(); }, [examId]);

  const handlePost = async (content: string) => {
    if (!isAuthenticated) { alert('Bạn cần đăng nhập để bình luận!'); return; }
    const res = await fetch(`${API}/exam/${examId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam_id: examId, user_id: user.username, username: user.username, content, parent_id: null }),
    });
    if (res.ok) {
      const newComment: Comment = await res.json();
      setComments(prev => [newComment, ...prev]);
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    if (!isAuthenticated) { alert('Bạn cần đăng nhập để trả lời!'); return; }
    const res = await fetch(`${API}/exam/${examId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam_id: examId, user_id: user.username, username: user.username, content, parent_id: parentId }),
    });
    if (res.ok) {
      const newReply: Comment = await res.json();
      setComments(prev => {
        const updateReplies = (list: Comment[]): Comment[] => {
          return list.map(c => {
            if (c.id === parentId) return { ...c, replies: [newReply, ...c.replies] };
            if (c.replies.length > 0) return { ...c, replies: updateReplies(c.replies) };
            return c;
          });
        };
        return updateReplies(prev);
      });
    }
  };

  const handleReact = async (comment_id: string, reaction_type: string) => {
    if (!isAuthenticated) { alert('Bạn cần đăng nhập để thả cảm xúc!'); return; }
    const res = await fetch(`${API}/comments/${comment_id}/react?user_id=${user.username}&reaction_type=${reaction_type}`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setComments(prev => {
        const updateComments = (list: Comment[]): Comment[] => {
          return list.map(c => {
            if (c.id === comment_id) return { ...c, reactions: data.reactions };
            if (c.replies.length > 0) return { ...c, replies: updateComments(c.replies) };
            return c;
          });
        };
        return updateComments(prev);
      });
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!isAuthenticated || !window.confirm('Bạn có chắc muốn xóa bình luận này?')) return;
    const res = await fetch(`${API}/comments/${commentId}?user_id=${user.username}`, { method: 'DELETE' });
    if (res.ok) {
      setComments(prev => prev
        .filter(c => c.id !== commentId)
        .map(c => ({ ...c, replies: c.replies.filter(r => r.id !== commentId) }))
      );
    }
  };

  const sorted = [...comments].sort((a, b) =>
    sortBy === 'top' ? b.likes - a.likes : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div ref={ref as any} className="mt-12 pt-12 border-t border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-slate-800 text-lg">
          {comments.length} bình luận
        </h3>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setSortBy('newest')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${sortBy === 'newest' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Mới nhất
          </button>
          <button
            onClick={() => setSortBy('top')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition ${sortBy === 'top' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
          >
            Nổi bật
          </button>
        </div>
      </div>

      {/* New Comment Box */}
      {isAuthenticated ? (
        <div className="flex gap-3 mb-8">
          <div className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-white text-sm font-bold ${avatarColor(user.username)}`}>
            {getAvatar(user.username)}
          </div>
          <div className="flex-1">
            <CommentBox onSubmit={handlePost} />
          </div>
        </div>
      ) : (
        <div className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-center">
          <p className="text-sm text-indigo-700 font-medium">
            <a href="/auth" className="underline font-bold">Đăng nhập</a> để tham gia thảo luận
          </p>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium">Chưa có bình luận nào.</p>
          <p className="text-slate-400 text-sm mt-1">Hãy là người đầu tiên chia sẻ!</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sorted.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={isAuthenticated ? user.username : undefined}
              onReply={handleReply}
              onReact={handleReact}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ─── AttemptHistory ──────────────────────────────────────────────────────────
const AttemptHistory: React.FC<{ examId: string }> = ({ examId }) => {
  const { user, isAuthenticated } = useAuth();
  const { showResultPopup } = useGrading();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/user/history?user_id=${user.username}&exam_id=${examId}&mode=all`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Failed to fetch history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [examId, isAuthenticated, user?.username]);

  if (!isAuthenticated || (history.length === 0 && !loading)) return null;

  if (loading) {
    return (
      <div className="mb-10 animate-pulse">
        <div className="h-4 w-40 bg-slate-100 rounded mb-4"></div>
        <div className="h-32 bg-slate-50 rounded-xl"></div>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  return (
    <div className="mb-12">
      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
        Kết quả làm bài của bạn:
      </h3>
      <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày làm</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Kết quả</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Thời gian làm bài</th>
              <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {history.map((item) => (
              <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold text-slate-700">
                    {new Date(item.created_at).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </div>
                  <div className="flex gap-1.5 mt-1.5">
                    {item.session_type === 'exam' ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold rounded uppercase">
                        Phòng thi
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[10px] font-bold rounded uppercase">
                        Luyện tập
                      </span>
                    )}
                    {item.task_mode === 'task1' && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded uppercase">Task 1</span>
                    )}
                    {item.task_mode === 'task2' && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded uppercase">Task 2</span>
                    )}
                    {item.task_mode === 'both' && (
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded uppercase">Full Test</span>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 text-center">
                  <div className={`inline-flex items-center justify-center min-w-[50px] px-3 py-1 rounded-full text-sm font-bold ${
                    item.overall >= 7.0 ? 'bg-emerald-50 text-emerald-600' :
                    item.overall >= 6.0 ? 'bg-amber-50 text-amber-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {item.overall ? item.overall.toFixed(1) : 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="text-sm text-slate-600 font-medium flex items-center justify-center gap-1.5">
                    <Clock size={14} className="text-slate-400" />
                    {formatTime(item.total_time_spent)}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => {
                      const formattedResults: Record<string, any> = {};
                      Object.entries(item.tasks).forEach(([key, task]: [string, any]) => {
                        if (task.result) {
                          formattedResults[key] = {
                            ...task.result,
                            essay_text: task.essay // Ensure essay text is passed correctly
                          };
                        }
                      });
                      if (Object.keys(formattedResults).length > 0) {
                        showResultPopup(formattedResults, item.question);
                      } else {
                        alert("Không tìm thấy kết quả chi tiết cho bài làm này.");
                      }
                    }}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center justify-end gap-1 group transition-colors px-4 py-2 hover:bg-indigo-50 rounded-lg"
                  >
                    Xem chi tiết
                    <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Main ExamDetail Component ────────────────────────────────────────────────
export default function ExamDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [exam, setExam] = useState<ExamDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'practice' | 'full_test' | 'model_answer' | 'outline' | 'discuss'>(
    (searchParams.get('tab') as any) || 'practice'
  );
  const [selectedTime, setSelectedTime] = useState<string>('');
  const discussionRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (id) fetchExamDetail(id); }, [id]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['practice', 'full_test', 'model_answer', 'outline', 'discuss'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const fetchExamDetail = async (examId: string) => {
    try {
      const res = await fetch(`${API}/exam/detail/${examId}`);
      if (res.ok) {
        const data = await res.json();
        setExam(data);
        const initialTasks = [];
        if (data.task1) initialTasks.push('1');
        if (data.task2) initialTasks.push('2');
        setSelectedTasks(initialTasks);
      }
    } catch (error) {
      console.error('Failed to fetch exam details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskToggle = (taskNum: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskNum) ? prev.filter(t => t !== taskNum) : [...prev, taskNum]
    );
  };

  const handleStartExam = () => {
    if (activeTab === 'full_test') { navigate(`/exam?exam_id=${id}&mode=both`); return; }
    if (selectedTasks.length === 0) { alert('Vui lòng chọn ít nhất 1 phần thi để bắt đầu!'); return; }
    let mode = 'both';
    if (selectedTasks.includes('1') && !selectedTasks.includes('2')) mode = 'task1';
    if (!selectedTasks.includes('1') && selectedTasks.includes('2')) mode = 'task2';
    const timeParam = selectedTime ? `&time=${selectedTime}` : '';
    navigate(`/?exam_id=${id}&mode=${mode}${timeParam}`);
  };

  if (loading) return (
    <div className="flex justify-center items-center py-20 min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (!exam) return <div className="text-center py-20 text-red-500">Không tìm thấy bài thi.</div>;

  const partsCount = (exam.task1 ? 1 : 0) + (exam.task2 ? 1 : 0);
  const timeMinutes = partsCount === 2 ? 60 : (exam.task1 ? 20 : 40);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
      <div className="mb-4">
        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded">#IELTS Academic</span>
        <span className="ml-2 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded">#Writing</span>
      </div>

      <h1 className="text-3xl font-bold text-slate-900 mb-6">{exam.title}</h1>

      <div className="flex gap-4 mb-6">
        <button className="px-4 py-2 bg-indigo-50 text-indigo-700 font-medium rounded-lg">
          Thông tin đề thi
        </button>
      </div>

      <div className="text-slate-600 mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Thời gian làm bài: {timeMinutes} phút | {partsCount} phần thi | {exam.comments_count} bình luận
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {exam.participants_count} người đã luyện tập đề thi này
        </div>
      </div>

      <p className="text-red-500 text-sm italic mb-8">
        Chú ý: Hệ thống chấm điểm sử dụng AI để tự động đánh giá và cung cấp gợi ý sửa lỗi chi tiết cho bài làm của bạn.
      </p>

      {/* Attempt History */}
      <AttemptHistory examId={id!} />


      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6 flex gap-6">
        {[
          { key: 'practice', label: 'Luyện tập' },
          { key: 'full_test', label: 'Làm full test' },
          { key: 'outline', label: '💡 Dàn bài gợi ý' },
          { key: 'model_answer', label: '📝 Bài mẫu' },
          { key: 'discuss', label: `Thảo luận${exam.comments_count > 0 ? ` (${exam.comments_count})` : ''}` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              if (tab.key === 'discuss') {
                discussionRef.current?.scrollIntoView({ behavior: 'smooth' });
              } else {
                setActiveTab(tab.key as any);
              }
            }}
            className={`pb-3 font-medium transition-colors ${
              (tab.key === 'discuss' ? false : activeTab === tab.key) 
                ? 'text-indigo-600 border-b-2 border-indigo-600' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg mb-6 flex gap-3">
        <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-sm">Pro tips: Hình thức luyện tập từng phần và chọn mức thời gian phù hợp sẽ giúp bạn tập trung vào giải đúng các câu hỏi thay vì phải chịu áp lực hoàn thành bài thi.</p>
      </div>

      {activeTab === 'practice' ? (
        <>
          <div className="mb-6">
            <h3 className="font-medium text-slate-900 mb-4">Chọn phần thi bạn muốn làm</h3>
            <div className="space-y-4">
              {exam.task1 && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-1 h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    checked={selectedTasks.includes('1')} onChange={() => handleTaskToggle('1')} />
                  <div>
                    <span className="text-slate-900 font-medium">Task 1 (Tối đa 20 phút)</span>
                    <div className="mt-1 flex gap-2">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">#[Writing] Biểu đồ/Sơ đồ</span>
                    </div>
                  </div>
                </label>
              )}
              {exam.task2 && (
                <label className="flex items-start gap-3 cursor-pointer mt-4">
                  <input type="checkbox" className="mt-1 h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    checked={selectedTasks.includes('2')} onChange={() => handleTaskToggle('2')} />
                  <div>
                    <span className="text-slate-900 font-medium">Task 2 (Tối đa 40 phút)</span>
                    <div className="mt-1 flex gap-2">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">#[Writing] Nghị luận xã hội</span>
                    </div>
                  </div>
                </label>
              )}
            </div>
          </div>
          <div className="mb-8">
            <h3 className="font-medium text-slate-900 mb-2">Giới hạn thời gian <span className="text-slate-400 font-normal text-sm">(Để trống để đồng hồ đếm xuôi)</span></h3>
            <select value={selectedTime} onChange={e => setSelectedTime(e.target.value)}
              className="block w-full border border-slate-300 rounded-lg py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 bg-white shadow-sm">
              <option value="">-- Không giới hạn (đếm xuôi) --</option>
              <option value="20">20 phút</option>
              <option value="30">30 phút</option>
              <option value="40">40 phút</option>
              <option value="60">60 phút (Tiêu chuẩn)</option>
              <option value="90">90 phút</option>
            </select>
          </div>
        </>
      ) : null}

      {activeTab === 'model_answer' && (
        <ModelAnswerTab 
          id={id!}
          exam={exam}
          task1={exam.task1} 
          task2={exam.task2} 
        />
      )}

      {activeTab === 'outline' && (
        <OutlineTab 
          id={id!}
          task1={exam.task1} 
          task2={exam.task2} 
        />
      )}

      {activeTab !== 'discuss' && activeTab !== 'model_answer' && (
        <button onClick={handleStartExam}
          className="px-8 py-3 bg-[#3b5998] text-white font-bold rounded shadow hover:bg-[#2d4373] transition-colors mb-12">
          {activeTab === 'practice' ? 'LUYỆN TẬP' : 'BẮT ĐẦU FULL TEST'}
        </button>
      )}

      {/* Discussion Section (Always visible at bottom) */}
      <DiscussionTab ref={discussionRef} examId={id!} />
    </div>
  );
}

// ─── ModelAnswerTab Component ────────────────────────────────────────────────
const ModelAnswerTab: React.FC<{ id: string, exam: any, task1?: any, task2?: any }> = ({ id, exam, task1, task2 }) => {
  const { user, isAuthenticated } = useAuth();
  const [selectedTask, setSelectedTask] = useState<string>(task2 ? "2" : "1");
  const [selectedBand, setSelectedBand] = useState<number>(7.5);
  const [answer, setAnswer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatusAndFetch();
  }, [selectedTask, selectedBand, user?.username]);

  const checkStatusAndFetch = async () => {
    const question = selectedTask === "1" ? task1?.prompt : task2?.prompt;
    if (!question) return;

    setError(null);
    setLoading(true);
    setNeedsConfirmation(false);
    
    try {
      // 1. Check if this question is being generated (globally or for this user)
      const statusUrl = `${API}/model-answer/status?question=${encodeURIComponent(question)}&target_band=${selectedBand}${user?.username ? `&user_id=${user.username}` : ''}`;
      const statusRes = await fetch(statusUrl);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        if (statusData.is_generating) {
          setIsGenerating(true);
          setLoading(false);
          return;
        }
      }

      // 2. Fetch answer (non-forcing)
      const res = await fetch(`${API}/model-answer?question=${encodeURIComponent(question)}&target_band=${selectedBand}&task_type=${selectedTask}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.essay) {
          setAnswer(data);
          setNeedsConfirmation(false);
        } else {
          setAnswer(null);
          setNeedsConfirmation(true);
        }
      }
    } catch (e) {
      console.error("Error in checkStatusAndFetch:", e);
    } finally {
      setLoading(false);
    }
  };

  // Polling for generation status if currently generating
  useEffect(() => {
    let interval: any;
    if (isGenerating) {
      interval = setInterval(async () => {
        const question = selectedTask === "1" ? task1?.prompt : task2?.prompt;
        if (!question) return;

        const statusUrl = `${API}/model-answer/status?question=${encodeURIComponent(question)}&target_band=${selectedBand}${user?.username ? `&user_id=${user.username}` : ''}`;
        
        try {
          const statusRes = await fetch(statusUrl);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (!statusData.is_generating) {
              // Generation finished! Fetch the result.
              setIsGenerating(false);
              fetchFinalResult();
              clearInterval(interval);
            }
          }
        } catch (e) { console.error("Polling error:", e); }
      }, 3000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isGenerating, user?.username, selectedTask, selectedBand]);

  const fetchFinalResult = async () => {
    const question = selectedTask === "1" ? task1?.prompt : task2?.prompt;
    if (!question) return;
    try {
      const res = await fetch(`${API}/model-answer?question=${encodeURIComponent(question)}&target_band=${selectedBand}&task_type=${selectedTask}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.essay) {
          setAnswer(data);
          setNeedsConfirmation(false);
        }
      }
    } catch (e) { console.error(e); }
  };

  const handleGenerate = async () => {
    if (!isAuthenticated) {
      alert("Vui lòng đăng nhập để sử dụng tính năng này.");
      return;
    }
    
    const question = selectedTask === "1" ? task1?.prompt : task2?.prompt;
    if (!question) return;

    setIsGenerating(true);
    setNeedsConfirmation(false);
    setError(null);

    try {
      const examTitle = exam?.title || "Bài mẫu";
      const userId = user?.username || "";
      const res = await fetch(`${API}/model-answer?question=${encodeURIComponent(question)}&target_band=${selectedBand}&task_type=${selectedTask}&user_id=${userId}&force_generate=true&exam_title=${encodeURIComponent(examTitle)}&exam_id=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "started") {
          // Do nothing, the polling useEffect will handle it
          console.log("Generation started in background...");
        } else {
          // If it was already finished somehow
          setAnswer(data);
          setIsGenerating(false);
        }
      } else {
        let errMsg = "Có lỗi xảy ra khi tạo bài mẫu.";
        try {
          const errData = await res.json();
          errMsg = errData.detail || errMsg;
        } catch (parseError) {
          errMsg = `Lỗi hệ thống (${res.status})`;
        }
        setError(errMsg);
        setNeedsConfirmation(true);
        setIsGenerating(false);
      }
    } catch (e) {
      console.error("Fetch error:", e);
      setError("Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại kết nối hoặc server.");
      setNeedsConfirmation(true);
      setIsGenerating(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-200/40 p-6 md:p-10 mb-12 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 relative z-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 flex items-center gap-3">
              <span className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </span>
              Bài mẫu tham khảo
            </h3>
            <p className="text-slate-400 text-sm font-medium">Lựa chọn band điểm mục tiêu để xem cách khai thác ý tưởng và từ vựng</p>
          </div>
          <div className="flex bg-slate-100/80 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200/50">
            {task1 && (
              <button 
                onClick={() => setSelectedTask("1")}
                disabled={isGenerating}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${selectedTask === "1" ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                TASK 1
              </button>
            )}
            {task2 && (
              <button 
                onClick={() => setSelectedTask("2")}
                disabled={isGenerating}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${selectedTask === "2" ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                TASK 2
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-10 pb-8 border-b border-slate-50 relative z-10">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-2">Band mục tiêu:</span>
          {[5.5, 6.5, 7.5, 8.5].map(band => (
            <button
              key={band}
              onClick={() => setSelectedBand(band)}
              disabled={isGenerating}
              className={`min-w-[56px] h-14 rounded-2xl flex flex-col items-center justify-center transition-all duration-300 border-2 ${
                selectedBand === band 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200 scale-105' 
                  : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-100 hover:text-indigo-500 hover:bg-indigo-50/30'
              } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="text-xs opacity-70 font-bold uppercase tracking-tighter leading-none mb-0.5">Band</span>
              <span className="text-lg font-black leading-none">{band.toFixed(1)}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center relative z-10">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-400 font-bold text-sm">Đang tải dữ liệu...</p>
          </div>
        ) : isGenerating ? (
          <div className="py-32 flex flex-col items-center justify-center relative z-10">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 bg-indigo-600 rounded-sm animate-pulse"></div>
              </div>
            </div>
            <p className="mt-6 text-slate-600 font-black text-xs uppercase tracking-widest animate-pulse">AI đang viết bài mẫu cho bạn...</p>
            <p className="mt-2 text-slate-400 text-xs">Mọi thứ vẫn diễn ra ngầm nếu bạn rời trang này.</p>
          </div>
        ) : needsConfirmation ? (
          <div className="py-20 text-center relative z-10 animate-in fade-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 className="text-xl font-black text-slate-800 mb-3">Chưa có bài mẫu cho mức Band này</h4>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-10 font-medium leading-relaxed">
              Bạn có muốn yêu cầu AI viết một bài mẫu chuẩn cho band {selectedBand.toFixed(1)} ngay bây giờ không?
            </p>
            {error && <p className="mb-6 text-rose-500 text-xs font-bold">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={handleGenerate}
                className="px-10 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-105 transition-all"
              >
                ĐỒNG Ý TẠO BÀI MẪU
              </button>
            </div>
          </div>
        ) : answer ? (
          <div className="animate-in fade-in zoom-in-95 duration-700 relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="px-4 py-1.5 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-orange-100 border border-white/20">
                  Model Answer Band {selectedBand.toFixed(1)}
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-[11px] font-black text-slate-600">{answer.word_count} words</span>
                </div>
              </div>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(answer.essay);
                  alert("Đã copy bài mẫu vào clipboard!");
                }}
                className="text-[11px] font-black text-indigo-600 hover:text-indigo-700 underline underline-offset-4 decoration-2 decoration-indigo-200"
              >
                Copy bài mẫu
              </button>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-white p-8 md:p-10 rounded-[40px] border border-slate-100 mb-10 shadow-inner relative group">
              <div className="absolute top-6 left-6 opacity-0 group-hover:opacity-10 transition-opacity">
                <svg className="w-20 h-20 text-indigo-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C19.5693 16 20.017 15.5523 20.017 15V9C20.017 8.44772 19.5693 8 19.017 8H15.017C14.4647 8 14.017 8.44772 14.017 9V12C14.017 12.5523 13.5693 13 13.017 13H11.017V21H14.017ZM5.017 21L5.017 18C5.017 16.8954 5.91243 16 7.017 16H10.017C10.5693 16 11.017 15.5523 11.017 15V9C11.017 8.44772 10.5693 8 10.017 8H6.017C5.46472 8 5.017 8.44772 5.017 9V12C5.017 12.5523 4.5693 13 4.017 13H2.017V21H5.017Z"/></svg>
              </div>
              <p className="text-slate-700 leading-[1.8] whitespace-pre-wrap text-[16px] font-medium relative z-10">
                {answer.essay}
              </p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Key Strategies</h4>
                <div className="flex-1 h-px bg-slate-100"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {answer.key_points.map((point: string, idx: number) => (
                  <div key={idx} className="group p-5 bg-white border border-slate-100 rounded-[24px] text-[14px] font-bold text-slate-600 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex items-start gap-4">
                    <span className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 text-xs font-black group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="pt-1">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-24 text-center relative z-10">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <History className="text-slate-200 w-10 h-10" />
            </div>
            <h4 className="text-lg font-black text-slate-800 mb-2">Thông tin chưa sẵn sàng</h4>
            <p className="text-slate-400 text-sm max-w-xs mx-auto font-medium">Hệ thống AI đang được bảo trì hoặc giới hạn lượt truy cập. Vui lòng quay lại sau.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── OutlineTab Component ───────────────────────────────────────────────────
const OutlineTab: React.FC<{ id: string, task1?: any, task2?: any }> = ({ id, task1, task2 }) => {
  const { user } = useAuth();
  const [selectedTask, setSelectedTask] = useState<string>(task1 ? "1" : "2");
  const cleanText = (text: string) => typeof text === 'string' ? text.replace(/\*\*/g, '') : text;
  const [outline, setOutline] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  const fetchOutline = async (force: boolean = false, taskOverride?: string) => {
    const currentTask = taskOverride || selectedTask;
    const taskData = currentTask === "1" ? task1 : task2;
    const question = taskData?.prompt || taskData?.question || taskData?.content || taskData?.instruction || taskData?.text;
    
    if (!question) {
      console.error("DEBUG: Task data keys:", taskData ? Object.keys(taskData) : "null");
      setError("Không tìm thấy nội dung đề bài trong cơ sở dữ liệu.");
      return;
    }

    if (!force) setLoading(true);
    setError(null);
    try {
      const examTitle = `Dàn bài: ${question}`.substring(0, 50) + "...";
      const url = `${API}/exam/outline?question=${encodeURIComponent(question)}&task_type=${currentTask}` + 
                 (force ? `&force_generate=true&user_id=${user?.username}&exam_id=${id}&exam_title=${encodeURIComponent(examTitle)}` : "");
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.status === 'started') {
          setHasStarted(true);
          setPolling(true);
          setOutline(null);
        } else if (data && data.structure) {
          setOutline(data);
          setHasStarted(true);
          setPolling(false);
        } else {
          setOutline(null);
          setHasStarted(false);
          setPolling(false);
        }
      } else {
        const err = await res.json();
        setError(err.detail || "Không thể tải dàn bài gợi ý.");
        setPolling(false);
      }
    } catch (e) {
      setError("Lỗi kết nối máy chủ.");
      setPolling(false);
    } finally {
      setLoading(false);
    }
  };

  // Initial check if outline exists in DB
  useEffect(() => {
    setOutline(null);
    setHasStarted(false);
    fetchOutline(false, selectedTask);
  }, [selectedTask]);

  // Polling logic
  useEffect(() => {
    let interval: any;
    if (polling) {
      interval = setInterval(() => fetchOutline(false, selectedTask), 3000);
    }
    return () => clearInterval(interval);
  }, [polling, selectedTask]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-200/40 p-6 md:p-10 mb-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/30 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-1">Dàn bài gợi ý</h3>
              <div className="flex items-center gap-3">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Outline Generator</p>
                {outline?.created_at && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full">
                    <i className="far fa-clock"></i>
                    Đã tạo: {new Date(outline.created_at).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex bg-slate-100/80 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200/50">
            {task1 && (
              <button 
                onClick={() => setSelectedTask("1")}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${selectedTask === "1" ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                TASK 1
              </button>
            )}
            {task2 && (
              <button 
                onClick={() => setSelectedTask("2")}
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${selectedTask === "2" ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                TASK 2
              </button>
            )}
          </div>
        </div>

        {!hasStarted && !loading && !outline ? (
          <div className="py-24 text-center relative z-10">
            <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce duration-[2000ms]">
              <i className="fas fa-magic text-emerald-500 text-3xl"></i>
            </div>
            <h4 className="text-xl font-black text-slate-800 mb-3">Chưa có dàn bài cho câu hỏi này</h4>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-10 font-medium leading-relaxed">
              Hãy là người đầu tiên yêu cầu AI lập dàn ý chi tiết. Dàn ý này sau đó sẽ được chia sẻ cho toàn bộ cộng đồng.
            </p>
            <button 
              onClick={() => fetchOutline(true, selectedTask)}
              className="px-10 py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3 mx-auto"
            >
              <i className="fas fa-sparkles"></i>
              Yêu cầu AI lập dàn bài
            </button>
          </div>
        ) : (loading || polling) ? (
          <div className="py-32 flex flex-col items-center justify-center">
            <div className="w-16 h-16 relative mb-6">
              <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <i className="fas fa-brain text-emerald-600 animate-pulse"></i>
              </div>
            </div>
            <h4 className="text-lg font-black text-slate-800 mb-2">AI đang phân tích & lập dàn ý...</h4>
            <p className="text-slate-400 text-sm font-medium animate-pulse italic">
              Quá trình này có thể mất 10-15 giây. Vui lòng giữ trang này.
            </p>
          </div>
        ) : error ? (
          <div className="py-20 text-center">
             <div className="text-red-500 font-medium mb-4 flex items-center justify-center gap-2">
               <i className="fas fa-exclamation-triangle"></i>
               {error}
             </div>
             <button onClick={() => fetchOutline(true, selectedTask)} className="px-6 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
               Thử lại
             </button>
          </div>
        ) : outline ? (
          <div className="space-y-12 relative z-10 animate-in fade-in zoom-in-95 duration-500">
            {/* Outline: Simple Logical List */}
            <div className="space-y-8">
              {outline.structure.map((section: any, idx: number) => (
                <div key={idx} className="group">
                  <h4 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-3">
                    <span className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center text-xs border border-emerald-100">
                      {idx + 1}
                    </span>
                    {cleanText(section.heading)}
                  </h4>
                  
                  <div className="pl-11 space-y-3">
                    {section.bullets && section.bullets.length > 0 ? (
                      <ul className="space-y-2">
                        {section.bullets.map((bullet: string, bIdx: number) => (
                          <li key={bIdx} className="list-disc text-slate-600 text-[15px] font-medium leading-relaxed">
                            {cleanText(bullet)}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-500 text-[15px] font-medium leading-relaxed italic">
                        {cleanText(section.content || section.main_point || "Nội dung đang được cập nhật...")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Tips Section: Minimal List */}
            <div className="bg-slate-900 rounded-[32px] p-8 md:p-10 text-white relative overflow-hidden shadow-2xl shadow-slate-900/20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-[100px]"></div>
              
              <h4 className="text-xl font-black mb-6 flex items-center gap-3 relative z-10">
                <i className="fas fa-lightbulb text-emerald-400 text-sm"></i>
                Mẹo ghi điểm nhanh
              </h4>
              
              <ul className="space-y-4 relative z-10">
                {outline.key_tips.map((tip: string, idx: number) => (
                  <li key={idx} className="flex gap-4 items-start text-slate-300">
                    <span className="text-emerald-500 mt-1.5"><i className="fas fa-check-circle text-[10px]"></i></span>
                    <p className="text-[14px] font-medium leading-relaxed">{cleanText(tip)}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Vocabulary: Now at the bottom */}
            <div className="pt-8">
              <div className="flex items-center justify-between mb-10">
                <h4 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                  <span className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                     <i className="fas fa-book-open"></i>
                  </span>
                  Từ vựng đắt giá (Contextual)
                </h4>
                <div className="hidden md:flex gap-2">
                   {['Academic', 'Band 7.5+', 'Native Style'].map(tag => (
                     <span key={tag} className="px-3 py-1 bg-slate-100 text-slate-500 text-[10px] font-black rounded-lg uppercase tracking-wider">{tag}</span>
                   ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {outline.useful_vocabulary.map((vocab: any, idx: number) => (
                  <div key={idx} className="group bg-white border border-slate-100 p-8 rounded-[36px] hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-100/30 transition-all duration-500 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full -mr-12 -mt-12 group-hover:scale-[2] transition-transform duration-700"></div>
                    <div className="relative z-10">
                      <span className="text-emerald-700 font-black text-xl block mb-2">{vocab.word}</span>
                      <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg uppercase tracking-widest mb-4">{vocab.meaning}</span>
                      <div className="pl-4 border-l-2 border-emerald-100">
                        <p className="text-slate-500 text-xs font-medium leading-relaxed italic group-hover:text-slate-700 transition-colors">
                          "{vocab.usage}"
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};




