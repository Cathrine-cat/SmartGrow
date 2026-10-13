
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ProtectedRoute from "./auth/ProtectedRoute";
import ProtectedLayout from "./auth/ProtectedLayout";

import IrrigationDashboard from "./IrrigationDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public pages */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Protected pages */}
        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedLayout />}>
            <Route
              path="/dashboard"
              element={<IrrigationDashboard />}
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
