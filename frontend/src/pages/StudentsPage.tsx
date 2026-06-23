import { DeleteOutlined, EditOutlined, ImportOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../api/client";
import StatCard from "../components/StatCard";
import type { StudentImportResponse, StudentStats } from "../types";

type StudentFormValues = {
  name: string;
  pinyin: string;
  active: boolean;
  note?: string;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<StudentStats | null>(null);
  const [keyword, setKeyword] = useState("");
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<StudentImportResponse | null>(null);
  const [form] = Form.useForm<StudentFormValues>();
  const [messageApi, contextHolder] = message.useMessage();

  const loadStudents = async () => {
    setLoading(true);
    try {
      setStudents(await api.get<StudentStats[]>("/students/stats"));
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载学生失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStudents();
  }, []);

  const filtered = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    if (!text) return students;
    return students.filter((student) => student.name.includes(text) || student.pinyin.includes(text));
  }, [keyword, students]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((student) => student.active).length;
    const reported = filtered.filter((student) => student.report_count > 0).length;
    const questioned = filtered.filter((student) => student.question_count > 0).length;
    const withAbsence = filtered.filter((student) => student.absence_count > 0).length;
    const totalAbsences = filtered.reduce((sum, student) => sum + student.absence_count, 0);

    return {
      total,
      active,
      inactive: total - active,
      reported,
      unreported: total - reported,
      questioned,
      neverQuestioned: total - questioned,
      withAbsence,
      withoutAbsence: total - withAbsence,
      totalAbsences
    };
  }, [filtered]);

  const ratioItems = useMemo(
    () => [
      {
        label: "参与抽取",
        primaryLabel: "参与",
        secondaryLabel: "不参与",
        primaryCount: summary.active,
        secondaryCount: summary.inactive,
        color: "#16a34a"
      },
      {
        label: "汇报覆盖",
        primaryLabel: "已汇报",
        secondaryLabel: "未汇报",
        primaryCount: summary.reported,
        secondaryCount: summary.unreported,
        color: "#2563eb"
      },
      {
        label: "提问覆盖",
        primaryLabel: "已提问",
        secondaryLabel: "未提问",
        primaryCount: summary.questioned,
        secondaryCount: summary.neverQuestioned,
        color: "#7c3aed"
      },
      {
        label: "请假记录",
        primaryLabel: "有记录",
        secondaryLabel: "无记录",
        primaryCount: summary.withAbsence,
        secondaryCount: summary.withoutAbsence,
        color: "#ea580c"
      }
    ],
    [summary]
  );

  const absenceRanking = useMemo(
    () =>
      [...filtered]
        .filter((student) => student.absence_count > 0)
        .sort((a, b) => b.absence_count - a.absence_count || a.pinyin.localeCompare(b.pinyin))
        .slice(0, 5),
    [filtered]
  );

  const maxAbsenceCount = absenceRanking[0]?.absence_count ?? 0;

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ name: "", pinyin: "", active: true, note: "" });
    setModalOpen(true);
  };

  const openEdit = (student: StudentStats) => {
    setEditing(student);
    form.setFieldsValue({
      name: student.name,
      pinyin: student.pinyin,
      active: student.active,
      note: student.note ?? ""
    });
    setModalOpen(true);
  };

  const saveStudent = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/students/${editing.id}`, values);
        messageApi.success("学生信息已更新");
      } else {
        await api.post("/students", values);
        messageApi.success("学生已新增");
      }
      setModalOpen(false);
      void loadStudents();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "保存学生失败");
    }
  };

  const deleteStudent = async (student: StudentStats) => {
    try {
      const result = await api.delete<{ message: string }>(`/students/${student.id}`);
      messageApi.success(result.message);
      void loadStudents();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "删除学生失败");
    }
  };

  const importStudents = async () => {
    try {
      const result = await api.post<StudentImportResponse>("/students/import", { text: importText });
      setImportResult(result);
      messageApi.success(`导入完成：新增 ${result.created_count} 人，跳过 ${result.skipped_count} 人`);
      void loadStudents();
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "导入学生失败");
    }
  };

  const readImportFile = async (file: File) => {
    setImportText(await file.text());
    setImportResult(null);
  };

  const columns: ColumnsType<StudentStats> = [
    { title: "姓名", dataIndex: "name", sorter: (a, b) => a.name.localeCompare(b.name, "zh-CN") },
    { title: "拼音", dataIndex: "pinyin", sorter: (a, b) => a.pinyin.localeCompare(b.pinyin) },
    {
      title: "参与抽取",
      dataIndex: "active",
      filters: [
        { text: "参与", value: true },
        { text: "不参与", value: false }
      ],
      onFilter: (value, record) => record.active === value,
      render: (active) => (active ? <Tag color="green">参与</Tag> : <Tag>不参与</Tag>)
    },
    { title: "有效汇报", dataIndex: "report_count", sorter: (a, b) => a.report_count - b.report_count },
    { title: "有效提问", dataIndex: "question_count", sorter: (a, b) => a.question_count - b.question_count },
    { title: "请假次数", dataIndex: "absence_count", sorter: (a, b) => a.absence_count - b.absence_count },
    { title: "上一批刚抽中", dataIndex: "recently_drawn", render: (value) => (value ? <Tag color="orange">是</Tag> : <Tag>否</Tag>) },
    { title: "下次可抽", dataIndex: "eligible_for_next_draw", render: (value) => (value ? <Tag color="green">是</Tag> : <Tag>否</Tag>) },
    { title: "当前权重", dataIndex: "weight", sorter: (a, b) => a.weight - b.weight },
    { title: "权重说明", dataIndex: "reason" },
    {
      title: "操作",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(record)} />
          <Popconfirm title="确认删除或停用该学生？" onConfirm={() => deleteStudent(record)}>
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
          学生名单
        </Typography.Title>
        <Space>
          <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
            批量导入
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增学生
          </Button>
        </Space>
      </div>
      <div className="toolbar">
        <Input.Search placeholder="搜索姓名或拼音" allowClear onSearch={setKeyword} onChange={(event) => setKeyword(event.target.value)} style={{ maxWidth: 280 }} />
        <Button icon={<ReloadOutlined />} onClick={() => loadStudents()}>
          刷新
        </Button>
      </div>
      <div className="stat-grid">
        <StatCard title="当前名单人数" value={summary.total} />
        <StatCard title="参与抽取人数" value={summary.active} />
        <StatCard title="尚未汇报人数" value={summary.unreported} />
        <StatCard title="从未提问人数" value={summary.neverQuestioned} />
        <StatCard title="累计请假次数" value={summary.totalAbsences} />
        <StatCard title="有请假记录人数" value={summary.withAbsence} />
      </div>
      <div className="student-chart-grid">
        <div className="content-band student-chart-panel">
          <Typography.Title level={4}>名单概览</Typography.Title>
          <div className="ratio-list">
            {ratioItems.map((item) => {
              const percent = summary.total > 0 ? (item.primaryCount / summary.total) * 100 : 0;
              return (
                <div className="ratio-row" key={item.label} style={{ "--ratio-color": item.color } as CSSProperties}>
                  <div className="ratio-row-header">
                    <span>{item.label}</span>
                    <span>
                      {item.primaryCount}/{summary.total}
                    </span>
                  </div>
                  <div className="ratio-track">
                    <div className="ratio-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <div className="ratio-labels">
                    <span>
                      {item.primaryLabel} {item.primaryCount}
                    </span>
                    <span>
                      {item.secondaryLabel} {item.secondaryCount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="content-band student-chart-panel">
          <div className="student-chart-panel-header">
            <Typography.Title level={4}>请假次数排行</Typography.Title>
            <Typography.Text className="muted">前 5 名</Typography.Text>
          </div>
          {absenceRanking.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无请假记录" />
          ) : (
            <div className="absence-ranking">
              {absenceRanking.map((student, index) => {
                const percent = maxAbsenceCount > 0 ? (student.absence_count / maxAbsenceCount) * 100 : 0;
                return (
                  <div className="absence-rank-row" key={student.id}>
                    <div className="absence-rank-main">
                      <span className="absence-rank-index">{index + 1}</span>
                      <span className="absence-rank-name">{student.name}</span>
                      <span className="muted">{student.pinyin}</span>
                      <span className="absence-rank-count">{student.absence_count} 次</span>
                    </div>
                    <div className="absence-rank-track">
                      <div className="absence-rank-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Table<StudentStats> rowKey="id" loading={loading} dataSource={filtered} columns={columns} scroll={{ x: 1400 }} />
      <Modal title={editing ? "编辑学生" : "新增学生"} open={modalOpen} onOk={saveStudent} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" initialValues={{ active: true }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pinyin" label="拼音唯一标识" rules={[{ required: true, message: "请输入拼音" }]}>
            <Input placeholder="例如 zhangsan" />
          </Form.Item>
          <Form.Item name="active" label="参与抽取" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="批量导入学生"
        open={importOpen}
        onOk={importStudents}
        okText="开始导入"
        onCancel={() => setImportOpen(false)}
        width={720}
      >
        <Typography.Paragraph className="muted">
          支持 CSV 或 TSV。可使用表头：name,pinyin,active,note，也可直接粘贴两列：姓名,拼音。重复 pinyin 会自动跳过。
        </Typography.Paragraph>
        <input
          type="file"
          accept=".csv,.tsv,.txt"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readImportFile(file);
          }}
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          rows={10}
          value={importText}
          onChange={(event) => {
            setImportText(event.target.value);
            setImportResult(null);
          }}
          placeholder={"name,pinyin,active,note\n张三,zhangsan,true,\n李四,lisi,true,班长"}
        />
        {importResult && (
          <Alert
            style={{ marginTop: 12 }}
            type={importResult.error_count > 0 ? "warning" : "success"}
            showIcon
            message={`新增 ${importResult.created_count} 人，跳过重复 ${importResult.skipped_count} 人，错误 ${importResult.error_count} 行`}
            description={
              <>
                {importResult.skipped.length > 0 && <div>跳过：{importResult.skipped.join("；")}</div>}
                {importResult.errors.length > 0 && (
                  <div>
                    错误：
                    {importResult.errors.map((item) => `第 ${item.row} 行 ${item.message}`).join("；")}
                  </div>
                )}
              </>
            }
          />
        )}
      </Modal>
    </>
  );
}
