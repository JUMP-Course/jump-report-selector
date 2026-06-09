import { SaveOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { Alert, Button, DatePicker, Form, InputNumber, Select, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import WeightExplanation from "../components/WeightExplanation";
import type { CourseSession, DrawPreviewResponse, DrawResult, Student } from "../types";

type DrawFormValues = {
  lesson: number;
  date: Dayjs;
  count: number;
  excluded_student_ids: number[];
};

export default function DrawPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [todaySession, setTodaySession] = useState<CourseSession | null>(null);
  const [preview, setPreview] = useState<DrawPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [lastPreviewStudentIds, setLastPreviewStudentIds] = useState<number[]>([]);
  const [form] = Form.useForm<DrawFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    void Promise.all([api.get<Student[]>("/students"), api.get<CourseSession | null>("/course-sessions/today")])
      .then(([studentData, todayData]) => {
        setStudents(studentData);
        setTodaySession(todayData);
        if (todayData) {
          form.setFieldsValue({ lesson: todayData.lesson, date: dayjs(todayData.date) });
        }
      })
      .catch((error) => messageApi.error(error instanceof Error ? error.message : "加载基础数据失败"));
  }, [form, messageApi]);

  const generate = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const excludedStudentIds = Array.from(new Set([...(values.excluded_student_ids ?? []), ...lastPreviewStudentIds]));
      const payload = {
        lesson: values.lesson,
        date: values.date.format("YYYY-MM-DD"),
        count: values.count,
        excluded_student_ids: excludedStudentIds
      };
      const nextPreview = await api.post<DrawPreviewResponse>("/draws/preview", payload);
      setPreview(nextPreview);
      setLastPreviewStudentIds(nextPreview.results.map((result) => result.student_id));
      setSaved(false);
      messageApi.success("抽取结果已生成");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "生成抽取结果失败");
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!preview) return;
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.post("/draws/save", {
        batch_id: preview.batch_id,
        lesson: values.lesson,
        date: values.date.format("YYYY-MM-DD"),
        results: preview.results
      });
      setSaved(true);
      messageApi.success("抽取结果已保存，请到抽取历史中设置实际用途");
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存抽取结果失败");
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<DrawResult> = [
    { title: "顺序", dataIndex: "order", width: 80 },
    { title: "姓名", dataIndex: "name" },
    { title: "拼音", dataIndex: "pinyin" },
    { title: "有效汇报次数", dataIndex: "report_count" },
    { title: "有效提问次数", dataIndex: "question_count" },
    { title: "上次刚汇报", dataIndex: "last_report", render: (value) => (value ? <Tag color="orange">是</Tag> : <Tag>否</Tag>) },
    { title: "权重", dataIndex: "weight", sorter: (a, b) => a.weight - b.weight },
    { title: "抽取原因", dataIndex: "reason" }
  ];

  const studentOptions = students.map((s) => ({ label: `${s.name} (${s.pinyin})`, value: s.id }));

  return (
    <>
      {contextHolder}
      <div className="page-header">
        <Typography.Title level={2} className="page-title">
          随机抽取
        </Typography.Title>
      </div>
      {todaySession ? (
        <Alert type="success" showIcon message={`已自动使用今天课程：第 ${todaySession.lesson} 次课`} style={{ marginBottom: 12 }} />
      ) : (
        <Alert type="info" showIcon message="今天没有匹配课程日程，请手动填写课次和日期" style={{ marginBottom: 12 }} />
      )}
      <div className="content-band">
        <Form form={form} layout="inline" initialValues={{ lesson: 1, date: dayjs(), count: 1, excluded_student_ids: [] }}>
          <Form.Item name="lesson" label="第几次课" rules={[{ required: true, message: "请输入课次" }]}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="date" label="课程日期" rules={[{ required: true, message: "请选择日期" }]}>
            <DatePicker />
          </Form.Item>
          <Form.Item name="count" label="抽取人数">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="excluded_student_ids" label="本次额外排除" style={{ minWidth: 280 }}>
            <Select mode="multiple" allowClear showSearch options={studentOptions} optionFilterProp="label" />
          </Form.Item>
        </Form>
        <Space style={{ marginTop: 16 }}>
          <Button type="primary" icon={<ThunderboltOutlined />} loading={loading} onClick={generate}>
            生成抽取结果
          </Button>
          <Button icon={<SaveOutlined />} loading={saving} disabled={!preview || saved} onClick={save}>
            保存到抽取历史
          </Button>
        </Space>
      </div>
      <div style={{ marginBottom: 16 }}>
        <WeightExplanation />
      </div>
      {preview?.warnings.map((warning) => (
        <Alert key={warning} type="warning" showIcon message={warning} style={{ marginBottom: 12 }} />
      ))}
      <div className="content-band">
        <Typography.Title level={4}>抽取结果</Typography.Title>
        <Table<DrawResult> rowKey={(record) => `${preview?.batch_id}-${record.student_id}`} dataSource={preview?.results ?? []} columns={columns} pagination={false} scroll={{ x: 900 }} />
      </div>
    </>
  );
}
