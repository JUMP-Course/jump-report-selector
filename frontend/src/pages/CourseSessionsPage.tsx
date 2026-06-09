import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { CourseSession } from "../types";

type SessionFormValues = {
  lesson: number;
  date: Dayjs;
  title?: string;
  note?: string;
};

export default function CourseSessionsPage() {
  const [sessions, setSessions] = useState<CourseSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CourseSession | null>(null);
  const [form] = Form.useForm<SessionFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadSessions = async () => {
    setLoading(true);
    try {
      setSessions(await api.get<CourseSession[]>("/course-sessions"));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载课程日程失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions();
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
      void loadSessions();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存课程日程失败");
    }
  };

  const deleteSession = async (session: CourseSession) => {
    try {
      await api.delete(`/course-sessions/${session.id}`);
      messageApi.success("课程日程已删除");
      void loadSessions();
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
          课程日程
        </Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadSessions()}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增课程
          </Button>
        </Space>
      </div>
      <div className="content-band">
        <Table<CourseSession> rowKey="id" loading={loading} dataSource={sessions} columns={columns} pagination={false} />
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
