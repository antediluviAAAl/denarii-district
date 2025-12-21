import React, { useMemo, useState } from "react";
import { Check, X, Minus } from "lucide-react";

export default function CoinTable({ coins, onCoinClick }) {
  // --- STATE FOR INTERACTIONS ---
  const [hoverState, setHoverState] = useState({
    coin: null,
    seriesId: null,
    x: 0,
    y: 0,
  });

  // 1. Pivot Data: Extract Unique Years and Denominations
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

    // Sort coins within each cell: Owned first, then by subject/name
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

  // --- MOUSE HANDLERS ---
  const handleMouseEnter = (e, coin) => {
    // Get client coordinates for fixed tooltip positioning
    const { clientX, clientY } = e;
    setHoverState({
      coin,
      seriesId: coin.series_id, // Capture series for highlighting
      x: clientX,
      y: clientY,
    });
  };

  const handleMouseMove = (e) => {
    // Update tooltip position to follow cursor slightly
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
                  const allOwned =
                    hasCoins && cellCoins.every((c) => c.is_owned);

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
                            // Check if this coin belongs to the active hovered series
                            const isSeriesHighlighted =
                              hoverState.seriesId &&
                              coin.series_id === hoverState.seriesId;

                            // Dim others if we are hovering something but not this one
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
                                onMouseEnter={(e) => handleMouseEnter(e, coin)}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
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
      </div>

      {/* --- FLOATING TOOLTIP --- */}
      {hoverState.coin && (
        <div
          className="coin-hover-tooltip"
          style={{
            top: hoverState.y + 15, // Offset slightly below cursor
            left: hoverState.x + 15, // Offset slightly right of cursor
          }}
        >
          <div className="tooltip-header">
            <span className="tooltip-title">{hoverState.coin.name}</span>
            <span className="tooltip-series">
              {/* UPDATED: Showing Series Range instead of Series Name */}
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
