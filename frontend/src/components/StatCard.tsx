import { Card, Statistic } from "antd";

interface StatCardProps {
  title: string;
  value: number;
}

export default function StatCard({ title, value }: StatCardProps) {
  return (
    <Card size="small">
      <Statistic title={title} value={value} />
    </Card>
  );
}
