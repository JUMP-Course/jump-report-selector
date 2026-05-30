import { LockOutlined } from "@ant-design/icons";
import { Button, Form, Input, message, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api/client";

interface LoginResponse {
  access_token: string;
  token_type: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const onFinish = async (values: { password: string }) => {
    try {
      const data = await api.post<LoginResponse>("/auth/login", values);
      setToken(data.access_token);
      messageApi.success("登录成功");
      navigate("/", { replace: true });
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "登录失败");
    }
  };

  return (
    <div className="login-page">
      {contextHolder}
      <div className="login-panel">
        <Typography.Title level={3}>JUMP 课堂管理</Typography.Title>
        <Typography.Paragraph className="muted">请输入共享密码进入管理界面。</Typography.Paragraph>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="password" label="共享密码" rules={[{ required: true, message: "请输入共享密码" }]}>
            <Input.Password prefix={<LockOutlined />} autoFocus />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form>
      </div>
    </div>
  );
}
