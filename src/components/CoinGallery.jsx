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

// --- SHARED COMPONENT: PERIOD HEADER ---
const PeriodHeader = ({
  title,
  count,
  ownedCount,
  isExpanded,
  borderColor,
}) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        height: "100%", // Fill the wrapper
        userSelect: "none",
      }}
    >
      <div
        className="period-chevron"
        style={{
          marginRight: "0.5rem",
          transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
        }}
      >
        <ChevronDown size={18} />
      </div>

      <h3
        className="period-title"
        style={{
          fontSize: "1rem",
          fontWeight: "700",
          color: "#475569",
          margin: 0,
          borderLeft: `4px solid ${borderColor}`,
          paddingLeft: "0.75rem",
        }}
      >
        {title}
      </h3>

      <span
        className="category-count"
        style={{
          fontSize: "0.85rem",
          background: "#f1f5f9",
          marginLeft: "1rem",
        }}
      >
        {count} coins
        <span className="owned-in-category">• {ownedCount} owned</span>
      </span>
    </div>
  );
};

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
  const [expandedCategories, setExpandedCategories] = useState({});
  const toggleCategory = (id) => {
    setExpandedCategories((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const [collapsedPeriods, setCollapsedPeriods] = useState({});

  // FIX: Accept both IDs to create a unique key per category-period combo
  const togglePeriod = (categoryId, periodId) => {
    const key = `${categoryId}-${periodId}`;
    setCollapsedPeriods((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // --- HELPER: Group Coins by Period ---
  const getCoinsByPeriod = (categoryCoins) => {
    const periodMap = {};
    const noPeriodKey = "no_period";

    categoryCoins.forEach((c) => {
      const pid = c.period_id || noPeriodKey;
      const pName = c.d_period?.period_name || "General Issues";
      const startYear = c.d_period?.period_start_year || 0;

      if (!periodMap[pid]) {
        periodMap[pid] = {
          id: pid,
          name: pName,
          startYear: startYear,
          coins: [],
        };
      }
      periodMap[pid].coins.push(c);
    });
    return Object.values(periodMap).sort((a, b) => b.startYear - a.startYear);
  };

  // --- VIRTUALIZER (GRID ONLY) ---
  const virtualRows = useMemo(() => {
    if (loading || viewMode === "table") return [];
    const rows = [];

    groupedCoins.forEach((group) => {
      // 1. Category Header
      rows.push({ type: "header", group });

      if (expandedCategories[group.id]) {
        const periodGroups = getCoinsByPeriod(group.coins);

        periodGroups.forEach((period, pIndex) => {
          // FIX: Check state using the unique compound key
          const uniqueKey = `${group.id}-${period.id}`;
          const isPeriodExpanded = !collapsedPeriods[uniqueKey];

          const isLastPeriod = pIndex === periodGroups.length - 1;
          const periodOwnedCount = period.coins.filter(
            (c) => c.is_owned
          ).length;
          const isLastVisualElement = isLastPeriod && !isPeriodExpanded;

          // 2. Period Subheader Row
          rows.push({
            type: "subheader",
            title: period.name,
            count: period.coins.length,
            ownedCount: periodOwnedCount,
            groupId: group.id,
            periodId: period.id,
            isExpanded: isPeriodExpanded,
            isLastInGroup: isLastVisualElement,
          });

          if (isPeriodExpanded) {
            // 3. Coin Rows
            for (let i = 0; i < period.coins.length; i += columns) {
              const isLastRowInPeriod = i + columns >= period.coins.length;
              const isLastRowInGroup = isLastPeriod && isLastRowInPeriod;

              rows.push({
                type: "row",
                coins: period.coins.slice(i, i + columns),
                groupId: group.id,
                isLast: isLastRowInGroup,
              });
            }
          }
        });
      }
    });
    return rows;
  }, [
    groupedCoins,
    expandedCategories,
    collapsedPeriods,
    columns,
    loading,
    viewMode,
  ]);

  const rowVirtualizer = useWindowVirtualizer({
    count: virtualRows.length,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (row.type === "header") return 94; // Category Header
      if (row.type === "subheader") return 50; // Period Header (Fixed Height)
      return 380; // Coin Row
    },
    overscan: 5,
    scrollMargin: offsetTop,
  });

  // --- BACKGROUND CLICK HANDLER (COLLAPSE LOGIC) ---
  const handleRowBackgroundClick = (e, groupId) => {
    if (
      e.target === e.currentTarget ||
      e.target.classList.contains("virtual-row") ||
      e.target.classList.contains("virtual-spacer") ||
      e.target.classList.contains("period-row") ||
      e.target.classList.contains("category-content") ||
      e.target.classList.contains("period-group") ||
      e.target.classList.contains("period-content-wrapper")
    ) {
      toggleCategory(groupId);
    }
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
            const isCategoryExpanded = expandedCategories[group.id];

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
                {/* Category Header */}
                <div
                  className="category-header"
                  onClick={() => toggleCategory(group.id)}
                  style={{
                    backgroundColor: group.color.bg,
                    borderTop: `1px solid ${group.color.border}`,
                    borderLeft: `1px solid ${group.color.border}`,
                    borderRight: `1px solid ${group.color.border}`,
                    borderBottom: isCategoryExpanded
                      ? "none"
                      : `1px solid ${group.color.border}`,
                    borderRadius: isCategoryExpanded ? "12px 12px 0 0" : "12px",
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
                    {isCategoryExpanded ? (
                      <ChevronUp size={20} />
                    ) : (
                      <ChevronDown size={20} />
                    )}
                  </button>
                </div>

                {isCategoryExpanded && (
                  <div
                    className="category-content"
                    onClick={(e) => handleRowBackgroundClick(e, group.id)}
                    title="Click background to collapse category"
                    style={{
                      // REMOVED PADDING: Allows headers to go edge-to-edge
                      padding: "0",
                      backgroundColor: "white",
                      borderLeft: `1px solid ${group.color.border}`,
                      borderRight: `1px solid ${group.color.border}`,
                      borderBottom: `1px solid ${group.color.border}`,
                      borderTop: "none",
                      borderRadius: "0 0 12px 12px",
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                  >
                    {/* PERIODS LOOP */}
                    {getCoinsByPeriod(group.coins).map((periodGroup) => {
                      const periodOwnedCount = periodGroup.coins.filter(
                        (c) => c.is_owned
                      ).length;

                      // FIX: Check state using compound key
                      const uniqueKey = `${group.id}-${periodGroup.id}`;
                      const isPeriodExpanded = !collapsedPeriods[uniqueKey];

                      return (
                        <div
                          key={periodGroup.id}
                          className="period-group"
                          style={{ cursor: "default" }}
                        >
                          {/* TABLE HEADER WRAPPER */}
                          <div
                            className="period-row"
                            // FIX: Pass both IDs
                            onClick={() =>
                              togglePeriod(group.id, periodGroup.id)
                            }
                            style={{
                              padding: "0 1.5rem",
                              height: "50px",
                              display: "flex",
                              alignItems: "center",
                              cursor: "pointer",
                              backgroundColor: "white",
                            }}
                          >
                            <PeriodHeader
                              title={periodGroup.name}
                              count={periodGroup.coins.length}
                              ownedCount={periodOwnedCount}
                              isExpanded={isPeriodExpanded}
                              borderColor={group.color.border}
                            />
                          </div>

                          {isPeriodExpanded && (
                            // WRAPPER FOR CONTENT TO RESTORE PADDING
                            <div
                              className="period-content-wrapper"
                              style={{
                                padding: "0 1.5rem 1.5rem 1.5rem",
                                cursor: "pointer",
                              }}
                            >
                              <CoinTable
                                coins={periodGroup.coins}
                                onCoinClick={onCoinClick}
                              />
                            </div>
                          )}
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
        /* --- GRID MODE (Virtualized) --- */
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

            const groupColor =
              row.type === "header"
                ? row.group.color
                : groupedCoins.find((g) => g.id === row.groupId)?.color;
            const borderColor = groupColor ? groupColor.border : "#e5e7eb";

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
                {/* 1. CATEGORY HEADER */}
                {row.type === "header" ? (
                  <div
                    className="category-section"
                    style={{
                      backgroundColor: row.group.color.bg,
                      borderTop: `1px solid ${borderColor}`,
                      borderLeft: `1px solid ${borderColor}`,
                      borderRight: `1px solid ${borderColor}`,
                      borderBottom: expandedCategories[row.group.id]
                        ? "none"
                        : `1px solid ${borderColor}`,
                      marginTop: "24px",
                      marginBottom: 0,
                      borderRadius: expandedCategories[row.group.id]
                        ? "12px 12px 0 0"
                        : "12px",
                      height: "70px",
                      boxSizing: "border-box",
                    }}
                  >
                    <div
                      className="category-header"
                      onClick={() => toggleCategory(row.group.id)}
                      style={{ borderBottom: "none" }}
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
                        {expandedCategories[row.group.id] ? (
                          <ChevronUp size={20} />
                        ) : (
                          <ChevronDown size={20} />
                        )}
                      </button>
                    </div>
                  </div>
                ) : row.type === "subheader" ? (
                  /* 2. PERIOD SUB-HEADER (Grid View) */
                  <div
                    className="period-row"
                    // FIX: Pass both IDs using row data
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePeriod(row.groupId, row.periodId);
                    }}
                    style={{
                      backgroundColor: "#fff",
                      padding: "0 1.5rem",
                      borderLeft: `1px solid ${borderColor}`,
                      borderRight: `1px solid ${borderColor}`,
                      borderTop: "none",
                      borderBottom: row.isLastInGroup
                        ? `1px solid ${borderColor}`
                        : "none",
                      borderRadius: row.isLastInGroup ? "0 0 12px 12px" : "0",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      boxSizing: "border-box",
                      cursor: "pointer",
                    }}
                  >
                    <PeriodHeader
                      title={row.title}
                      count={row.count}
                      ownedCount={row.ownedCount}
                      isExpanded={row.isExpanded}
                      borderColor={borderColor}
                    />
                  </div>
                ) : (
                  /* 3. COIN ROW */
                  <div
                    className="period-row virtual-row-container"
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
