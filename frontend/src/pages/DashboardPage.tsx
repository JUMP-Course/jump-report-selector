import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import StatCard from "../components/StatCard";
import type { DashboardData } from "../types";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const loadData = async () => {
    setLoading(true);
    try {
      const dashboard = await api.get<DashboardData>("/dashboard");
      setData(dashboard);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "加载首页失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <>
      {contextHolder}
      <div className="page-header">
        <Typography.Title level={2} className="page-title">
          首页 Dashboard
        </Typography.Title>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadData()}>
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
        <Typography.Title level={4}>老师操作说明</Typography.Title>
        <Typography.Paragraph>
          先在课程日程页维护上课安排。当天日期与课程日程精确匹配时，汇报、提问和随机抽取页面会自动填入今天的课次和日期。
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
    </>
  );
}
