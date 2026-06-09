import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, InputNumber, Popconfirm, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { CourseSession, StudentAbsence, StudentStats } from "../types";

export default function AbsencesPage() {
  const [students, setStudents] = useState<StudentStats[]>([]);
  const [todaySession, setTodaySession] = useState<CourseSession | null>(null);
  const [courseSessions, setCourseSessions] = useState<CourseSession[]>([]);
  const [absenceRecords, setAbsenceRecords] = useState<StudentAbsence[]>([]);
  const [loading, setLoading] = useState(false);
  const [absenceLoading, setAbsenceLoading] = useState(false);
  const [absenceSaving, setAbsenceSaving] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [absenceLesson, setAbsenceLesson] = useState(1);
  const [absenceStudentIds, setAbsenceStudentIds] = useState<number[]>([]);
  const [absenceLessonInitialized, setAbsenceLessonInitialized] = useState(false);
  const [recordLessonFilter, setRecordLessonFilter] = useState<number | null>(null);
  const [recordStudentFilter, setRecordStudentFilter] = useState<number | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const absenceRecordsPath = (lesson?: number | null, studentId?: number | null) => {
    const params = new URLSearchParams();
    if (lesson != null) {
      params.set("lesson", String(lesson));
    }
    if (studentId != null) {
      params.set("student_id", String(studentId));
    }
    const query = params.toString();
    return `/absences${query ? `?${query}` : ""}`;
  };

  const loadAbsenceRecords = async (lesson?: number | null, studentId?: number | null) => {
    setRecordLoading(true);
    try {
      setAbsenceRecords(await api.get<StudentAbsence[]>(absenceRecordsPath(lesson, studentId)));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载请假明细失败");
    } finally {
      setRecordLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [studentData, todayData, sessionData, recordData] = await Promise.all([
        api.get<StudentStats[]>("/students/stats"),
        api.get<CourseSession | null>("/course-sessions/today"),
        api.get<CourseSession[]>("/course-sessions"),
        api.get<StudentAbsence[]>(absenceRecordsPath(recordLessonFilter, recordStudentFilter))
      ]);
      setStudents(studentData);
      setTodaySession(todayData);
      setCourseSessions(sessionData);
      setAbsenceRecords(recordData);
      if (!absenceLessonInitialized) {
        setAbsenceLesson(todayData?.lesson ?? 1);
        setAbsenceLessonInitialized(true);
      }
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载请假页面失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    void loadAbsenceRecords(recordLessonFilter, recordStudentFilter);
  }, [recordLessonFilter, recordStudentFilter]);

  useEffect(() => {
    if (absenceLesson < 1) return;
    let cancelled = false;
    setAbsenceLoading(true);
    void api
      .get<StudentAbsence[]>(`/absences/lesson/${absenceLesson}`)
      .then((data) => {
        if (!cancelled) {
          setAbsenceStudentIds(data.map((item) => item.student_id));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          messageApi.error(error instanceof Error ? error.message : "加载请假名单失败");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAbsenceLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [absenceLesson, messageApi]);

  const studentOptions = useMemo(
    () => students.map((student) => ({ label: `${student.name} (${student.pinyin})`, value: student.id })),
    [students]
  );

  const selectedAbsenceSession = useMemo(
    () => courseSessions.find((session) => session.lesson === absenceLesson) ?? null,
    [absenceLesson, courseSessions]
  );

  const saveAbsences = async () => {
    setAbsenceSaving(true);
    try {
      const savedAbsences = await api.put<StudentAbsence[]>(`/absences/lesson/${absenceLesson}`, {
        student_ids: absenceStudentIds
      });
      setAbsenceStudentIds(savedAbsences.map((item) => item.student_id));
      void loadAbsenceRecords(recordLessonFilter, recordStudentFilter);
      messageApi.success("请假名单已保存");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存请假名单失败");
    } finally {
      setAbsenceSaving(false);
    }
  };

  const cancelAbsence = async (record: StudentAbsence) => {
    try {
      const result = await api.delete<{ message: string }>(`/absences/${record.id}`);
      if (record.lesson === absenceLesson) {
        setAbsenceStudentIds((ids) => ids.filter((studentId) => studentId !== record.student_id));
      }
      await loadAbsenceRecords(recordLessonFilter, recordStudentFilter);
      messageApi.success(result.message);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "取消请假失败");
    }
  };

  const absenceColumns: ColumnsType<StudentAbsence> = [
    { title: "课次", dataIndex: "lesson", sorter: (a, b) => a.lesson - b.lesson },
    { title: "日期", dataIndex: "course_date", render: (value) => value || "-" },
    { title: "标题", dataIndex: "course_title", render: (value) => value || "-" },
    { title: "学生", dataIndex: "student_name" },
    { title: "拼音", dataIndex: "student_pinyin" },
    {
      title: "记录时间",
      dataIndex: "created_at",
      render: (value: string) => dayjs(value).format("YYYY-MM-DD HH:mm")
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      render: (value: string) => dayjs(value).format("YYYY-MM-DD HH:mm")
    },
    {
      title: "操作",
      width: 120,
      render: (_, record) => (
        <Popconfirm title="确认取消该学生本课请假？" onConfirm={() => cancelAbsence(record)}>
          <Button danger size="small">
            取消请假
          </Button>
        </Popconfirm>
      )
    }
  ];

  return (
    <>
      {contextHolder}
      <div className="page-header">
        <Typography.Title level={2} className="page-title">
          请假名单
        </Typography.Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadData()}>
          刷新
        </Button>
      </div>
      <div className="content-band">
        <div className="page-header">
          <Typography.Title level={4} style={{ margin: 0 }}>
            课次请假
          </Typography.Title>
          {todaySession && <Tag color="blue">今天第 {todaySession.lesson} 次课</Tag>}
        </div>
        <Space wrap>
          <InputNumber
            min={1}
            value={absenceLesson}
            onChange={(value) => setAbsenceLesson(value ?? 1)}
            addonBefore="请假课次"
          />
          <Select
            mode="multiple"
            allowClear
            showSearch
            loading={absenceLoading}
            value={absenceStudentIds}
            onChange={setAbsenceStudentIds}
            options={studentOptions}
            optionFilterProp="label"
            placeholder="请假学生"
            style={{ minWidth: 360 }}
          />
          <Button icon={<SaveOutlined />} loading={absenceSaving} disabled={absenceLoading} onClick={saveAbsences}>
            保存请假名单
          </Button>
        </Space>
        <div style={{ marginTop: 12 }}>
          {selectedAbsenceSession ? (
            <Space wrap>
              <Tag color="geekblue">第 {selectedAbsenceSession.lesson} 次课</Tag>
              <Tag>{selectedAbsenceSession.date}</Tag>
              <Typography.Text strong>{selectedAbsenceSession.title || "未填写标题"}</Typography.Text>
            </Space>
          ) : (
            <Typography.Text className="muted">未找到该课次的课程日程</Typography.Text>
          )}
        </div>
      </div>
      <div className="content-band">
        <div className="page-header">
          <Typography.Title level={4} style={{ margin: 0 }}>
            请假明细
          </Typography.Title>
          <Button icon={<ReloadOutlined />} loading={recordLoading} onClick={() => loadAbsenceRecords(recordLessonFilter, recordStudentFilter)}>
            刷新明细
          </Button>
        </div>
        <div className="toolbar">
          <InputNumber
            min={1}
            placeholder="课次"
            value={recordLessonFilter ?? undefined}
            onChange={(value) => setRecordLessonFilter(value ?? null)}
          />
          <Select
            allowClear
            showSearch
            placeholder="学生"
            value={recordStudentFilter ?? undefined}
            onChange={(value) => setRecordStudentFilter(value ?? null)}
            options={studentOptions}
            optionFilterProp="label"
            style={{ width: 220 }}
          />
        </div>
        <Table<StudentAbsence>
          rowKey="id"
          loading={recordLoading}
          dataSource={absenceRecords}
          columns={absenceColumns}
          scroll={{ x: 980 }}
        />
      </div>
    </>
  );
}
