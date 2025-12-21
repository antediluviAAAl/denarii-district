import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useWindowSize } from "../hooks/useWindowSize";
import CoinCard from "./CoinCard";
import CoinTable from "./CoinTable";

const CATEGORY_COLORS = [
  { bg: "#fef3c7", border: "#f59e0b", text: "#92400e" },
  { bg: "#fee2e2", border: "#ef4444", text: "#991b1b" },
  { bg: "#dbeafe", border: "#3b82f6", text: "#1e40af" },
  { bg: "#d1fae5", border: "#10b981", text: "#065f46" },
  { bg: "#f3e8ff", border: "#8b5cf6", text: "#5b21b6" },
  { bg: "#f1f5f9", border: "#94a3b8", text: "#475569" },
];

export default function CoinGallery({
  coins,
  loading,
  categories,
  onCoinClick,
  viewMode,
  setViewMode,
}) {
  const { width } = useWindowSize();
  const parentRef = useRef(null);
  const [offsetTop, setOffsetTop] = useState(0);

  useEffect(() => {
    if (parentRef.current) setOffsetTop(parentRef.current.offsetTop);
  }, [width]);

  // --- GRID LOGIC ---
  const columns = useMemo(() => {
    if (width < 650) return 1;
    if (width < 950) return 2;
    if (width < 1300) return 3;
    return 4;
  }, [width]);

  // Group by Category (Top Level)
  const groupedCoins = useMemo(() => {
    const groupsMap = {};
    categories.forEach((cat, index) => {
      groupsMap[cat.type_id] = {
        id: cat.type_id,
        name: cat.type_name,
        coins: [],
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      };
    });

    const uncategorizedId = "uncategorized";
    coins.forEach((coin) => {
      const typeId = coin.type_id;
      if (typeId && groupsMap[typeId]) {
        groupsMap[typeId].coins.push(coin);
      } else {
        if (!groupsMap[uncategorizedId]) {
          groupsMap[uncategorizedId] = {
            id: uncategorizedId,
            name: "Uncategorized",
            coins: [],
            color: CATEGORY_COLORS[5],
          };
        }
        groupsMap[uncategorizedId].coins.push(coin);
      }
    });

    return Object.values(groupsMap)
      .filter((g) => g.coins.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [coins, categories]);

  // --- EXPAND/COLLAPSE STATE ---
  // Default is empty object {}.
  // In our logic, undefined means "Collapsed".
  // Clicking toggle sets it to true (Expanded).
  // This satisfies the requirement for "Start Collapsed" in both Grid and Table.
  const [expanded, setExpanded] = useState({});

  const toggleCategory = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // --- CLICK HANDLER ---
  const handleRowBackgroundClick = (e, groupId) => {
    if (
      e.target === e.currentTarget ||
      e.target.classList.contains("virtual-row") ||
      e.target.classList.contains("virtual-spacer") ||
      e.target.classList.contains("category-content")
    ) {
      toggleCategory(groupId);
    }
  };

  // --- VIRTUALIZER (GRID ONLY) ---
  const virtualRows = useMemo(() => {
    if (loading || viewMode === "table") return [];
    const rows = [];
    groupedCoins.forEach((group) => {
      rows.push({ type: "header", group });
      if (expanded[group.id]) {
        for (let i = 0; i < group.coins.length; i += columns) {
          rows.push({
            type: "row",
            coins: group.coins.slice(i, i + columns),
            groupId: group.id,
            isLast: i + columns >= group.coins.length,
          });
        }
      }
    });
    return rows;
  }, [groupedCoins, expanded, columns, loading, viewMode]);

  const rowVirtualizer = useWindowVirtualizer({
    count: virtualRows.length,
    estimateSize: (index) => (virtualRows[index].type === "header" ? 94 : 380),
    overscan: 5,
    scrollMargin: offsetTop,
  });

  // --- HELPER: Group Coins by Period (For Table Mode) ---
  const getCoinsByPeriod = (categoryCoins) => {
    const periodMap = {};
    categoryCoins.forEach((c) => {
      const pid = c.period_id;
      const pName = c.d_period?.period_name;
      const startYear = c.d_period?.period_start_year || 0;

      if (pid && pName) {
        if (!periodMap[pid]) {
          periodMap[pid] = {
            id: pid,
            name: pName,
            startYear: startYear,
            coins: [],
          };
        }
        periodMap[pid].coins.push(c);
      }
    });

    return Object.values(periodMap).sort((a, b) => b.startYear - a.startYear);
  };

  if (loading) {
    return (
      <div className="categories-container" style={{ marginTop: "1.5rem" }}>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading collection...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="categories-container"
      style={{ paddingBottom: "2rem" }}
    >
      {/* View Toggles */}
      <div
        className="view-toggles"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "1rem",
          paddingRight: "1.5rem",
        }}
      >
        <div
          className="toggle-group"
          style={{
            display: "flex",
            gap: "4px",
            background: "white",
            padding: "4px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <button
            onClick={() => setViewMode("grid")}
            className={`toggle-btn ${viewMode === "grid" ? "active" : ""}`}
            title="Grid View"
          >
            <LayoutGrid size={20} />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`toggle-btn ${viewMode === "table" ? "active" : ""}`}
            title="Table View"
          >
            <TableIcon size={20} />
          </button>
        </div>
      </div>

      {viewMode === "table" ? (
        /* --- TABLE MODE --- */
        <div className="tables-layout">
          {groupedCoins.map((group) => {
            const catOwnedCount = group.coins.filter((c) => c.is_owned).length;
            const isExpanded = expanded[group.id];

            return (
              <div
                key={group.id}
                className="category-section"
                style={{
                  border: "none",
                  marginTop: "24px",
                  marginBottom: "0",
                  overflow: "visible",
                }}
              >
                <div
                  className="category-header"
                  onClick={() => toggleCategory(group.id)}
                  style={{
                    backgroundColor: group.color.bg,
                    borderTop: `1px solid ${group.color.border}`,
                    borderLeft: `1px solid ${group.color.border}`,
                    borderRight: `1px solid ${group.color.border}`,
                    borderBottom: isExpanded
                      ? "none"
                      : `1px solid ${group.color.border}`,
                    borderRadius: isExpanded ? "12px 12px 0 0" : "12px",
                    height: "70px",
                    boxSizing: "border-box",
                    marginBottom: "0",
                  }}
                >
                  <div className="category-title">
                    <h2
                      className="category-name"
                      style={{ color: group.color.text }}
                    >
                      {group.name}
                    </h2>
                    <span className="category-count">
                      {group.coins.length} coins
                      <span className="owned-in-category">
                        • {catOwnedCount} owned
                      </span>
                    </span>
                  </div>
                  <button className="category-toggle">
                    {isExpanded ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div
                    className="category-content"
                    onClick={(e) => handleRowBackgroundClick(e, group.id)}
                    title="Click background to collapse category"
                    style={{
                      padding: "1.5rem",
                      backgroundColor: "white",
                      borderLeft: `1px solid ${group.color.border}`,
                      borderRight: `1px solid ${group.color.border}`,
                      borderBottom: `1px solid ${group.color.border}`,
                      borderTop: "none",
                      borderRadius: "0 0 12px 12px",
                      cursor: "pointer",
                    }}
                  >
                    {/* Only calculate periods if we are actually rendering (Perf Boost) */}
                    {getCoinsByPeriod(group.coins).map((periodGroup) => {
                      const periodOwnedCount = periodGroup.coins.filter(
                        (c) => c.is_owned
                      ).length;

                      return (
                        <div
                          key={periodGroup.id}
                          className="period-group"
                          style={{ marginBottom: "2rem", cursor: "default" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "baseline",
                              gap: "1rem",
                              marginBottom: "1rem",
                              paddingLeft: "0.5rem",
                            }}
                          >
                            <h3
                              className="period-title"
                              style={{
                                fontSize: "1rem",
                                fontWeight: "700",
                                color: "#475569",
                                margin: 0,
                                borderLeft: `4px solid ${group.color.border}`,
                                paddingLeft: "0.75rem",
                              }}
                            >
                              {periodGroup.name}
                            </h3>
                            <span
                              className="category-count"
                              style={{
                                fontSize: "0.85rem",
                                background: "#f1f5f9",
                              }}
                            >
                              {periodGroup.coins.length} coins
                              <span className="owned-in-category">
                                • {periodOwnedCount} owned
                              </span>
                            </span>
                          </div>

                          <CoinTable
                            coins={periodGroup.coins}
                            onCoinClick={onCoinClick}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* --- GRID MODE --- */
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const row = virtualRows[virtualItem.index];
            if (!row) return null;
            const borderColor =
              row.type === "header"
                ? row.group.color.border
                : groupedCoins.find((g) => g.id === row.groupId)?.color
                    .border || "#e5e7eb";

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${
                    virtualItem.start - rowVirtualizer.options.scrollMargin
                  }px)`,
                }}
              >
                {row.type === "header" ? (
                  <div
                    className="category-section"
                    style={{
                      backgroundColor: row.group.color.bg,
                      borderTop: `1px solid ${borderColor}`,
                      borderLeft: `1px solid ${borderColor}`,
                      borderRight: `1px solid ${borderColor}`,
                      borderBottom: expanded[row.group.id]
                        ? "none"
                        : `1px solid ${borderColor}`,

                      marginTop: "24px",
                      marginBottom: 0,
                      borderRadius: expanded[row.group.id]
                        ? "12px 12px 0 0"
                        : "12px",
                      height: "70px",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      className="category-header"
                      onClick={() => toggleCategory(row.group.id)}
                      style={{
                        borderBottom: "none",
                      }}
                    >
                      <div className="category-title">
                        <h2
                          className="category-name"
                          style={{ color: row.group.color.text }}
                        >
                          {row.group.name}
                        </h2>
                        <span className="category-count">
                          {row.group.coins.length} coins
                          <span className="owned-in-category">
                            • {row.group.coins.filter((c) => c.is_owned).length}{" "}
                            owned
                          </span>
                        </span>
                      </div>
                      <button className="category-toggle">
                        {expanded[row.group.id] ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="category-content virtual-row-container"
                    onClick={(e) => handleRowBackgroundClick(e, row.groupId)}
                    title="Click background to collapse category"
                    style={{
                      backgroundColor: "rgb(255,255,255)",
                      padding: "0 1.5rem",
                      borderLeft: `1px solid ${borderColor}`,
                      borderRight: `1px solid ${borderColor}`,
                      borderBottom: row.isLast
                        ? `1px solid ${borderColor}`
                        : "none",
                      borderTop: "none",

                      borderRadius: row.isLast ? "0 0 12px 12px" : "0",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      boxSizing: "border-box",
                      cursor: "pointer",
                    }}
                  >
                    <div className="virtual-row">
                      {row.coins.map((coin) => (
                        <CoinCard
                          key={coin.coin_id}
                          coin={coin}
                          onClick={onCoinClick}
                        />
                      ))}
                      {Array.from({ length: columns - row.coins.length }).map(
                        (_, i) => (
                          <div key={`spacer-${i}`} className="virtual-spacer" />
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
