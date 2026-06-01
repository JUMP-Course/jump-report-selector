import { Alert, Typography } from "antd";

export default function WeightExplanation() {
  return (
    <Alert
      type="info"
      showIcon
      message="抽取权重说明"
      description={
        <Typography.Text>
          未有效汇报基础权重为 10，已汇报 1 次为 2，已汇报 2 次及以上为 0.5；有效提问越多会适当降低重复被抽中概率；
          上一节课刚有效汇报过会进入冷却；上一批刚抽中过的学生下一次会被自动排除。除上一批刚抽中过外，最终权重最低保留 0.01。
        </Typography.Text>
      }
    />
  );
}
