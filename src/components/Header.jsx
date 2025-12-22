import { Database, CheckCircle } from "lucide-react";
// Import the SVG directly as a React Component (supported by create-react-app)
import { ReactComponent as DenariiLogo } from "../assets/logo.svg";

export default function Header({
  totalCoins = 264962,
  ownedCount,
  displayCount,
}) {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="app-title">
            <div className="app-icon">
              {/* Using the imported Logo, sizing handled via props or inline style */}
              <DenariiLogo style={{ width: 48, height: 48 }} />
            </div>
            {/* Split Title for custom styling */}
            <span className="title-denarii">Denarii</span>
            <span className="title-district"> District</span>
          </h1>
          <p className="app-subtitle">
            <Database size={16} />
            <span>{totalCoins.toLocaleString()} coins in database</span>
            <span className="owned-count">
              <CheckCircle size={14} />
              {ownedCount} owned
            </span>
          </p>
        </div>

        <div className="header-stats">
          <div className="stat-badge">
            <span className="stat-label">Showing</span>
            <span className="stat-value">{displayCount}</span>
          </div>
        </div>
      </div>
    </header>
  );
}