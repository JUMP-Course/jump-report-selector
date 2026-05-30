import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import StatCard from "../components/StatCard";
import type { CourseSession, DashboardData } from "../types";

type SessionFormValues = {
  lesson: number;
  date: Dayjs;
  title?: string;
  note?: string;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CourseSession | null>(null);
  const [form] = Form.useForm<SessionFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = async () => {
    setLoading(true);
    try {
      const dashboard = await api.get<DashboardData>("/dashboard");
      setData(dashboard);
      setSessions(dashboard.course_sessions);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载首页失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const openCreate = () => {
    setEditing(null);
    const lastSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;
    form.setFieldsValue({ lesson: (lastSession?.lesson ?? 0) + 1, date: dayjs(), title: "", note: "" });
    setModalOpen(true);
  };

  const openEdit = (session: CourseSession) => {
    setEditing(session);
    form.setFieldsValue({
      lesson: session.lesson,
      date: dayjs(session.date),
      title: session.title ?? "",
      note: session.note ?? ""
    });
    setModalOpen(true);
  };

  const saveSession = async () => {
    const values = await form.validateFields();
    const payload = { ...values, date: values.date.format("YYYY-MM-DD") };
    try {
      if (editing) {
        await api.put(`/course-sessions/${editing.id}`, payload);
        messageApi.success("课程日程已更新");
      } else {
        await api.post("/course-sessions", payload);
        messageApi.success("课程日程已新增");
      }
      setModalOpen(false);
      void loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存课程日程失败");
    }
  };

  const deleteSession = async (session: CourseSession) => {
    try {
      await api.delete(`/course-sessions/${session.id}`);
      messageApi.success("课程日程已删除");
      void loadData();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除课程日程失败");
    }
  };

  const columns: ColumnsType<CourseSession> = [
    { title: "课次", dataIndex: "lesson", sorter: (a, b) => a.lesson - b.lesson },
    { title: "日期", dataIndex: "date" },
    { title: "标题", dataIndex: "title", render: (value) => value || "-" },
    { title: "备注", dataIndex: "note", render: (value) => value || "-" },
    {
      title: "操作",
      width: 140,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Popconfirm title="确认删除该课程日程？" onConfirm={() => deleteSession(record)}>
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
          首页 Dashboard
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={() => loadData()}>
          刷新
        </Button>
      </div>
      {data?.warnings.map((warning) => (
        <Alert key={warning} type="warning" showIcon message={warning} style={{ marginBottom: 12 }} />
      ))}
      {data?.today_session ? (
        <Alert
          type="success"
          showIcon
          message={`今天匹配课程：第 ${data.today_session.lesson} 次课 ${data.today_session.title ?? ""}`}
          description="新增汇报、提问和抽取时会自动带入今天的课次与日期。"
          style={{ marginBottom: 12 }}
        />
      ) : (
        <Alert type="info" showIcon message="今天没有匹配到课程日程" description="各操作页面会保留手动填写课次与日期。" style={{ marginBottom: 12 }} />
      )}
      <div className="stat-grid">
        <StatCard title="总学生数" value={data?.total_students ?? 0} />
        <StatCard title="Active 学生数" value={data?.active_students ?? 0} />
        <StatCard title="已汇报人数" value={data?.reported_students ?? 0} />
        <StatCard title="尚未汇报人数" value={data?.unreported_students ?? 0} />
        <StatCard title="总有效提问次数" value={data?.total_valid_questions ?? 0} />
        <StatCard title="从未提问人数" value={data?.never_questioned_students ?? 0} />
      </div>
      <div className="content-band">
        <div className="page-header">
          <Typography.Title level={4} style={{ margin: 0 }}>
            课程日程
          </Typography.Title>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增课程
          </Button>
        </div>
        <Table<CourseSession> rowKey="id" loading={loading} dataSource={sessions} columns={columns} pagination={false} />
      </div>
      <div className="content-band">
        <Typography.Title level={4}>老师操作说明</Typography.Title>
        <Typography.Paragraph>
          先在首页维护课程日程。当天日期与课程日程精确匹配时，汇报、提问和随机抽取页面会自动填入今天的课次和日期。
        </Typography.Paragraph>
        <Typography.Paragraph>
          学生名单页可以单个新增，也可以批量导入。批量导入以拼音为唯一标识，遇到重复拼音会跳过。
        </Typography.Paragraph>
        <Typography.Paragraph>
          随机抽取页只负责按权重抽出学生，不预设用途。抽取后到抽取历史页标记该学生实际做了汇报、提问、其他或未处理。
        </Typography.Paragraph>
        <Typography.Paragraph>
          只有当抽取历史被标记为“汇报”或“提问”时，系统才会自动生成对应记录并更新后续权重；改回未处理或其他会撤销自动生成记录。
        </Typography.Paragraph>
      </div>
      <Modal title={editing ? "编辑课程日程" : "新增课程日程"} open={modalOpen} onOk={saveSession} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="lesson" label="第几次课" rules={[{ required: true, message: "请输入课次" }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="date" label="上课日期" rules={[{ required: true, message: "请选择日期" }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="title" label="标题">
            <Input placeholder="例如 数据清洗专题" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
