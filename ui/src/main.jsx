import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScenarioProvider } from "./context/ScenarioContext.jsx";
import App from "./App.jsx";
import FormPage from "./pages/FormPage.jsx";
import FlowPage from "./pages/FlowPage.jsx";
import TutorialPage from "./pages/TutorialPage.jsx";
import TutorialDetailPage from "./pages/TutorialDetailPage.jsx";
import SetupDetailPage from "./pages/SetupDetailPage.jsx";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ScenarioProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<FormPage />} />
            <Route path="flow" element={<FlowPage />} />
            <Route path="tutorial" element={<TutorialPage />} />
            <Route path="tutorial/:id" element={<TutorialDetailPage />} />
            <Route path="setup/:id" element={<SetupDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ScenarioProvider>
  </React.StrictMode>
);
