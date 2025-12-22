import {
  Search,
  X,
  CheckCircle,
  Globe,
  Calendar,
  SortAsc,
  Tag,
} from "lucide-react";

export default function FilterBar({ filters, setFilters, metadata, viewMode }) {
  // Helper to update specific filters
  const updateFilter = (key, value) => {
    setFilters((prev) => {
      // If clearing country, we must also clear period
      if (key === "country") return { ...prev, [key]: value, period: "" };
      return { ...prev, [key]: value };
    });
  };

  // Helper to clear everything
  const clearAllFilters = () => {
    setFilters((prev) => ({
      ...prev,
      search: "",
      country: "",
      period: "",
      showOwned: "all",
    }));
  };

  // Generate the list of active tags based on current state
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

  return (
    <div className="controls-container">
      {/* Search Box */}
      <div className="search-box">
        <div className="search-input-wrapper">
          {/* UPDATED: Size set to 20 to be a tad smaller */}
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Search coins by name, subject, or KM#..."
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

      {/* Main Filter Dropdowns */}
      <div className="filter-row">
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
            {metadata.countries.map((c) => (
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
            value={filters.sortBy}
            onChange={(e) => updateFilter("sortBy", e.target.value)}
            disabled={viewMode === "table"} // Disable in Table View
            title={
              viewMode === "table" ? "Sorting is automatic in Table View" : ""
            }
          >
            <option value="year_desc">Year (Newest)</option>
            <option value="year_asc">Year (Oldest)</option>
            <option value="price_desc">Price (High-Low)</option>
          </select>
        </div>
      </div>

      {/* Active Filter Tags Bar */}
      {hasFilters && (
        <div className="active-filters-bar">
          <div className="active-filters-label">
            <Tag size={14} /> Active Filters:
          </div>
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
        </div>
      )}
    </div>
  );
}