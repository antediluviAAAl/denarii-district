import React from "react";

export default function CoinCardSkeleton() {
  return (
    <div className="coin-card skeleton-card">
      <div className="card-front">
        <div className="coin-image-container skeleton-pulse"></div>
        <div className="coin-details">
          <div className="skeleton-text skeleton-title skeleton-pulse"></div>
          <div className="coin-info">
            <div className="skeleton-text skeleton-line skeleton-pulse"></div>
            <div className="skeleton-text skeleton-line skeleton-pulse"></div>
          </div>
          <div className="skeleton-text skeleton-subject skeleton-pulse"></div>
        </div>
      </div>
    </div>
  );
}
