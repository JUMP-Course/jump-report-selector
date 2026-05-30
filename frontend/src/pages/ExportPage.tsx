import { DownloadOutlined } from "@ant-design/icons";
import { Button, Typography, message } from "antd";
import { downloadFile } from "../api/client";

const exports = [
  { label: "学生名单", path: "/exports/students.csv", filename: "students.csv" },
  { label: "学生统计表", path: "/exports/student_stats.csv", filename: "student_stats.csv" },
  { label: "课程日程", path: "/exports/course_sessions.csv", filename: "course_sessions.csv" },
  { label: "汇报记录", path: "/exports/reports.csv", filename: "reports.csv" },
  { label: "提问记录", path: "/exports/questions.csv", filename: "questions.csv" },
  { label: "抽取历史", path: "/exports/draw_history.csv", filename: "draw_history.csv" }
];

export default function ExportPage() {
  const [messageApi, contextHolder] = message.useMessage();

  const handleDownload = async (item: (typeof exports)[number]) => {
    try {
      await downloadFile(item.path, item.filename);
      messageApi.success(`${item.label} 已开始下载`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "下载失败");
    }
  };

  return (
    <>
      {contextHolder}
      <div className="page-header">
        <Typography.Title level={2} className="page-title">
          数据导出
        </Typography.Title>
      </div>
      <div className="content-band">
        <div className="export-grid">
          {exports.map((item) => (
            <Button key={item.path} icon={<DownloadOutlined />} size="large" onClick={() => handleDownload(item)}>
              下载{item.label}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}
