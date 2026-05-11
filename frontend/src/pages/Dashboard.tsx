import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart3, 
  History, 
  BookOpen, 
  TrendingUp, 
  AlertCircle, 
  ExternalLink,
  ChevronRight,
  Target,
  PenTool,
  Calendar,
  ChevronLeft,
  Filter,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import axios from 'axios';
import ResultCard from '../Component/ResultCard';
import type { ScoreResult } from '../types';

const API_BASE = 'http://localhost:8000/api';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEssay, setSelectedEssay] = useState<ScoreResult | null>(null);
  const [statsMode, setStatsMode] = useState<'practice' | 'exam'>('practice');
  const [taskFilter, setTaskFilter] = useState<'all' | 'task1' | 'task2' | 'both'>('all');
  
  const [selectedErrorType, setSelectedErrorType] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Quản lý mục tiêu Band điểm
  const [targetBand, setTargetBand] = useState<number | null>(null);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  
  // Quản lý hiển thị các đường trên biểu đồ
  const [visibleLines, setVisibleLines] = useState<Record<string, boolean>>({
    overall: true,
    tr: false,
    cc: false,
    lr: false,
    gra: false
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsRes, historyRes, targetRes] = await Promise.all([
          axios.get(`${API_BASE}/user/stats?user_id=${user.username}&mode=${statsMode}`),
          axios.get(`${API_BASE}/user/history?user_id=${user.username}&mode=${statsMode}`),
          axios.get(`${API_BASE}/user/target-band?user_id=${user.username}`)
        ]);
        setStats(statsRes.data);
        setHistory(historyRes.data);
        setTargetBand(targetRes.data.target_band);
      } catch (err) {
        console.error("Error fetching dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    if (user) fetchData();
  }, [user, statsMode]);

  const saveTargetBand = async (val: number) => {
    try {
      setTargetBand(val);
      await axios.post(`${API_BASE}/user/target-band`, {
        user_id: user.username,
        target_band: val
      });
      setIsEditingTarget(false);
    } catch (err) {
      console.error("Lỗi cập nhật mục tiêu:", err);
      alert("Không thể lưu mục tiêu. Vui lòng thử lại.");
    }
  };

  const handleDeleteEssay = async (essayId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bài viết này không?")) return;
    try {
      await axios.delete(`${API_BASE}/exam/delete-session?user_id=${user.username}&session_id=${essayId}`);
      // Refresh data
      const [statsRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE}/user/stats?user_id=${user.username}&mode=${statsMode}`),
        axios.get(`${API_BASE}/user/history?user_id=${user.username}&mode=${statsMode}`)
      ]);
      setStats(statsRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      console.error("Lỗi khi xóa bài viết:", err);
      alert("Không thể xóa bài viết. Vui lòng thử lại.");
    }
  };

  const handleDeleteAllEssays = async (itemsToDelete: any[], hasFilter: boolean) => {
    if (hasFilter && itemsToDelete.length === 0) return; // Nothing to delete
    
    const confirmMsg = hasFilter 
       ? `CẢNH BÁO: Bạn có chắc chắn muốn xóa ${itemsToDelete.length} bài viết đang được lọc không?`
       : "CẢNH BÁO: Bạn có chắc chắn muốn xóa TẤT CẢ bài viết không? Hành động này không thể hoàn tác.";
       
    if (!window.confirm(confirmMsg)) return;
    
    try {
      if (hasFilter) {
        const ids = itemsToDelete.map(item => item._id);
        await axios.post(`${API_BASE}/exam/delete-batch`, { ids });
      } else {
        await axios.delete(`${API_BASE}/exam/delete-all/${user.username}`);
      }
      
      // Tạm xóa state
      if (!hasFilter) {
         setStats(null);
         setHistory([]);
      }
      
      // Fetch initial data to get default target_band etc
      const [statsRes, historyRes] = await Promise.all([
        axios.get(`${API_BASE}/user/stats?user_id=${user.username}&mode=${statsMode}`),
        axios.get(`${API_BASE}/user/history?user_id=${user.username}&mode=${statsMode}`)
      ]);
      setStats(statsRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      console.error("Lỗi khi xóa bài viết:", err);
      alert("Không thể xóa bài viết. Vui lòng thử lại.");
    }
  };

  // Tính toán tiến độ mục tiêu
  const progress = (stats?.average_band && targetBand) ? Math.min((stats.average_band / targetBand) * 100, 100) : 0;

  const chartData = stats?.score_history?.map((item: any, index: number) => ({
    ...item,
    displayDate: item.date,
    name: `Bài ${index + 1}`,
  })) || [];

  const renderOverview = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="relative overflow-hidden group bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-200 transition-all hover:scale-[1.02] hover:shadow-2xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
            <TrendingUp size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
                <BarChart3 size={24} />
              </div>
              <span className="text-indigo-100 font-medium">Band trung bình</span>
            </div>
            <div className="text-5xl font-black mb-2">
              {stats?.average_band || "0.0"}
            </div>
            <div className="text-indigo-200 text-sm font-medium">Dựa trên {stats?.total_essays || 0} bài viết</div>
          </div>
        </div>
        
        <div 
          onClick={() => setActiveTab('portfolio')}
          className="relative overflow-hidden group bg-white p-8 rounded-[32px] border border-slate-100 shadow-lg shadow-slate-200/50 transition-all hover:scale-[1.02] cursor-pointer hover:border-indigo-100"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <PenTool size={24} />
            </div>
            <span className="text-slate-500 font-medium uppercase tracking-wider text-xs">
              {statsMode === 'exam' ? 'Bài hoàn thành / Đang dở' : 'Tổng số bài viết'}
            </span>
          </div>
          <div className="text-5xl font-black text-slate-900 mb-2">
            {statsMode === 'exam' ? (
              <div className="flex items-center gap-3">
                <span className="text-emerald-600">{stats?.total_completed || 0}</span>
                <span className="text-slate-300 text-3xl">/</span>
                <span className="text-amber-500">{stats?.total_in_progress || 0}</span>
              </div>
            ) : (
              stats?.total_essays || 0
            )}
          </div>
          <div className="flex items-center gap-2 text-emerald-600 text-sm font-bold">
            <TrendingUp size={16} /> Xem nhật ký học tập →
          </div>
        </div>

        <div 
          onClick={() => setActiveTab('stats')}
          className="relative overflow-hidden group bg-white p-8 rounded-[32px] border border-slate-100 shadow-lg shadow-slate-200/50 transition-all hover:scale-[1.02] cursor-pointer hover:border-amber-100"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-amber-50 rounded-2xl text-amber-600">
              <AlertCircle size={24} />
            </div>
            <span className="text-slate-500 font-medium uppercase tracking-wider text-xs">Lỗi phổ biến nhất</span>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-2">
            {stats?.top_error?.name_vi || "Chưa có dữ liệu"}
          </div>
          <p className="text-slate-400 text-sm line-clamp-2">
            Bấm để xem phân tích chi tiết trong sổ tay lỗi sai.
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <TrendingUp className="text-indigo-600" /> Tiến độ học tập
            </h3>
            <p className="text-slate-400 mt-1">Biểu đồ thể hiện sự thay đổi Band điểm qua các bài viết</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'overall', label: 'Overall', color: '#4f46e5', bg: 'bg-indigo-600' },
              { key: 'tr', label: 'TR', color: '#3b82f6', bg: 'bg-blue-500' },
              { key: 'cc', label: 'CC', color: '#10b981', bg: 'bg-emerald-500' },
              { key: 'lr', label: 'LR', color: '#8b5cf6', bg: 'bg-violet-500' },
              { key: 'gra', label: 'GRA', color: '#f59e0b', bg: 'bg-amber-500' },
            ].map((item) => (
              <button 
                key={item.key}
                onClick={() => setVisibleLines(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black transition-all border ${
                  visibleLines[item.key] 
                    ? `bg-white border-slate-200 text-slate-700 shadow-sm` 
                    : `bg-slate-50 border-transparent text-slate-300`
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${visibleLines[item.key] ? item.bg : 'bg-slate-200'}`}></div> 
                {item.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorOverall" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorLR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorGRA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} 
                dy={15} 
              />
              <YAxis 
                domain={[0, 9]} 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 600}} 
                ticks={[0, 2, 4, 6, 8, 9]}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white p-5 rounded-3xl shadow-2xl border border-slate-50 animate-in fade-in zoom-in duration-200 min-w-[140px]">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-50 pb-2">{payload[0].payload.displayDate}</p>
                        <div className="space-y-2">
                          {payload.map((entry: any) => (
                            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                <span className="text-xs font-bold text-slate-500 uppercase">{entry.dataKey}</span>
                              </div>
                              <p className="text-sm font-black text-slate-900">{entry.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
                cursor={{ stroke: '#4f46e5', strokeWidth: 2, strokeDasharray: '5 5' }}
              />
              {visibleLines.overall && (
                <Area 
                  type="monotone" 
                  dataKey="overall" 
                  stroke="#4f46e5" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorOverall)" 
                  animationDuration={1500}
                />
              )}
              {visibleLines.tr && (
                <Area 
                  type="monotone" 
                  dataKey="tr" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorTR)" 
                  animationDuration={1500}
                />
              )}
              {visibleLines.cc && (
                <Area 
                  type="monotone" 
                  dataKey="cc" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorCC)" 
                  animationDuration={1500}
                />
              )}
              {visibleLines.lr && (
                <Area 
                  type="monotone" 
                  dataKey="lr" 
                  stroke="#8b5cf6" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorLR)" 
                  animationDuration={1500}
                />
              )}
              {visibleLines.gra && (
                <Area 
                  type="monotone" 
                  dataKey="gra" 
                  stroke="#f59e0b" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorGRA)" 
                  animationDuration={1500}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white p-10 rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <History className="text-indigo-600" /> Bài viết gần đây
          </h3>
          <button 
            onClick={() => setActiveTab('portfolio')}
            className="text-indigo-600 font-bold text-sm hover:underline"
          >
            Xem tất cả →
          </button>
        </div>
        <div className="space-y-4">
          {history.slice(0, 5).map((essay: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-slate-100 transition-all hover:bg-white hover:shadow-md group">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-black text-indigo-600 text-xl shadow-sm">
                  {essay.overall || '-'}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 max-w-md">
                    {typeof essay.question === 'string' ? essay.question : essay.question?.text || "Không có chủ đề"}
                  </h4>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] font-black uppercase text-slate-400">
                      {statsMode === 'exam' ? (essay.task_mode === 'both' ? 'Full Test' : `Task ${essay.task_mode === 'task2' ? '2' : '1'}`) : `Task ${essay.task_type || 2}`}
                    </span>
                    <span className="text-[10px] font-black uppercase text-slate-400">•</span>
                    <span className="text-[10px] font-black uppercase text-slate-400">{new Date(essay.created_at).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                  if (essay.overall) {
                    if (statsMode === 'exam' && essay.task_mode === 'both') {
                      setActiveTab('portfolio'); // Navigate to portfolio to let them use inline buttons
                    } else {
                      setSelectedEssay(statsMode === 'exam' && essay.tasks ? (essay.tasks['1']?.result || essay.tasks['2']?.result) : essay);
                    }
                  } else {
                    navigate(statsMode === 'exam' ? `/exam?sessionId=${essay._id}` : '/exam');
                  }
                }}
                className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          ))}
          {history.length === 0 && (
            <p className="text-slate-400 text-center py-10">Bạn chưa có bài viết nào.</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderErrorBank = () => {
    if (selectedErrorType) {
      // Lọc toàn bộ lỗi từ history
      const allErrors = history.flatMap(essay => 
        (essay.heatmap || []).filter((h: any) => h.type === selectedErrorType).map((h: any) => ({
          ...h,
          essayTitle: typeof essay.question === 'string' ? essay.question : essay.question?.text || "Không có chủ đề",
          date: essay.created_at
        }))
      );

      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
          <button 
            onClick={() => setSelectedErrorType(null)}
            className="flex items-center gap-2 text-indigo-600 font-bold hover:gap-3 transition-all mb-4"
          >
            <ChevronLeft size={20} /> Quay lại danh sách
          </button>
          
          <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl">
             <div className="flex items-center gap-4 mb-10">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl ${
                  selectedErrorType === 'GRA' ? 'bg-rose-500' : 
                  selectedErrorType === 'LR' ? 'bg-amber-500' : 
                  selectedErrorType === 'CC' ? 'bg-emerald-500' : 
                  'bg-indigo-500'
                }`}>
                  {selectedErrorType}
                </div>
                <div>
                   <h3 className="text-2xl font-black text-slate-900">Chi tiết lỗi {selectedErrorType}</h3>
                   <p className="text-slate-400">Danh sách tất cả các lỗi bạn đã mắc phải trong quá trình học</p>
                </div>
             </div>

             <div className="space-y-6">
                {allErrors.length > 0 ? allErrors.map((error, idx) => (
                  <div key={idx} className="p-8 bg-slate-50/50 rounded-3xl border border-slate-100 hover:bg-white hover:shadow-lg transition-all">
                    <div className="flex justify-between items-start mb-4">
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(error.date).toLocaleDateString('vi-VN')}</span>
                       <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full truncate max-w-xs">{error.essayTitle}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-rose-500 uppercase">Câu gốc có lỗi</p>
                          <p className="text-slate-700 font-medium italic">"...{error.original_snippet}..."</p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-[10px] font-black text-emerald-500 uppercase">Gợi ý sửa đổi</p>
                          <p className="text-slate-900 font-bold">→ {error.suggestion}</p>
                       </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                       <p className="text-xs text-slate-500"><span className="font-bold text-slate-900">Lý do:</span> {error.reason_vi}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-center py-20 text-slate-400">Tuyệt vời! Bạn chưa mắc lỗi nào trong tiêu chí này.</p>
                )}
             </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {stats?.error_distribution?.map((item: any, idx: number) => (
            <div 
              key={idx} 
              onClick={() => setSelectedErrorType(item.type)}
              className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-lg shadow-slate-200/40 transition-all hover:shadow-xl hover:scale-[1.02] cursor-pointer group"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg ${
                    item.type === 'GRA' ? 'bg-rose-500' : 
                    item.type === 'LR' ? 'bg-amber-500' : 
                    item.type === 'CC' ? 'bg-emerald-500' : 
                    'bg-indigo-500'
                  }`}>
                    {item.type}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900">{item.name_vi}</h4>
                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Phân tích lỗi sai</span>
                  </div>
                </div>
                <div className="bg-slate-50 text-slate-900 px-4 py-2 rounded-2xl text-sm font-black border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  {item.count} lần
                </div>
              </div>
              
              <div className="w-full bg-slate-50 rounded-full h-3 mb-4 overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    item.type === 'GRA' ? 'bg-rose-500' : 
                    item.type === 'LR' ? 'bg-amber-500' : 
                    item.type === 'CC' ? 'bg-emerald-500' : 
                    'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.min((item.count / (stats?.total_essays * 5 || 1)) * 100, 100)}%` }}
                />
              </div>
              
              <p className="text-slate-500 text-sm leading-relaxed mb-4">
                Bấm vào để xem danh sách chi tiết các lỗi {item.name_vi.toLowerCase()} bạn thường mắc phải.
              </p>
              <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold">
                XEM CHI TIẾT <ChevronRight size={14} />
              </div>
            </div>
          ))}
          {(!stats?.error_distribution || stats.error_distribution.length === 0) && (
            <div className="col-span-2 py-20 text-center bg-white rounded-[40px] border border-dashed border-slate-200">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <BookOpen size={40} />
              </div>
              <p className="text-slate-400 font-medium">Chưa có dữ liệu lỗi để phân tích. Hãy viết thêm bài nhé!</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPortfolio = () => {
    // Lọc lịch sử theo ngày và loại task
    const filteredHistory = history.filter(item => {
      const itemDate = new Date(item.created_at).getTime();
      let start = 0;
      let end = Infinity;
      
      if (dateRange.start) {
        const [sYear, sMonth, sDay] = dateRange.start.split('-');
        start = new Date(Number(sYear), Number(sMonth) - 1, Number(sDay), 0, 0, 0).getTime();
      }
      if (dateRange.end) {
        const [eYear, eMonth, eDay] = dateRange.end.split('-');
        end = new Date(Number(eYear), Number(eMonth) - 1, Number(eDay), 23, 59, 59, 999).getTime();
      }
      const dateMatch = itemDate >= start && itemDate <= end;

      // Lọc theo task
      let taskMatch = true;
      if (taskFilter !== 'all') {
         taskMatch = item.task_mode === taskFilter;
      }

      return dateMatch && taskMatch;
    });

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header and Filters */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
           <div className="flex items-center bg-white border border-slate-200 rounded-full px-2 py-1.5 shadow-sm">
              <div className="flex items-center pl-4 pr-5 border-r border-slate-200 gap-2.5">
                 <Filter size={16} className="text-indigo-600" />
                 <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Bộ lọc</span>
              </div>
              
              <div className="flex items-center gap-3 px-5">
                 <input 
                   type="date" 
                   value={dateRange.start}
                   onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                   className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer w-[130px] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                   title="Từ ngày"
                 />
                 <span className="text-slate-300 font-medium">→</span>
                 <input 
                   type="date" 
                   value={dateRange.end}
                   onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                   className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer w-[130px] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                   title="Đến ngày"
                 />
              </div>

              <div className="w-px h-6 bg-slate-200 mx-2"></div>

              <select 
                value={taskFilter}
                onChange={(e: any) => setTaskFilter(e.target.value)}
                className="bg-transparent text-sm font-semibold text-slate-700 pl-4 pr-8 py-2 outline-none cursor-pointer appearance-none bg-no-repeat focus:ring-0"
                style={{
                   backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%230f172a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                   backgroundPosition: `right 0.5rem center`,
                   backgroundSize: `1.5em 1.5em`
                }}
              >
                <option value="all">Tất cả các loại bài</option>
                <option value="task1">Task 1 Only</option>
                <option value="task2">Task 2 Only</option>
                {statsMode === 'exam' && <option value="both">Full Test (Task 1+2)</option>}
              </select>

              {(dateRange.start || dateRange.end || taskFilter !== 'all') && (
                 <button 
                   onClick={() => {setDateRange({start: '', end: ''}); setTaskFilter('all');}}
                   className="ml-2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
                   title="Xóa bộ lọc"
                 >
                   <X size={16} />
                 </button>
              )}
           </div>

           <button 
             onClick={() => handleDeleteAllEssays(filteredHistory, dateRange.start !== '' || dateRange.end !== '' || taskFilter !== 'all')}
             className="flex items-center gap-2 px-5 py-2.5 bg-white border border-rose-100 text-rose-500 hover:bg-rose-500 hover:text-white rounded-[16px] text-xs font-black transition-all shadow-sm"
           >
             <Trash2 size={16} /> {(dateRange.start || dateRange.end || taskFilter !== 'all') ? `XÓA ${filteredHistory.length} BÀI NÀY` : 'XÓA TẤT CẢ DỮ LIỆU'}
           </button>
        </div>

        <div className="bg-white rounded-[40px] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-10 py-6">Ngày viết</th>
                <th className="px-10 py-6">{statsMode === 'exam' ? 'Chế độ thi' : 'Chủ đề bài viết'}</th>
                <th className="px-10 py-6">Band điểm</th>
                <th className="px-10 py-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredHistory.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/30 transition-all group">
                  <td className="px-10 py-8">
                    <div className="text-slate-900 font-bold">
                      {new Date(item.created_at).toLocaleDateString('vi-VN')}
                    </div>
                    <div className="text-slate-400 text-xs font-medium">
                      {new Date(item.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <p className="text-slate-900 font-bold line-clamp-1 max-w-lg group-hover:text-indigo-600 transition-colors">
                      {typeof item.question === 'string' ? item.question : item.question?.text || "Không có chủ đề"}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-black uppercase">
                        {item.task_mode === 'both' ? 'Full Test' : `Task ${item.task_mode === 'task2' ? '2' : '1'}`}
                      </span>
                      <span className="text-[10px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded font-black uppercase">{item.word_count} từ</span>
                    </div>
                  </td>
                  <td className="px-10 py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 font-black text-xl">
                      {item.overall || '-'}
                    </div>
                  </td>
                  <td className="px-10 py-8 text-right">
                    <div className="flex justify-end gap-2">
                      {item.overall ? (
                        <div className="flex gap-2">
                          {item.tasks?.['1']?.result && (
                            <button onClick={() => setSelectedEssay(item.tasks['1'].result)} className="bg-white border border-slate-100 text-slate-900 hover:bg-slate-900 hover:text-white px-4 py-3 rounded-2xl font-black text-[10px] transition-all shadow-sm">
                              TASK 1
                            </button>
                          )}
                          {statsMode === 'exam' && item.tasks?.['1']?.status !== "submitted" && (item.task_mode === 'both' || item.task_mode === 'task1') && (
                            <button 
                              onClick={() => navigate(`/exam?sessionId=${item._id}`)}
                              className="bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-3 rounded-2xl font-black text-[10px] transition-all shadow-sm flex items-center gap-1"
                            >
                              TASK 1 <PenTool size={12} />
                            </button>
                          )}
                          {item.tasks?.['2']?.result && (
                            <button onClick={() => setSelectedEssay(item.tasks['2'].result)} className="bg-white border border-slate-100 text-slate-900 hover:bg-slate-900 hover:text-white px-4 py-3 rounded-2xl font-black text-[10px] transition-all shadow-sm">
                              TASK 2
                            </button>
                          )}
                          {statsMode === 'exam' && item.tasks?.['2']?.status !== "submitted" && (item.task_mode === 'both' || item.task_mode === 'task2') && (
                            <button 
                              onClick={() => navigate(`/exam?sessionId=${item._id}`)}
                              className="bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white px-4 py-3 rounded-2xl font-black text-[10px] transition-all shadow-sm flex items-center gap-1"
                            >
                              TASK 2 <PenTool size={12} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button 
                          onClick={() => navigate(statsMode === 'exam' ? `/exam?sessionId=${item._id}` : '/exam')}
                          className="bg-indigo-50 border border-indigo-100 text-indigo-600 hover:bg-indigo-600 hover:text-white px-6 py-3 rounded-2xl font-black text-xs transition-all shadow-sm flex items-center gap-2"
                        >
                          {item.task_mode === 'both' && item.tasks?.["1"]?.status === "submitted" && item.tasks?.["2"]?.status !== "submitted" ? "TIẾP TỤC TASK 2" : 
                           item.task_mode === 'both' && item.tasks?.["2"]?.status === "submitted" && item.tasks?.["1"]?.status !== "submitted" ? "TIẾP TỤC TASK 1" : "TIẾP TỤC"} 
                          <PenTool size={14} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteEssay(item._id)}
                        className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm shadow-rose-100"
                        title="Xóa bài viết"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredHistory.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-slate-400 font-medium">Không tìm thấy bài viết nào trong khoảng thời gian này.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] bg-slate-50/30">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-slate-100 p-8 pb-10 flex flex-col gap-3 sticky top-20 h-[calc(100vh-80px)]">
        <div className="mb-8 px-4">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Menu Dashboard</div>
        </div>
        <button 
          onClick={() => { setActiveTab('overview'); setSelectedErrorType(null); }}
          className={`flex items-center gap-4 px-6 py-5 rounded-[24px] font-black text-sm transition-all ${
            activeTab === 'overview' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 translate-x-2' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <BarChart3 size={20} /> Tổng quan
        </button>
        <button 
          onClick={() => { setActiveTab('stats'); setSelectedErrorType(null); }}
          className={`flex items-center gap-4 px-6 py-5 rounded-[24px] font-black text-sm transition-all ${
            activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 translate-x-2' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <BookOpen size={20} /> Sổ tay lỗi sai
        </button>
        <button 
          onClick={() => { setActiveTab('portfolio'); setSelectedErrorType(null); }}
          className={`flex items-center gap-4 px-6 py-5 rounded-[24px] font-black text-sm transition-all ${
            activeTab === 'portfolio' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 translate-x-2' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
          }`}
        >
          <History size={20} /> Nhật ký học tập
        </button>

        <div className="mt-auto p-6 bg-gradient-to-br from-indigo-50 to-white rounded-[32px] border border-indigo-100 shadow-sm">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-100">
            <TrendingUp size={20} />
          </div>
          <div className="flex justify-between items-start mb-1">
             <h4 className="font-black text-slate-900 text-sm">Mục tiêu cá nhân</h4>
             <button 
               onClick={() => setIsEditingTarget(!isEditingTarget)}
               className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
             >
                <Edit2 size={14} />
             </button>
          </div>
          
          {isEditingTarget ? (
            <div className="flex items-center gap-2 mb-4 animate-in fade-in zoom-in duration-200">
               <input 
                 type="number" 
                 step="0.5" 
                 min="0" 
                 max="9"
                 defaultValue={targetBand || 0}
                 onBlur={(e) => saveTargetBand(parseFloat(e.target.value) || targetBand || 0)}
                 onKeyDown={(e: any) => e.key === 'Enter' && saveTargetBand(parseFloat(e.target.value) || targetBand || 0)}
                 className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1 text-sm font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500"
                 autoFocus
               />
               <button 
                 onClick={() => setIsEditingTarget(false)}
                 className="p-1 bg-indigo-600 text-white rounded-lg"
               >
                  <ChevronRight size={14} />
               </button>
            </div>
          ) : (
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              Đạt Band <span className="font-black text-indigo-600">{targetBand?.toFixed(1)}</span> để hoàn thành kế hoạch học tập của bạn.
            </p>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold">
               <span className="text-slate-400 uppercase">Tiến độ</span>
               <span className="text-indigo-600">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-1000" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-16 overflow-y-auto">
        <header className="mb-16 flex justify-between items-end">
          <div>
            <h2 className="text-5xl font-black text-slate-900 mb-4 tracking-tight">Chào mừng, {user?.username}!</h2>
            <p className="text-slate-400 text-xl font-medium">Hôm nay chúng ta sẽ cải thiện kỹ năng Writing chứ? ✨</p>
          </div>
          <div className="flex flex-col items-end gap-4">
             {/* Toggle Mode */}
             <div className="bg-slate-100 p-1 rounded-2xl flex items-center shadow-inner">
               <button 
                 onClick={() => setStatsMode('practice')}
                 className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${statsMode === 'practice' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 Luyện tập
               </button>
               <button 
                 onClick={() => setStatsMode('exam')}
                 className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${statsMode === 'exam' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 Phòng thi
               </button>
             </div>

             <button 
               onClick={() => navigate('/')}
               className="bg-indigo-600 text-white px-8 py-4 rounded-[20px] font-black text-sm shadow-xl shadow-indigo-200 hover:scale-105 transition-all flex items-center gap-2"
             >
               LUYỆN TẬP <PenTool size={18} />
             </button>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'stats' && renderErrorBank()}
            {activeTab === 'portfolio' && renderPortfolio()}
          </>
        )}
      </main>

      {/* Essay Detail Modal */}
      {selectedEssay && (
        <ResultCard 
          results={selectedEssay} 
          onClose={() => setSelectedEssay(null)} 
        />
      )}
    </div>
  );
};

export default Dashboard;
