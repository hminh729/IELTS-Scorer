export type OCRResponse = {
  text: string;
  status: string;
  message?: string;
};

export type EssaySubmit = {
  task_type: number;
  question: string;
  essay: string;
};

export type HeatmapItem = {
  type: "GRA" | "LR" | "CC";
  original_snippet: string;
  target_text: string;
  suggestion: string;
  reason_vi: string;
};

export type VocabSuggestion = {
  basic_word: string;
  upgraded_words: string[];
  part_of_speech: string;
  example_sentence: string;
  usage_note_vi: string;
  frequency: number;
  band_range: string;
};

export type ScoreResult = {
  overall: number;
  tr: number;
  cc: number;
  lr: number;
  gra: number;
  feedback?: string;
  detailed_feedback?: Record<string, string>;
  is_corrected: boolean;
  heatmap?: HeatmapItem[];
  essay_text: string;
  vocabulary_suggestions?: VocabSuggestion[];
};

export interface ExamLibraryItem {
  id: string;
  title: string;
  year: number;
  tags: string[];
  participants_count: number;
  comments_count: number;
  time_minutes: number;
  parts_count: number;
  is_completed?: boolean;
}

export interface ExamDetailResponse {
  id: string;
  title: string;
  year: number;
  participants_count: number;
  comments_count: number;
  task1?: {
    prompt: string;
    image_url?: string;
    local_image_path?: string;
  };
  task2?: {
    prompt: string;
  };
}

export interface LeaderboardEntry {
  username: string;
  full_name?: string;
  avatar_url?: string;
  is_online?: boolean;
  average_band: number;
  total_essays: number;
  streak: number;
  last_active: string | null;
}
