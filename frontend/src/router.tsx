import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import { getToken } from "./api/client";
import DashboardPage from "./pages/DashboardPage";
import DrawHistoryPage from "./pages/DrawHistoryPage";
import DrawPage from "./pages/DrawPage";
import ExportPage from "./pages/ExportPage";
import LoginPage from "./pages/LoginPage";
import QuestionsPage from "./pages/QuestionsPage";
import ReportsPage from "./pages/ReportsPage";
import StudentsPage from "./pages/StudentsPage";

function ProtectedLayout() {
  if (!getToken()) {
    return <Navigate to="/login" replace />;
  }
  return <AppLayout />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "students", element: <StudentsPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "questions", element: <QuestionsPage /> },
      { path: "draw", element: <DrawPage /> },
      { path: "draw-history", element: <DrawHistoryPage /> },
      { path: "exports", element: <ExportPage /> }
    ]
  },
  { path: "*", element: <Navigate to="/" replace /> }
]);
