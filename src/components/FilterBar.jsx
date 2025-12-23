import { useEffect } from "react";
import {
  Search,
  X,
  CheckCircle,
  Globe,
  Calendar,
  SortAsc,
  Tag,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";

export default function FilterBar({
  filters,
  setFilters,
  metadata,
  viewMode,
  setViewMode,
  isExploreMode, // NEW PROP
}) {
  const updateFilter = (key, value) => {
    setFilters((prev) => {
      if (key === "country") return { ...prev, [key]: value, period: "" };
      return { ...prev, [key]: value };
    });
  };

  const clearAllFilters = () => {
    setFilters((prev) => ({
      ...prev,
      search: "",
      country: "",
      period: "",
      showOwned: "all",
    }));
  };

  // SAFETY: If switching to Table View, forbid Price sort
  useEffect(() => {
    if (viewMode === "table" && filters.sortBy.startsWith("price")) {
      updateFilter("sortBy", "year_desc");
    }
  }, [viewMode, filters.sortBy]);

  const getActiveTags = () => {
    const tags = [];
    if (filters.search) {
      tags.push({
        key: "search",
        label: `Search: "${filters.search}"`,
        action: () => updateFilter("search", ""),
      });
    }
    if (filters.showOwned === "owned") {
      tags.push({
        key: "showOwned",
        label: "Owned Only",
        action: () => updateFilter("showOwned", "all"),
      });
    }
    if (filters.country) {
      const countryName =
        metadata.countries.find((c) => c.country_id == filters.country)
          ?.country_name || "Unknown Country";
      tags.push({
        key: "country",
        label: countryName,
        action: () => updateFilter("country", ""),
      });
    }
    if (filters.period) {
      const periodName =
        metadata.periods.find((p) => p.period_id == filters.period)
          ?.period_name || "Unknown Period";
      tags.push({
        key: "period",
        label: periodName,
        action: () => updateFilter("period", ""),
      });
    }
    return tags;
  };

  const activeTags = getActiveTags();
  const hasFilters = activeTags.length > 0;

  const displayedCountries = metadata.countries.filter((c) => {
    if (!metadata.validCountryIds) return true;
    return metadata.validCountryIds.has(c.country_id);
  });

  return (
    <div className="controls-container">
      <div className="filter-input-row">
        {/* Search */}
        <div className="search-box">
          <label className="filter-label">
            <Search size={16} /> Search
          </label>
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Find coins by name, subject, or KM#..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
            />
            {filters.search && (
              <button
                className="clear-search"
                onClick={() => updateFilter("search", "")}
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="filter-group">
          <label className="filter-label">
            <CheckCircle size={16} /> Show
          </label>
          <select
            className="filter-select"
            value={filters.showOwned}
            onChange={(e) => updateFilter("showOwned", e.target.value)}
          >
            <option value="all">All Coins</option>
            <option value="owned">Only Owned</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">
            <Globe size={16} /> Country
          </label>
          <select
            className="filter-select"
            value={filters.country}
            onChange={(e) => updateFilter("country", e.target.value)}
          >
            <option value="">All Countries</option>
            {displayedCountries.map((c) => (
              <option key={c.country_id} value={c.country_id}>
                {c.country_name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">
            <Calendar size={16} /> Period
          </label>
          <select
            className="filter-select"
            value={filters.period}
            onChange={(e) => updateFilter("period", e.target.value)}
            disabled={!filters.country}
          >
            <option value="">All Periods</option>
            {metadata.periods.map((p) => (
              <option key={p.period_id} value={p.period_id}>
                {p.period_name} {p.period_range ? `(${p.period_range})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">
            <SortAsc size={16} /> Sort By
          </label>
          <select
            className="filter-select"
            value={isExploreMode ? "" : filters.sortBy} // Clear value if disabled
            onChange={(e) => updateFilter("sortBy", e.target.value)}
            disabled={isExploreMode} // DISABLE in Explore Mode
            title={
              isExploreMode
                ? "Sorting is disabled in Explore mode (randomized selection)"
                : ""
            }
            style={isExploreMode ? { opacity: 0.6, cursor: "not-allowed" } : {}}
          >
            {isExploreMode && <option value="">Randomized</option>}
            <option value="year_desc">Year (Newest)</option>
            <option value="year_asc">Year (Oldest)</option>
            {viewMode !== "table" && (
              <>
                <option value="price_desc">Price (High-Low)</option>
                <option value="price_asc">Price (Low-High)</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Tags & View Mode */}
      <div className="filter-status-row">
        <div className="active-filters-bar">
          <div className="active-filters-label">
            <Tag size={14} className="text-gold" /> Active Filters:
          </div>
          {hasFilters && (
            <div className="filter-tags-list">
              {activeTags.map((tag) => (
                <button
                  key={tag.key}
                  className="filter-tag"
                  onClick={tag.action}
                  title="Click to remove filter"
                >
                  <span>{tag.label}</span>
                  <X size={14} />
                </button>
              ))}
              <button className="clear-all-tags" onClick={clearAllFilters}>
                Clear All
              </button>
            </div>
          )}
        </div>

        <div className="view-toggles">
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
    </div>
  );
}
