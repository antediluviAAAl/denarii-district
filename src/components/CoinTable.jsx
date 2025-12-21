import React, { useMemo, useState, memo } from "react";
import { Check, X, Minus } from "lucide-react";

// --- MEMOIZED MATRIX COMPONENT ---
// This component only re-renders when the DATA changes,
// not when the tooltip hovers over it.
const CoinMatrix = memo(function CoinMatrix({
  years,
  denominations,
  matrix,
  hoverState,
  onCoinClick,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
}) {
  return (
    <table className="coin-matrix-table">
      <thead>
        <tr>
          <th className="sticky-col-left">Year</th>
          {denominations.map((d) => (
            <th key={d}>{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {years.map((year) => (
          <tr key={year}>
            <td className="sticky-col-left year-cell">
              {year > 0 ? year : "ND"}
            </td>

            {denominations.map((denom) => {
              const cellCoins = matrix[`${year}-${denom}`];
              const hasCoins = cellCoins && cellCoins.length > 0;
              const isMixed =
                hasCoins &&
                cellCoins.some((c) => c.is_owned) &&
                cellCoins.some((c) => !c.is_owned);
              const allOwned = hasCoins && cellCoins.every((c) => c.is_owned);

              let cellClass = "empty";
              if (allOwned) cellClass = "owned-cell";
              else if (isMixed) cellClass = "mixed-cell";
              else if (hasCoins) cellClass = "unowned-cell";

              return (
                <td
                  key={`${year}-${denom}`}
                  className={`matrix-cell ${cellClass}`}
                >
                  {hasCoins ? (
                    <div className="multi-coin-container">
                      {cellCoins.map((coin, index) => {
                        const isSeriesHighlighted =
                          hoverState.seriesId &&
                          coin.series_id === hoverState.seriesId;

                        const isDimmed =
                          hoverState.seriesId && !isSeriesHighlighted;

                        return (
                          <div
                            key={coin.coin_id}
                            className={`coin-item-wrapper ${
                              coin.is_owned ? "owned" : "unowned"
                            } ${
                              isSeriesHighlighted ? "series-highlight" : ""
                            } ${isDimmed ? "dimmed" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCoinClick(coin);
                            }}
                            onMouseEnter={(e) => onMouseEnter(e, coin)}
                            onMouseMove={onMouseMove}
                            onMouseLeave={onMouseLeave}
                          >
                            {index > 0 && (
                              <div className="coin-separator"></div>
                            )}

                            <div className="coin-item-content">
                              <span className="cell-denom-label">
                                {coin.subject
                                  ? coin.subject.substring(0, 8)
                                  : denom}
                              </span>
                              {coin.is_owned ? (
                                <Check size={16} strokeWidth={3} />
                              ) : (
                                <X size={16} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="cell-empty">
                      <Minus size={12} />
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
});

export default function CoinTable({ coins, onCoinClick }) {
  // --- STATE ---
  const [hoverState, setHoverState] = useState({
    coin: null,
    seriesId: null,
    x: 0,
    y: 0,
  });

  // --- DATA PIVOT ---
  const { years, denominations, matrix } = useMemo(() => {
    const yearsSet = new Set();
    const denomsSet = new Set();
    const lookup = {};

    coins.forEach((coin) => {
      const y = coin.year || 0;
      const d = coin.d_denominations?.denomination_name || "Unknown";

      yearsSet.add(y);
      denomsSet.add(d);

      const key = `${y}-${d}`;
      if (!lookup[key]) {
        lookup[key] = [];
      }
      lookup[key].push(coin);
    });

    Object.keys(lookup).forEach((key) => {
      lookup[key].sort((a, b) => {
        if (a.is_owned === b.is_owned) {
          return (a.subject || "").localeCompare(b.subject || "");
        }
        return b.is_owned - a.is_owned;
      });
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
    const sortedDenoms = Array.from(denomsSet).sort((a, b) => {
      const numA = parseFloat(a) || 0;
      const numB = parseFloat(b) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });

    return {
      years: sortedYears,
      denominations: sortedDenoms,
      matrix: lookup,
    };
  }, [coins]);

  // --- HANDLERS ---
  const handleMouseEnter = (e, coin) => {
    const { clientX, clientY } = e;
    setHoverState({
      coin,
      seriesId: coin.series_id,
      x: clientX,
      y: clientY,
    });
  };

  const handleMouseMove = (e) => {
    // We keep this in parent to update Tooltip
    // Child (Matrix) ignores this unless we pass explicit props that change
    if (hoverState.coin) {
      setHoverState((prev) => ({
        ...prev,
        x: e.clientX,
        y: e.clientY,
      }));
    }
  };

  const handleMouseLeave = () => {
    setHoverState({
      coin: null,
      seriesId: null,
      x: 0,
      y: 0,
    });
  };

  if (coins.length === 0) return null;

  return (
    <div className="coin-table-wrapper">
      <div className="coin-table-container">
        <CoinMatrix
          years={years}
          denominations={denominations}
          matrix={matrix}
          hoverState={hoverState} // Needed for series highlighting
          onCoinClick={onCoinClick}
          onMouseEnter={handleMouseEnter}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* --- FLOATING TOOLTIP --- */}
      {hoverState.coin && (
        <div
          className="coin-hover-tooltip"
          style={{
            top: hoverState.y + 15,
            left: hoverState.x + 15,
          }}
        >
          <div className="tooltip-header">
            <span className="tooltip-title">{hoverState.coin.name}</span>
            <span className="tooltip-series">
              {hoverState.coin.d_series?.series_range || "Unknown Range"}
            </span>
          </div>
          <div className="tooltip-images">
            {hoverState.coin.display_obverse ? (
              <img
                src={hoverState.coin.display_obverse}
                alt="Obverse"
                className="tooltip-img"
              />
            ) : (
              <div className="tooltip-placeholder">No Obv</div>
            )}
            {hoverState.coin.display_reverse ? (
              <img
                src={hoverState.coin.display_reverse}
                alt="Reverse"
                className="tooltip-img"
              />
            ) : (
              <div className="tooltip-placeholder">No Rev</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
