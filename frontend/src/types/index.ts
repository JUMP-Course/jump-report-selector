export type ReportType = "draw" | "self";
export type QuestionSource = "draw" | "manual";
export type DrawActionStatus = "pending" | "report" | "question" | "other";

export type QuestionType =
  | "数据问题"
  | "变量问题"
  | "代码问题"
  | "图表问题"
  | "方法问题"
  | "结果解释问题"
  | "其他";

export interface Student {
  id: number;
  name: string;
  pinyin: string;
  active: boolean;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentStats extends Student {
  report_count: number;
  question_count: number;
  last_report: boolean;
  base_weight: number;
  question_factor: number;
  cooldown_factor: number;
  weight: number;
  reason: string;
}

export interface StudentImportResponse {
  created_count: number;
  skipped_count: number;
  error_count: number;
  created: Student[];
  skipped: string[];
  errors: Array<{ row: number; message: string; raw: string }>;
}

export interface CourseSession {
  id: number;
  lesson: number;
  date: string;
  title?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportRecord {
  id: number;
  lesson: number;
  date: string;
  student_id: number;
  student_name: string;
  student_pinyin: string;
  report_type: ReportType;
  draw_history_id?: number | null;
  valid: boolean;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionRecord {
  id: number;
  lesson: number;
  date: string;
  questioner_id: number;
  questioner_name: string;
  questioner_pinyin: string;
  reporter_id?: number | null;
  reporter_name?: string | null;
  reporter_pinyin?: string | null;
  question_type: QuestionType;
  question_source: QuestionSource;
  draw_history_id?: number | null;
  valid: boolean;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DrawResult {
  order: number;
  student_id: number;
  name: string;
  pinyin: string;
  report_count: number;
  question_count: number;
  last_report: boolean;
  weight: number;
  reason: string;
}

export interface DrawPreviewResponse {
  batch_id: string;
  results: DrawResult[];
  warnings: string[];
}

export interface DrawHistoryRecord {
  id: number;
  lesson: number;
  date: string;
  student_id: number;
  student_name: string;
  student_pinyin: string;
  action_status: DrawActionStatus;
  action_note?: string | null;
  linked_report_id?: number | null;
  linked_question_id?: number | null;
  weight: number;
  reason: string;
  draw_batch_id: string;
  created_at: string;
}

export interface DashboardData {
  total_students: number;
  active_students: number;
  reported_students: number;
  unreported_students: number;
  total_valid_questions: number;
  never_questioned_students: number;
  unreported_list: Student[];
  never_questioned_list: Student[];
  recent_draws: DrawHistoryRecord[];
  course_sessions: CourseSession[];
  today_session?: CourseSession | null;
  warnings: string[];
}
