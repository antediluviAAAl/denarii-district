import { Coins, Database, CheckCircle } from "lucide-react";

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
              <Coins size={24} />
            </div>
            <span>Denarii District</span>
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
