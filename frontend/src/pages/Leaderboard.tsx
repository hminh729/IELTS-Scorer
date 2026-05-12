import React, { useState, useEffect } from 'react';
import { Trophy, Flame, TrendingUp, History, User, Award } from 'lucide-react';
import type { LeaderboardEntry } from '../types';
import { API } from '../config';

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'average_band' | 'total_essays' | 'streak'>('average_band');

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/leaderboard?sort_by=${sortBy}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const podium = entries.slice(0, 3);
  const tableEntries = entries.slice(3);

  const getDisplayValue = (entry: LeaderboardEntry) => {
    if (sortBy === 'average_band') return `Band ${entry.average_band}`;
    if (sortBy === 'total_essays') return `${entry.total_essays} bài`;
    if (sortBy === 'streak') return `${entry.streak} 🔥`;
    return '';
  };

  const getRankLabel = (rank: number) => {
    if (rank === 1) return 'Hạng nhất';
    if (rank === 2) return 'Hạng nhì';
    if (rank === 3) return 'Hạng ba';
    return `Hạng ${rank}`;
  };

  const Avatar = ({ url, username, size = "md", border = "" }: { url?: string, username: string, size?: "sm" | "md" | "lg", border?: string }) => {
    const sizeClasses = {
      sm: "w-10 h-10",
      md: "w-24 h-24",
      lg: "w-32 h-32"
    };
    const iconSizes = {
      sm: 18,
      md: 48,
      lg: 64
    };

    return (
      <div className={`${sizeClasses[size]} rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-4 ${border} shadow-xl transition-all`}>
        {url ? (
          <img src={url} alt={username} className="w-full h-full object-cover" />
        ) : (
          <User size={iconSizes[size]} className="text-slate-300" />
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-screen">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-black text-slate-900 mb-4 flex items-center justify-center gap-4">
          <Trophy className="text-amber-500 w-10 h-10 animate-bounce" /> Bảng Xếp Hạng
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto">
          Tôn vinh những học viên chăm chỉ và xuất sắc nhất trong cộng đồng IELTS Scorer. Hãy nỗ lực để ghi danh mình lên bảng vàng!
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-12">
        <div className="bg-white p-2 rounded-2xl flex gap-2 shadow-xl shadow-slate-200/50 border border-slate-100">
          {[
            { key: 'average_band', label: 'Band TB', icon: Award },
            { key: 'total_essays', label: 'Số bài', icon: History },
            { key: 'streak', label: 'Streak 🔥', icon: Flame },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSortBy(tab.key as any)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                sortBy === tab.key
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                  : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${sortBy === tab.key ? 'text-white' : 'text-indigo-500'}`} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {/* Podium */}
          {podium.length > 0 && (
            <div className="flex flex-col md:flex-row items-end justify-center gap-6 mb-20 px-4">
              {/* 2nd Place */}
              {podium[1] && (
                <div className="order-2 md:order-1 flex-1 max-w-[240px] w-full text-center group">
                  <div className="relative mb-6">
                    <div className="flex justify-center relative">
                      <Avatar url={podium[1].avatar_url} username={podium[1].username} border="border-slate-100" />
                      {/* Status Dot */}
                      <div className={`absolute bottom-1 right-[calc(50%-44px)] w-5 h-5 rounded-full border-4 border-white shadow-sm ${podium[1].is_online ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        {podium[1].is_online && <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></div>}
                      </div>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-400 text-white w-10 h-10 rounded-full flex items-center justify-center font-black border-4 border-white shadow-lg">2</div>
                  </div>
                  <h3 className="font-bold text-slate-800 truncate mb-6">{podium[1].full_name || podium[1].username}</h3>
                  <div className="h-32 bg-white rounded-3xl border border-slate-100 flex items-center justify-center flex-col gap-1 shadow-lg shadow-slate-100/50 group-hover:-translate-y-2 transition-transform">
                    <span className="font-black text-indigo-600 text-2xl">{getDisplayValue(podium[1])}</span>
                    <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase">Hạng 2</div>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              <div className="order-1 md:order-2 flex-1 max-w-[280px] w-full text-center group scale-110 z-10">
                <div className="relative mb-8">
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-6xl animate-pulse">👑</div>
                  <div className="flex justify-center relative">
                    <Avatar url={podium[0].avatar_url} username={podium[0].username} size="lg" border="border-amber-400" />
                    {/* Status Dot */}
                    <div className={`absolute bottom-2 right-[calc(50%-60px)] w-6 h-6 rounded-full border-4 border-white shadow-md ${podium[0].is_online ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      {podium[0].is_online && <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></div>}
                    </div>
                  </div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-amber-400 text-white w-12 h-12 rounded-full flex items-center justify-center font-black border-4 border-white shadow-xl text-xl">1</div>
                </div>
                <h3 className="font-black text-slate-900 text-xl truncate mb-8">{podium[0].full_name || podium[0].username}</h3>
                <div className="h-44 bg-white rounded-3xl border border-amber-100 flex items-center justify-center flex-col gap-2 shadow-2xl shadow-amber-100/50 group-hover:-translate-y-2 transition-transform">
                   <span className="font-black text-amber-600 text-3xl">{getDisplayValue(podium[0])}</span>
                   <div className="px-4 py-1.5 bg-amber-400 text-white rounded-full text-[10px] font-black uppercase shadow-lg shadow-amber-200">Hạng 1</div>
                </div>
              </div>

              {/* 3rd Place */}
              {podium[2] && (
                <div className="order-3 flex-1 max-w-[240px] w-full text-center group">
                  <div className="relative mb-6">
                    <div className="flex justify-center relative">
                      <Avatar url={podium[2].avatar_url} username={podium[2].username} border="border-orange-100" />
                      {/* Status Dot */}
                      <div className={`absolute bottom-1 right-[calc(50%-44px)] w-5 h-5 rounded-full border-4 border-white shadow-sm ${podium[2].is_online ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        {podium[2].is_online && <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></div>}
                      </div>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-400 text-white w-10 h-10 rounded-full flex items-center justify-center font-black border-4 border-white shadow-lg">3</div>
                  </div>
                  <h3 className="font-bold text-slate-800 truncate mb-6">{podium[2].full_name || podium[2].username}</h3>
                  <div className="h-28 bg-white rounded-3xl border border-slate-100 flex items-center justify-center flex-col gap-1 shadow-lg shadow-slate-100/50 group-hover:-translate-y-2 transition-transform">
                    <span className="font-black text-indigo-600 text-2xl">{getDisplayValue(podium[2])}</span>
                    <div className="px-3 py-1 bg-orange-50 rounded-full text-[10px] font-bold text-orange-600 uppercase">Hạng 3</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Table / List Ranks 4-100 */}
          <div className="bg-white rounded-[40px] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden">
            <div className="bg-slate-50/50 px-10 py-6 border-b border-slate-50 flex items-center justify-between">
               <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Bảng xếp hạng chi tiết</h3>
               <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{entries.length} thành viên</span>
            </div>
            
            <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
              <table className="w-full border-collapse table-fixed">
                <thead className="sticky top-0 bg-white z-10 shadow-sm border-b border-slate-50">
                  <tr>
                    <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[25%] text-center">Hạng</th>
                    <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[25%] text-left">Thành viên</th>
                    <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[25%] text-center">
                      {sortBy === 'average_band' ? 'Band TB' : sortBy === 'total_essays' ? 'Số bài làm' : 'Streak'}
                    </th>
                    <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[25%] text-center">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tableEntries.map((entry, index) => (
                    <tr key={entry.username} className="hover:bg-indigo-50/30 transition-all group">
                      <td className="px-6 py-6 text-center">
                        <span className="font-black text-slate-300 group-hover:text-indigo-400 transition-colors text-lg">#{index + 4}</span>
                      </td>
                      <td className="px-6 py-6">
                        <div className="flex items-center gap-3">
                          <Avatar url={entry.avatar_url} username={entry.username} size="sm" border="border-white" />
                          <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                            {entry.full_name || entry.username}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-100 rounded-full shadow-sm group-hover:border-indigo-100 group-hover:bg-indigo-50/50 transition-all">
                           {sortBy === 'average_band' ? (
                             <>
                               <Award className="w-4 h-4 text-indigo-500" />
                               <span className="text-sm font-black text-indigo-600">{entry.average_band}</span>
                             </>
                           ) : sortBy === 'total_essays' ? (
                             <>
                               <History className="w-4 h-4 text-violet-500" />
                               <span className="text-sm font-black text-violet-600">{entry.total_essays} bài</span>
                             </>
                           ) : (
                             <>
                               <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                               <span className="text-sm font-black text-orange-600">{entry.streak} 🔥</span>
                             </>
                           )}
                        </div>
                      </td>
                      <td className="px-6 py-6 text-center">
                        {entry.is_online ? (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Trực tuyến
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 text-slate-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            Ngoại tuyến
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {entries.length === 0 && (
                 <div className="py-20 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <History className="text-slate-300 w-10 h-10" />
                    </div>
                    <p className="text-slate-400 font-medium">Chưa có dữ liệu xếp hạng.</p>
                 </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
