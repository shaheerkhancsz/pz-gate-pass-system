import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Clear stale localStorage config from old PZ setup
localStorage.removeItem("companyConfig");

createRoot(document.getElementById("root")!).render(<App />);
