import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ExamLibraryItem } from '../types';
import { API_BASE_URL } from '../config';

export default function ExamLibrary() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [exams, setExams] = useState<ExamLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  // Lọc theo năm (Mock tags)
  const [selectedTag, setSelectedTag] = useState("Tất cả");
  const filterTags = ["Tất cả", "Năm 2025", "Năm 2024", "Năm 2023", "Năm 2022", "Năm 2021", "Năm 2020"];

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedTag]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    fetchExams();
  }, [debouncedSearch, isAuthenticated, user]);

  const fetchExams = async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/api/exam/library`, window.location.origin);
      if (debouncedSearch) {
        url.searchParams.append("search", debouncedSearch);
      }
      url.searchParams.append("limit", "1000");
      if (isAuthenticated && user) {
        url.searchParams.append("user_id", user.username);
      }
      
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setExams(data);
      }
    } catch (error) {
      console.error("Failed to fetch exams:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredExams = exams.filter(exam => {
    if (selectedTag === "Tất cả") return true;
    const yearStr = selectedTag.replace("Năm ", "");
    return exam.year.toString() === yearStr;
  });

  const totalPages = Math.ceil(filteredExams.length / itemsPerPage);
  const paginatedExams = filteredExams.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const currentBlock = Math.floor((currentPage - 1) / 5);
  const startPage = currentBlock * 5 + 1;
  const endPage = Math.min(startPage + 4, totalPages);
  
  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Thư viện đề thi</h1>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content (Trái) */}
        <div className="flex-1">
          
          {/* Tags */}
          <div className="flex flex-wrap gap-x-6 gap-y-3 mb-6">
            {filterTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`text-sm font-medium transition-colors ${
                  selectedTag === tag 
                    ? "text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full" 
                    : "text-slate-600 hover:text-indigo-600 px-3 py-1"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Nhập từ khoá bạn muốn tìm kiếm: tên bài, đề bài..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all sm:text-sm shadow-sm"
            />
          </div>

          <button 
            className="mb-8 px-6 py-2.5 bg-[#3b5998] text-white font-medium rounded shadow hover:bg-[#2d4373] transition-colors"
            onClick={fetchExams}
          >
            Tìm kiếm
          </button>

          {/* Tabs */}
          <div className="border-b border-slate-200 mb-6 flex gap-6">
            <button className="pb-3 text-indigo-600 border-b-2 border-indigo-600 font-medium">Tất cả</button>
            <button className="pb-3 text-slate-500 hover:text-slate-700 font-medium transition-colors">Đề rút gọn</button>
          </div>

          {/* Exam Grid */}
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredExams.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              Không tìm thấy đề thi nào phù hợp.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {paginatedExams.map(exam => (
                <div key={exam.id} className="bg-white border border-slate-200 rounded-xl flex flex-col hover:shadow-lg transition-all duration-300 group relative">
                  {exam.is_completed && (
                    <div className="absolute top-4 right-4 z-10" title="Bạn đã làm bài này">
                      <svg className="w-6 h-6 text-emerald-500 bg-white rounded-full" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="p-5 flex-1">
                    <h3 className="font-bold text-lg text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors pr-8 line-clamp-2">
                      {exam.title}
                    </h3>
                    
                    <div className="text-sm text-slate-500 mb-3 space-y-1">
                      <div className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {exam.time_minutes} phút <span className="mx-2">|</span>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L13.842 6.17a1 1 0 0 0-.274.522l-.462 2.766a1 1 0 0 0 1.134 1.134l2.766-.462a1 1 0 0 0 .522-.274l3.646-3.646z"/></svg>
                        {exam.participants_count} <span className="mx-2">|</span>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        {exam.comments_count}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{exam.parts_count} phần thi</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {exam.tags.map(tag => (
                        <span key={tag} className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-4 border-t border-slate-100 mt-auto">
                    <Link 
                      to={`/exam-detail/${exam.id}`}
                      className="block w-full py-2 text-center text-indigo-600 font-medium border border-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      Chi tiết
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-10 mb-6">
                <div className="flex border border-[#e2e8f0] rounded overflow-hidden bg-white shadow-sm">
                  {startPage > 1 && (
                    <button 
                      onClick={() => setCurrentPage(startPage - 1)}
                      className="px-4 py-2 border-r border-[#e2e8f0] bg-white text-[#3b5998] hover:bg-slate-50 font-medium flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                      </svg>
                    </button>
                  )}
                  
                  {pageNumbers.map(pageNum => (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-4 py-2 border-r border-[#e2e8f0] text-sm font-medium transition-colors ${
                        currentPage === pageNum 
                          ? 'bg-[#3b5998] text-white' 
                          : 'bg-white text-[#3b5998] hover:bg-slate-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                  
                  {endPage < totalPages && (
                    <button 
                      onClick={() => setCurrentPage(endPage + 1)}
                      className="px-4 py-2 bg-white text-[#3b5998] hover:bg-slate-50 font-medium flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
            </>
          )}
        </div>

        {/* Sidebar (Phải) */}
        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl p-6 sticky top-24 shadow-sm">
            {isAuthenticated && user ? (
              <div className="text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <h3 className="font-semibold text-slate-900 text-lg mb-4">{user.username}</h3>
                
                <p className="text-sm text-slate-500 mb-6 text-left border-t border-slate-100 pt-4">
                  <span className="inline-block bg-slate-100 rounded-full px-2 py-1 mr-1 text-xs">ℹ</span>
                  Bạn đã sẵn sàng cho mục tiêu band điểm của mình chưa? Luyện tập ngay hôm nay.
                </p>

                <button 
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-2.5 bg-indigo-50 text-indigo-700 font-semibold rounded-lg border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                  Thống kê kết quả
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-slate-600 mb-4 text-sm">Đăng nhập để lưu kết quả luyện tập của bạn.</p>
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full py-2 bg-indigo-600 text-white font-medium rounded hover:bg-indigo-700 transition-colors"
                >
                  Đăng nhập
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
