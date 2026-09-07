import { useEffect, useState } from "react";
import { login, logout, checkAuth } from "./api";
import ObjectSelector from "./components/ObjectSelector";
import RecordList from "./components/RecordList";

const BOOT_LINES = [
  "connecting to org...",
  "verifying oauth scope: api, refresh_token",
  <>status: <span className="ok">ready</span></>,
];

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [checked, setChecked] = useState(false);
  const [selectedObject, setSelectedObject] = useState("");

  useEffect(() => {
    checkAuth()
      .then(setLoggedIn)
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null;

  if (!loggedIn) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-logo">
            <span className="brand-mark">$</span>
            <span className="brand-name">Records Manager</span>
          </div>

          {BOOT_LINES.map((line, i) => (
            <div className="boot-line" key={i} style={{ animationDelay: `${0.15 + i * 0.2}s` }}>
              {line}
            </div>
          ))}

          <h1 className="login-title">Log in to continue</h1>
          <p className="login-sub">
            Connect your Salesforce account to manage Accounts, Opportunities,
            Leads, Contacts, and Cases directly — no native UI required.
          </p>
          <div className="login-cta">
            <button className="btn login-btn" onClick={login}>
              Log in to Salesforce
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <span className="brand-mark">$</span>
          <span className="brand-name">Records Manager</span>
        </div>
        <button className="btn btn-ghost" onClick={logout}>
          Log out
        </button>
      </div>

      <div className="toolbar">
        <ObjectSelector value={selectedObject} onChange={setSelectedObject} />
      </div>

      {selectedObject ? (
        <RecordList objectName={selectedObject} />
      ) : (
        <div className="empty-state">select an object above to begin →</div>
      )}
    </div>
  );
}