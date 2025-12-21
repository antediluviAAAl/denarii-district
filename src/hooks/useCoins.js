import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";

export function useCoins() {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);

  // Cache for owned coins to prevent re-fetching on every filter change
  const [ownedCache, setOwnedCache] = useState({});
  const [ownedCount, setOwnedCount] = useState(0);

  // Dropdown options
  const [metadata, setMetadata] = useState({
    countries: [],
    categories: [],
    periods: [],
  });

  // Filter State
  const [filters, setFilters] = useState({
    search: "",
    country: "",
    period: "",
    denomination: "",
    series: "",
    showOwned: "all", // 'all' | 'owned'
    sortBy: "year_desc",
  });

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // 1. Initial Load: Metadata & Owned Cache
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [countries, categories, owned] = await Promise.all([
          supabase.from("d_countries").select("*").order("country_name"),
          supabase.from("d_categories").select("*").order("type_name"),
          supabase
            .from("d_coins_owned")
            .select("coin_id, image_url_obverse, image_url_reverse"),
        ]);

        // Build Ownership Map
        const cache = {};
        (owned.data || []).forEach((c) => {
          cache[c.coin_id] = {
            obverse: c.image_url_obverse,
            reverse: c.image_url_reverse,
          };
        });

        setOwnedCache(cache);
        setOwnedCount(owned.data?.length || 0);
        setMetadata((prev) => ({
          ...prev,
          countries: countries.data || [],
          categories: categories.data || [],
        }));
      } catch (err) {
        console.error("Initialization error:", err);
      }
    }
    fetchInitialData();
  }, []);

  // 2. Fetch Periods when Country Changes
  useEffect(() => {
    async function fetchPeriods() {
      if (!filters.country) {
        setMetadata((prev) => ({ ...prev, periods: [] }));
        return;
      }
      const { data } = await supabase
        .from("b_periods_countries")
        .select(`period_id, d_period!inner(*)`)
        .eq("country_id", filters.country);

      let periods = data?.map((d) => d.d_period) || [];

      // SORT: Newest Period First (Descending Start Year)
      periods.sort(
        (a, b) => (b.period_start_year || 0) - (a.period_start_year || 0)
      );

      setMetadata((prev) => ({ ...prev, periods }));
    }
    fetchPeriods();
  }, [filters.country]);

  // 3. Main Coin Fetcher
  useEffect(() => {
    async function fetchCoins() {
      // Wait for cache before first fetch
      if (Object.keys(ownedCache).length === 0 && loading === false) return;

      setIsFiltering(true);

      try {
        // --- PRE-CALCULATION STEP ---
        // Fetch necessary IDs upfront to avoid async calls inside the query loop
        let filterPeriodIds = null;
        const ownedIds = Object.keys(ownedCache);

        // Edge Case: If filtering by Owned but have none, return early
        if (filters.showOwned === "owned" && ownedIds.length === 0) {
          setCoins([]);
          setIsFiltering(false);
          return;
        }

        // Pre-fetch Period IDs if filtering by Country (but not specific Period)
        if (filters.country && !filters.period) {
          const { data: pData } = await supabase
            .from("b_periods_countries")
            .select("period_id")
            .eq("country_id", filters.country);
          filterPeriodIds = pData?.map((p) => p.period_id) || [];

          // If country has no periods linked, return empty
          if (filterPeriodIds.length === 0) {
            setCoins([]);
            setIsFiltering(false);
            return;
          }
        }

        // --- QUERY BUILDER HELPER ---
        // Creates a fresh query object for each iteration of the loop
        const buildQuery = () => {
          let query = supabase.from("f_coins").select(`
            coin_id, name, year, price_usd, km, subject, 
            type_id, period_id, denomination_id, series_id,
            marked, 
            d_denominations(denomination_name),
            d_period(period_name, period_start_year, period_link),
            d_series(series_name, series_range, series_link)
          `);

          // Filter: Owned
          if (filters.showOwned === "owned") {
            query = query.in("coin_id", ownedIds);
          }

          // Filter: Search
          if (debouncedSearch) {
            query = query.or(
              `name.ilike.%${debouncedSearch}%,subject.ilike.%${debouncedSearch}%,km.ilike.%${debouncedSearch}%`
            );
          }

          // Filter: Country (via pre-fetched IDs)
          if (filters.country && !filters.period && filterPeriodIds) {
            query = query.in("period_id", filterPeriodIds);
          }

          // Filter: Specific Period
          if (filters.period) {
            query = query.eq("period_id", filters.period);
          }

          // Sorting
          const sortMap = {
            year_desc: { col: "year", asc: false },
            year_asc: { col: "year", asc: true },
            price_desc: { col: "price_usd", asc: false },
            price_asc: { col: "price_usd", asc: true },
          };
          const sort = sortMap[filters.sortBy] || sortMap.year_desc;
          query = query.order(sort.col, { ascending: sort.asc });

          return query;
        };

        // --- EXECUTION LOGIC ---
        let rawData = [];
        const isBrowsing =
          !debouncedSearch &&
          !filters.country &&
          !filters.period &&
          filters.showOwned === "all";

        if (isBrowsing) {
          // Standard Safety Limit for Browsing Mode
          const { data, error } = await buildQuery().limit(200);
          if (error) throw error;
          rawData = data || [];
        } else {
          // Recursive Batch Fetching for Filtered Modes
          const BATCH_SIZE = 1000;
          let from = 0;
          let fetching = true;

          while (fetching) {
            // Apply range using the builder
            const { data, error } = await buildQuery().range(
              from,
              from + BATCH_SIZE - 1
            );

            if (error) throw error;

            if (data && data.length > 0) {
              rawData = [...rawData, ...data];
              if (data.length < BATCH_SIZE) {
                // We fetched fewer than the limit, so we reached the end
                fetching = false;
              } else {
                // There might be more, move cursor
                from += BATCH_SIZE;
              }
            } else {
              fetching = false;
            }
          }
        }

        // --- PROCESS & FORMAT DATA ---
        const processed = rawData.map((coin) => {
          const ownedData = ownedCache[coin.coin_id];
          return {
            ...coin,
            is_owned: !!ownedData,
            display_obverse: ownedData?.obverse || null,
            display_reverse: ownedData?.reverse || null,
          };
        });

        if (isBrowsing && loading) {
          processed.sort(() => Math.random() - 0.5);
        }

        setCoins(processed);
      } catch (err) {
        console.error("Coin fetch error:", err);
      } finally {
        setLoading(false);
        setIsFiltering(false);
      }
    }

    fetchCoins();
  }, [
    debouncedSearch,
    filters.country,
    filters.period,
    filters.showOwned,
    filters.sortBy,
    ownedCache,
  ]);

  return {
    coins,
    loading: loading || isFiltering,
    filters,
    setFilters,
    metadata,
    ownedCount,
  };
}
