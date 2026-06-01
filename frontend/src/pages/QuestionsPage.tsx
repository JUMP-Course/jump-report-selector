import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { CourseSession, QuestionRecord, QuestionType, Student } from "../types";

const questionTypeOptions: { label: QuestionType; value: QuestionType }[] = [
  { label: "数据问题", value: "数据问题" },
  { label: "变量问题", value: "变量问题" },
  { label: "代码问题", value: "代码问题" },
  { label: "图表问题", value: "图表问题" },
  { label: "方法问题", value: "方法问题" },
  { label: "结果解释问题", value: "结果解释问题" },
  { label: "其他", value: "其他" }
];

type QuestionFormValues = {
  lesson: number;
  date: Dayjs;
  questioner_id: number;
  reporter_id?: number;
  question_type: QuestionType;
  valid: boolean;
  note?: string;
};

export default function QuestionsPage() {
  const [records, setRecords] = useState<QuestionRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [todaySession, setTodaySession] = useState<CourseSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<QuestionRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [lessonFilter, setLessonFilter] = useState<number | null>(null);
  const [questionerFilter, setQuestionerFilter] = useState<number | null>(null);
  const [reporterFilter, setReporterFilter] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<QuestionType | null>(null);
  const [form] = Form.useForm<QuestionFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = async () => {
    setLoading(true);
    try {
      const [questionData, studentData, todayData] = await Promise.all([
        api.get<QuestionRecord[]>("/questions"),
        api.get<Student[]>("/students"),
        api.get<CourseSession | null>("/course-sessions/today")
      ]);
      setRecords(questionData);
      setStudents(studentData);
      setTodaySession(todayData);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载提问记录失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const studentOptions = students.map((student) => ({ label: `${student.name} (${student.pinyin})`, value: student.id }));

  const filtered = useMemo(
    () =>
      records.filter(
        (record) =>
          (lessonFilter == null || record.lesson === lessonFilter) &&
          (questionerFilter == null || record.questioner_id === questionerFilter) &&
          (reporterFilter == null || record.reporter_id === reporterFilter) &&
          (typeFilter == null || record.question_type === typeFilter)
      ),
    [lessonFilter, questionerFilter, records, reporterFilter, typeFilter]
  );

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      lesson: todaySession?.lesson ?? 1,
      date: todaySession ? dayjs(todaySession.date) : dayjs(),
      questioner_id: undefined as unknown as number,
      reporter_id: undefined,
      question_type: "数据问题",
      valid: true,
      note: undefined
    });
    setModalOpen(true);
  };

  const openEdit = (record: QuestionRecord) => {
    setEditing(record);
    form.setFieldsValue({
      lesson: record.lesson,
      date: dayjs(record.date),
      questioner_id: record.questioner_id,
      reporter_id: record.reporter_id ?? undefined,
      question_type: record.question_type,
      valid: record.valid,
      note: record.note ?? ""
    });
    setModalOpen(true);
  };

  const saveRecord = async () => {
    const values = await form.validateFields();
    const payload = { ...values, date: values.date.format("YYYY-MM-DD"), reporter_id: values.reporter_id ?? null, question_source: "manual" };
    try {
      if (editing) {
        await api.put(`/questions/${editing.id}`, payload);
        messageApi.success("提问记录已更新");
      } else {
        await api.post("/questions", payload);
        messageApi.success("提问记录已新增");
      }
      setModalOpen(false);
      void loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存提问记录失败");
    }
  };

  const deleteRecord = async (record: QuestionRecord) => {
    try {
      const result = await api.delete<{ message: string }>(`/questions/${record.id}`);
      messageApi.success(result.message);
      void loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除提问记录失败");
    }
  };

  const clearRecords = async () => {
    try {
      const result = await api.delete<{ message: string }>("/questions");
      messageApi.success(result.message);
      void loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "清空提问记录失败");
    }
  };

  const columns: ColumnsType<QuestionRecord> = [
    { title: "课次", dataIndex: "lesson", sorter: (a, b) => a.lesson - b.lesson },
    { title: "日期", dataIndex: "date" },
    { title: "提问学生", dataIndex: "questioner_name" },
    { title: "被提问学生", dataIndex: "reporter_name", render: (value) => value || "-" },
    { title: "问题类型", dataIndex: "question_type", render: (value: QuestionType) => <Tag>{value}</Tag> },
    { title: "来源", dataIndex: "question_source", render: (value) => (value === "draw" ? <Tag color="blue">抽取产生</Tag> : <Tag>手动记录</Tag>) },
    { title: "有效", dataIndex: "valid", render: (valid) => (valid ? <Tag color="green">有效</Tag> : <Tag>无效</Tag>) },
    { title: "内容简述", dataIndex: "note" },
    {
      title: "操作",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Popconfirm title="确认删除该提问记录？" onConfirm={() => deleteRecord(record)}>
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
          提问记录
        </Typography.Title>
        <Space>
          <Popconfirm title="确认清空全部提问记录？对应抽取历史会重置为未处理。" onConfirm={clearRecords}>
            <Button danger icon={<DeleteOutlined />} disabled={records.length === 0}>
              清空全部
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增提问
          </Button>
        </Space>
      </div>
      <div className="toolbar">
        <InputNumber placeholder="课次" min={1} value={lessonFilter ?? undefined} onChange={(value) => setLessonFilter(value ?? null)} />
        <Select placeholder="提问学生" allowClear showSearch value={questionerFilter ?? undefined} onChange={(value) => setQuestionerFilter(value ?? null)} style={{ width: 180 }} options={studentOptions} optionFilterProp="label" />
        <Select placeholder="被提问学生" allowClear showSearch value={reporterFilter ?? undefined} onChange={(value) => setReporterFilter(value ?? null)} style={{ width: 180 }} options={studentOptions} optionFilterProp="label" />
        <Select placeholder="问题类型" allowClear value={typeFilter ?? undefined} onChange={(value) => setTypeFilter(value ?? null)} style={{ width: 170 }} options={questionTypeOptions} />
        <Button icon={<ReloadOutlined />} onClick={() => loadData()}>
          刷新
        </Button>
      </div>
      <Table<QuestionRecord> rowKey="id" loading={loading} dataSource={filtered} columns={columns} scroll={{ x: 1050 }} />
      <Modal title={editing ? "编辑提问记录" : "新增提问记录"} open={modalOpen} onOk={saveRecord} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="lesson" label="第几次课" rules={[{ required: true, message: "请输入课次" }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="date" label="课程日期" rules={[{ required: true, message: "请选择日期" }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="questioner_id" label="提问学生" rules={[{ required: true, message: "请选择提问学生" }]}>
            <Select showSearch options={studentOptions} optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="reporter_id" label="被提问的汇报学生">
            <Select allowClear showSearch options={studentOptions} optionFilterProp="label" />
          </Form.Item>
          <Form.Item name="question_type" label="问题类型" rules={[{ required: true, message: "请选择问题类型" }]}>
            <Select options={questionTypeOptions} />
          </Form.Item>
          <Form.Item name="valid" label="是否有效" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="note" label="提问内容简述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
