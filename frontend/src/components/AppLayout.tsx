import {
  CalendarOutlined,
  DashboardOutlined,
  DownloadOutlined,
  HistoryOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserDeleteOutlined
} from "@ant-design/icons";
import { Button, Layout, Menu, Typography } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearToken } from "../api/client";

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: "/", icon: <DashboardOutlined />, label: "首页 Dashboard" },
  { key: "/course-sessions", icon: <CalendarOutlined />, label: "课程日程" },
  { key: "/students", icon: <TeamOutlined />, label: "学生名单" },
  { key: "/absences", icon: <UserDeleteOutlined />, label: "请假名单" },
  { key: "/reports", icon: <ReadOutlined />, label: "汇报记录" },
  { key: "/questions", icon: <QuestionCircleOutlined />, label: "提问记录" },
  { key: "/draw", icon: <ThunderboltOutlined />, label: "随机抽取" },
  { key: "/draw-history", icon: <HistoryOutlined />, label: "抽取历史" },
  { key: "/exports", icon: <DownloadOutlined />, label: "数据导出" }
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const logout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="app-logo">JUMP 课堂管理</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={(item) => navigate(item.key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingInline: 20
          }}
        >
          <Typography.Text strong>JUMP R 语言课程课堂汇报抽取系统</Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={logout}>
            退出
          </Button>
        </Header>
        <Content style={{ padding: 20 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
