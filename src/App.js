
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Devices from "./pages/Devices";
import ProtectedRoute from "./auth/ProtectedRoute";
import ProtectedLayout from "./auth/ProtectedLayout";

import IrrigationDashboard from "./IrrigationDashboard";
import PlantJournal from "./pages/Alerts";
import PlantAssistant from "./pages/PlantAssistant";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<ProtectedLayout />}>
            <Route path="/app" element={<Home />} />
            <Route path="/dashboard" element={<IrrigationDashboard />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/journal" element={<PlantJournal />} />
            <Route path="/alerts" element={<PlantJournal />} />
            <Route path="/assistant" element={<PlantAssistant />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
