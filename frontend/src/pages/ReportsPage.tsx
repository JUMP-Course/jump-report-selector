import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { CourseSession, ReportRecord, ReportType, Student } from "../types";

const reportTypeOptions: { label: string; value: ReportType }[] = [
  { label: "抽取产生", value: "draw" },
  { label: "学生自发", value: "self" }
];

const reportTypeLabels: Record<ReportType, string> = {
  draw: "抽取产生",
  self: "学生自发"
};

type ReportFormValues = {
  lesson: number;
  date: Dayjs;
  student_id: number;
  report_type: ReportType;
  valid: boolean;
  note?: string;
};

export default function ReportsPage() {
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [todaySession, setTodaySession] = useState<CourseSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ReportRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lessonFilter, setLessonFilter] = useState<number | null>(null);
  const [studentFilter, setStudentFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<ReportType | null>(null);
  const [form] = Form.useForm<ReportFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = async () => {
    setLoading(true);
    try {
      const [reportData, studentData, todayData] = await Promise.all([
        api.get<ReportRecord[]>("/reports"),
        api.get<Student[]>("/students"),
        api.get<CourseSession | null>("/course-sessions/today")
      ]);
      setRecords(reportData);
      setStudents(studentData);
      setTodaySession(todayData);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载汇报记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(
    () =>
      records.filter(
        (record) =>
          (lessonFilter == null || record.lesson === lessonFilter) &&
          (studentFilter == null || record.student_id === studentFilter) &&
          (typeFilter == null || record.report_type === typeFilter)
      ),
    [lessonFilter, records, studentFilter, typeFilter]
  );

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      lesson: todaySession?.lesson ?? 1,
      date: todaySession ? dayjs(todaySession.date) : dayjs(),
      valid: true,
      report_type: "self",
      note: undefined,
      student_id: undefined as unknown as number
    });
    setModalOpen(true);
  };

  const openEdit = (record: ReportRecord) => {
    setEditing(record);
    form.setFieldsValue({
      lesson: record.lesson,
      date: dayjs(record.date),
      student_id: record.student_id,
      report_type: record.report_type,
      valid: record.valid,
      note: record.note ?? ""
    });
    setModalOpen(true);
  };

  const saveRecord = async () => {
    const values = await form.validateFields();
    const payload = { ...values, date: values.date.format("YYYY-MM-DD") };
    try {
      if (editing) {
        await api.put(`/reports/${editing.id}`, payload);
        messageApi.success("汇报记录已更新");
      } else {
        await api.post("/reports", payload);
        messageApi.success("汇报记录已新增");
      }
      setModalOpen(false);
      void loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存汇报记录失败");
    }
  };

  const deleteRecord = async (record: ReportRecord) => {
    try {
      const result = await api.delete<{ message: string }>(`/reports/${record.id}`);
      messageApi.success(result.message);
      void loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除汇报记录失败");
    }
  };

  const clearRecords = async () => {
    try {
      const result = await api.delete<{ message: string }>("/reports");
      messageApi.success(result.message);
      void loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "清空汇报记录失败");
    }
  };

  const columns: ColumnsType<ReportRecord> = [
    { title: "课次", dataIndex: "lesson", sorter: (a, b) => a.lesson - b.lesson },
    { title: "日期", dataIndex: "date" },
    { title: "学生", dataIndex: "student_name" },
    { title: "拼音", dataIndex: "student_pinyin" },
    { title: "汇报类型", dataIndex: "report_type", render: (value: ReportType) => <Tag>{reportTypeLabels[value]}</Tag> },
    { title: "有效", dataIndex: "valid", render: (valid) => (valid ? <Tag color="green">有效</Tag> : <Tag>无效</Tag>) },
    { title: "备注", dataIndex: "note" },
    {
      title: "操作",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Popconfirm title="确认删除该汇报记录？" onConfirm={() => deleteRecord(record)}>
            <Button danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <>
      {contextHolder}
      <div className="page-header">
        <Typography.Title level={2} className="page-title">
          汇报记录
        </Typography.Title>
        <Space>
          <Popconfirm title="确认清空全部汇报记录？对应抽取历史会重置为未处理。" onConfirm={clearRecords}>
            <Button danger icon={<DeleteOutlined />} disabled={records.length === 0}>
              清空全部
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增汇报
          </Button>
        </Space>
      </div>
      <div className="toolbar">
        <InputNumber placeholder="课次" min={1} value={lessonFilter ?? undefined} onChange={(value) => setLessonFilter(value ?? null)} />
        <Select placeholder="学生" allowClear showSearch value={studentFilter ?? undefined} onChange={(value) => setStudentFilter(value ?? null)} style={{ width: 180 }} options={students.map((s) => ({ label: `${s.name} (${s.pinyin})`, value: s.id }))} optionFilterProp="label" />
        <Select placeholder="汇报类型" allowClear value={typeFilter ?? undefined} onChange={(value) => setTypeFilter(value ?? null)} style={{ width: 150 }} options={reportTypeOptions} />
        <Button icon={<ReloadOutlined />} onClick={() => loadData()}>
          刷新
        </Button>
      </div>
      <Table<ReportRecord> rowKey="id" loading={loading} dataSource={filtered} columns={columns} scroll={{ x: 950 }} />
      <Modal title={editing ? "编辑汇报记录" : "新增汇报记录"} open={modalOpen} onOk={saveRecord} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="lesson" label="第几次课" rules={[{ required: true, message: "请输入课次" }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="date" label="课程日期" rules={[{ required: true, message: "请选择日期" }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="student_id" label="汇报学生" rules={[{ required: true, message: "请选择学生" }]}>
            <Select showSearch options={students.map((s) => ({ label: `${s.name} (${s.pinyin})`, value: s.id }))} optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="report_type" label="汇报类型" rules={[{ required: true, message: "请选择汇报类型" }]}>
            <Select options={reportTypeOptions} />
          </Form.Item>
          <Form.Item name="valid" label="是否有效" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
