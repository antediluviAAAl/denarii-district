import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useWindowSize } from "../hooks/useWindowSize";
import CoinCard from "./CoinCard";
import CoinTable from "./CoinTable";
import CoinListItem from "./CoinListItem"; // NEW IMPORT

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
        height: "100%",
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
        <span className="text-gold">{count} coins</span>
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
  sortBy,
}) {
  const { width } = useWindowSize();
  const parentRef = useRef(null);
  const [offsetTop, setOffsetTop] = useState(0);

  useEffect(() => {
    if (parentRef.current) setOffsetTop(parentRef.current.offsetTop);
  }, [width]);

  // --- GRID & LIST LOGIC ---
  const columns = useMemo(() => {
    if (viewMode === "list") return 1; // Force single column for List View
    if (width < 650) return 1;
    if (width < 950) return 2;
    if (width < 1300) return 3;
    return 4;
  }, [width, viewMode]);

  // --- GROUPING LOGIC (Fixed Categories) ---
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
      let targetGroup = groupsMap[coin.type_id];
      if (!targetGroup) {
        if (!groupsMap[uncategorizedId]) {
          groupsMap[uncategorizedId] = {
            id: uncategorizedId,
            name: "Uncategorized",
            coins: [],
            color: CATEGORY_COLORS[5],
          };
        }
        targetGroup = groupsMap[uncategorizedId];
      }
      targetGroup.coins.push(coin);
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
  const togglePeriod = (categoryId, periodId) => {
    const key = `${categoryId}-${periodId}`;
    setCollapsedPeriods((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // --- HELPER: Group Coins by Period ---
  const getCoinsByPeriod = (categoryCoins, isTableMode) => {
    const periodMap = {};
    const noPeriodKey = "no_period";

    categoryCoins.forEach((c) => {
      const pid = c.period_id || noPeriodKey;

      if (!periodMap[pid]) {
        periodMap[pid] = {
          id: pid,
          name: c.d_period?.period_name || "General Issues",
          startYear: c.d_period?.period_start_year || 0,
          coins: [],
          stats: {
            minYear: 9999,
            maxYear: -9999,
            maxPrice: 0,
            minPrice: 9999999,
          },
        };
      }
      const group = periodMap[pid];
      group.coins.push(c);

      const y = c.year || 0;
      const p = c.price_usd || 0;
      if (y < group.stats.minYear) group.stats.minYear = y;
      if (y > group.stats.maxYear) group.stats.maxYear = y;
      if (p > group.stats.maxPrice) group.stats.maxPrice = p;
      if (p < group.stats.minPrice) group.stats.minPrice = p;
    });

    const sortedPeriods = Object.values(periodMap).sort((a, b) => {
      // TABLE MODE: Historical Sort
      if (isTableMode) {
        if (sortBy === "year_asc") return a.startYear - b.startYear;
        return b.startYear - a.startYear;
      }

      // GRID & LIST MODE: Bubble Up Sort
      if (sortBy === "year_asc") {
        const valA = a.stats.minYear;
        const valB = b.stats.minYear;
        if (valA !== valB) return valA - valB;
      } else if (sortBy === "price_desc") {
        const valA = a.stats.maxPrice;
        const valB = b.stats.maxPrice;
        if (valA !== valB) return valB - valA;
      } else if (sortBy === "price_asc") {
        const valA = a.stats.minPrice === 9999999 ? 0 : a.stats.minPrice;
        const valB = b.stats.minPrice === 9999999 ? 0 : b.stats.minPrice;
        if (valA !== valB) return valA - valB;
      } else {
        const valA = a.stats.maxYear;
        const valB = b.stats.maxYear;
        if (valA !== valB) return valB - valA;
      }
      return b.startYear - a.startYear;
    });

    sortedPeriods.forEach((p) => {
      p.coins.sort((coinA, coinB) => {
        const yearA = coinA.year || 0;
        const yearB = coinB.year || 0;
        const priceA = coinA.price_usd || 0;
        const priceB = coinB.price_usd || 0;

        if (sortBy === "year_asc") return yearA - yearB;
        if (sortBy === "year_desc") return yearB - yearA;
        if (sortBy === "price_desc") return priceB - priceA;
        if (sortBy === "price_asc") return priceA - priceB;
        return yearB - yearA;
      });
    });

    return sortedPeriods;
  };

  // --- VIRTUALIZER (GRID & LIST) ---
  const virtualRows = useMemo(() => {
    if (loading || viewMode === "table") return [];
    const rows = [];

    groupedCoins.forEach((group) => {
      rows.push({ type: "header", group });

      if (expandedCategories[group.id]) {
        // GRID/LIST MODE: Pass false to use "Bubble Up" sorting (respects price sort)
        const periodGroups = getCoinsByPeriod(group.coins, false);

        periodGroups.forEach((period, pIndex) => {
          const uniqueKey = `${group.id}-${period.id}`;
          const isPeriodExpanded = !collapsedPeriods[uniqueKey];

          const isLastPeriod = pIndex === periodGroups.length - 1;
          const periodOwnedCount = period.coins.filter(
            (c) => c.is_owned
          ).length;
          const isLastVisualElement = isLastPeriod && !isPeriodExpanded;

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
    sortBy,
  ]);

  const rowVirtualizer = useWindowVirtualizer({
    count: virtualRows.length,
    estimateSize: (index) => {
      const row = virtualRows[index];
      if (row.type === "header") return 94;
      if (row.type === "subheader") return 50;
      // List = 100px (Shorter), Grid = 380px
      return viewMode === "list" ? 100 : 380;
    },
    overscan: 5,
    scrollMargin: offsetTop,
  });

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
                      <span className="text-gold">
                        {group.coins.length} coins
                      </span>
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
                    {getCoinsByPeriod(group.coins, true).map((periodGroup) => {
                      const periodOwnedCount = periodGroup.coins.filter(
                        (c) => c.is_owned
                      ).length;
                      const uniqueKey = `${group.id}-${periodGroup.id}`;
                      const isPeriodExpanded = !collapsedPeriods[uniqueKey];

                      return (
                        <div
                          key={periodGroup.id}
                          className="period-group"
                          style={{ cursor: "default" }}
                        >
                          <div
                            className="period-row"
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
        /* --- GRID & LIST MODE (Virtualized) --- */
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
                          <span className="text-gold">
                            {row.group.coins.length} coins
                          </span>
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
                  /* 2. PERIOD SUB-HEADER */
                  <div
                    className="period-row"
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
                  /* 3. COIN ROW (RENDER LIST OR CARD) */
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
                      {row.coins.map((coin) =>
                        viewMode === "list" ? (
                          <CoinListItem
                            key={coin.coin_id}
                            coin={coin}
                            onClick={onCoinClick}
                          />
                        ) : (
                          <CoinCard
                            key={coin.coin_id}
                            coin={coin}
                            onClick={onCoinClick}
                          />
                        )
                      )}
                      {viewMode === "grid" &&
                        Array.from({ length: columns - row.coins.length }).map(
                          (_, i) => (
                            <div
                              key={`spacer-${i}`}
                              className="virtual-spacer"
                            />
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
