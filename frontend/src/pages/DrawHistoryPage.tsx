import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { DrawActionStatus, DrawHistoryRecord, QuestionType, Student } from "../types";

const actionOptions: { label: string; value: DrawActionStatus }[] = [
  { label: "未处理", value: "pending" },
  { label: "做了汇报", value: "report" },
  { label: "做了提问", value: "question" },
  { label: "其他", value: "other" }
];

const actionLabels: Record<DrawActionStatus, string> = {
  pending: "未处理",
  report: "做了汇报",
  question: "做了提问",
  other: "其他"
};

const questionTypeOptions: { label: QuestionType; value: QuestionType }[] = [
  { label: "数据问题", value: "数据问题" },
  { label: "变量问题", value: "变量问题" },
  { label: "代码问题", value: "代码问题" },
  { label: "图表问题", value: "图表问题" },
  { label: "方法问题", value: "方法问题" },
  { label: "结果解释问题", value: "结果解释问题" },
  { label: "其他", value: "其他" }
];

type ActionFormValues = {
  action_status: DrawActionStatus;
  question_type?: QuestionType;
  reporter_id?: number;
  valid: boolean;
  note?: string;
};

export default function DrawHistoryPage() {
  const [records, setRecords] = useState<DrawHistoryRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [lessonFilter, setLessonFilter] = useState<number | null>(null);
  const [studentFilter, setStudentFilter] = useState<number | null>(null);
  const [actionFilter, setActionFilter] = useState<DrawActionStatus | null>(null);
  const [editing, setEditing] = useState<DrawHistoryRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<ActionFormValues>();
  const actionStatus = Form.useWatch("action_status", form);
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = async () => {
    setLoading(true);
    try {
      const [historyData, studentData] = await Promise.all([api.get<DrawHistoryRecord[]>("/draws/history"), api.get<Student[]>("/students")]);
      setRecords(historyData);
      setStudents(studentData);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载抽取历史失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openAction = (record: DrawHistoryRecord) => {
    setEditing(record);
    form.setFieldsValue({
      action_status: record.action_status,
      question_type: "其他",
      reporter_id: undefined,
      valid: true,
      note: record.action_note ?? ""
    });
    setModalOpen(true);
  };

  const saveAction = async () => {
    if (!editing) return;
    const values = await form.validateFields();
    try {
      await api.put(`/draws/history/${editing.id}/action`, {
        ...values,
        reporter_id: values.reporter_id ?? null
      });
      messageApi.success("抽取用途已更新");
      setModalOpen(false);
      void loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "更新抽取用途失败");
    }
  };

  const filtered = useMemo(
    () =>
      records.filter(
        (record) =>
          (lessonFilter == null || record.lesson === lessonFilter) &&
          (studentFilter == null || record.student_id === studentFilter) &&
          (actionFilter == null || record.action_status === actionFilter)
      ),
    [actionFilter, lessonFilter, records, studentFilter]
  );

  const studentOptions = students.map((student) => ({ label: `${student.name} (${student.pinyin})`, value: student.id }));

  const columns: ColumnsType<DrawHistoryRecord> = [
    { title: "课次", dataIndex: "lesson", sorter: (a, b) => a.lesson - b.lesson },
    { title: "日期", dataIndex: "date" },
    { title: "学生", dataIndex: "student_name" },
    { title: "拼音", dataIndex: "student_pinyin" },
    {
      title: "用途",
      dataIndex: "action_status",
      render: (value: DrawActionStatus) => <Tag color={value === "pending" ? undefined : "blue"}>{actionLabels[value]}</Tag>
    },
    { title: "关联记录", render: (_, record) => record.linked_report_id ? `汇报 #${record.linked_report_id}` : record.linked_question_id ? `提问 #${record.linked_question_id}` : "-" },
    { title: "权重", dataIndex: "weight", sorter: (a, b) => a.weight - b.weight },
    { title: "原因", dataIndex: "reason" },
    { title: "批次 ID", dataIndex: "draw_batch_id" },
    {
      title: "操作",
      width: 120,
      render: (_, record) => (
        <Button icon={<EditOutlined />} size="small" onClick={() => openAction(record)}>
          设置用途
        </Button>
      )
    }
  ];

  return (
    <>
      {contextHolder}
      <div className="page-header">
        <Typography.Title level={2} className="page-title">
          抽取历史
        </Typography.Title>
      </div>
      <div className="toolbar">
        <InputNumber placeholder="课次" min={1} value={lessonFilter ?? undefined} onChange={(value) => setLessonFilter(value ?? null)} />
        <Select placeholder="学生" allowClear showSearch value={studentFilter ?? undefined} onChange={(value) => setStudentFilter(value ?? null)} style={{ width: 180 }} options={studentOptions} optionFilterProp="label" />
        <Select placeholder="用途" allowClear value={actionFilter ?? undefined} onChange={(value) => setActionFilter(value ?? null)} style={{ width: 150 }} options={actionOptions} />
        <Button icon={<ReloadOutlined />} onClick={() => loadData()}>
          刷新
        </Button>
      </div>
      <Table<DrawHistoryRecord> rowKey="id" loading={loading} dataSource={filtered} columns={columns} scroll={{ x: 1200 }} />
      <Modal title={editing ? `设置用途：${editing.student_name}` : "设置用途"} open={modalOpen} onOk={saveAction} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ action_status: "pending", valid: true, question_type: "其他" }}>
          <Form.Item name="action_status" label="本次抽取实际用途" rules={[{ required: true, message: "请选择用途" }]}>
            <Select options={actionOptions} />
          </Form.Item>
          {actionStatus === "question" && (
            <>
              <Form.Item name="question_type" label="问题类型" rules={[{ required: true, message: "请选择问题类型" }]}>
                <Select options={questionTypeOptions} />
              </Form.Item>
              <Form.Item name="reporter_id" label="被提问的汇报学生">
                <Select allowClear showSearch options={studentOptions} optionFilterProp="label" />
              </Form.Item>
            </>
          )}
          {(actionStatus === "report" || actionStatus === "question") && (
            <Form.Item name="valid" label="是否有效" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
