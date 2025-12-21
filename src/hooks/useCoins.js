import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

// --- FETCHERS ---

// 1. Fetch Metadata (Countries & Categories)
const fetchMetadata = async () => {
  const [countries, categories] = await Promise.all([
    supabase.from("d_countries").select("*").order("country_name"),
    supabase.from("d_categories").select("*").order("type_name"),
  ]);
  return {
    countries: countries.data || [],
    categories: categories.data || [],
  };
};

// 2. Fetch Owned Coins
const fetchOwnedCoins = async () => {
  const { data } = await supabase
    .from("d_coins_owned")
    .select("coin_id, image_url_obverse, image_url_reverse");

  const cache = {};
  (data || []).forEach((c) => {
    cache[c.coin_id] = {
      obverse: c.image_url_obverse,
      reverse: c.image_url_reverse,
    };
  });
  return { cache, count: data?.length || 0 };
};

// 3. Fetch Periods for a Country
const fetchPeriods = async (countryId) => {
  if (!countryId) return [];
  const { data } = await supabase
    .from("b_periods_countries")
    .select(`period_id, d_period!inner(*)`)
    .eq("country_id", countryId);

  const periods = data?.map((d) => d.d_period) || [];
  // Sort by newest start year
  return periods.sort(
    (a, b) => (b.period_start_year || 0) - (a.period_start_year || 0)
  );
};

// 4. Main Coin Fetcher (Recursive Batching)
const fetchCoins = async ({ filters, ownedCache }) => {
  // A. Pre-calculation
  let filterPeriodIds = null;
  const ownedIds = Object.keys(ownedCache);

  // Optimization: Early return if filtering by owned but none owned
  if (filters.showOwned === "owned" && ownedIds.length === 0) {
    return [];
  }

  // Optimization: Pre-fetch periods if filtering by country only
  if (filters.country && !filters.period) {
    const { data } = await supabase
      .from("b_periods_countries")
      .select("period_id")
      .eq("country_id", filters.country);
    filterPeriodIds = data?.map((p) => p.period_id) || [];
    if (filterPeriodIds.length === 0) return [];
  }

  // B. Query Builder
  const buildQuery = () => {
    let query = supabase.from("f_coins").select(`
      coin_id, name, year, price_usd, km, subject, 
      type_id, period_id, denomination_id, series_id,
      marked, 
      d_denominations(denomination_name),
      d_period(period_name, period_start_year, period_link),
      d_series(series_name, series_range, series_link)
    `);

    if (filters.showOwned === "owned") {
      query = query.in("coin_id", ownedIds);
    }
    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,subject.ilike.%${filters.search}%,km.ilike.%${filters.search}%`
      );
    }
    if (filters.country && !filters.period && filterPeriodIds) {
      query = query.in("period_id", filterPeriodIds);
    }
    if (filters.period) {
      query = query.eq("period_id", filters.period);
    }

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

  // C. Execution (Browsing vs Filtering)
  const isBrowsing =
    !filters.search &&
    !filters.country &&
    !filters.period &&
    filters.showOwned === "all";

  let rawData = [];

  if (isBrowsing) {
    // Safety limit for browsing
    const { data, error } = await buildQuery().limit(200);
    if (error) throw error;
    rawData = data || [];
    // Randomize browsing view
    rawData.sort(() => Math.random() - 0.5);
  } else {
    // Recursive Batch Fetching
    const BATCH_SIZE = 1000;
    let from = 0;
    let fetching = true;

    while (fetching) {
      const { data, error } = await buildQuery().range(
        from,
        from + BATCH_SIZE - 1
      );
      if (error) throw error;

      if (data && data.length > 0) {
        rawData = [...rawData, ...data];
        if (data.length < BATCH_SIZE) fetching = false;
        else from += BATCH_SIZE;
      } else {
        fetching = false;
      }
    }
  }

  // D. Process Data (Attach Ownership)
  return rawData.map((coin) => {
    const ownedData = ownedCache[coin.coin_id];
    return {
      ...coin,
      is_owned: !!ownedData,
      display_obverse: ownedData?.obverse || null,
      display_reverse: ownedData?.reverse || null,
    };
  });
};

// --- HOOK ---

export function useCoins() {
  // 1. Local State for Filters
  const [filters, setFilters] = useState({
    search: "",
    country: "",
    period: "",
    denomination: "",
    series: "",
    showOwned: "all",
    sortBy: "year_desc",
  });

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // 2. Query: Metadata
  const { data: metaData } = useQuery({
    queryKey: ["metadata"],
    queryFn: fetchMetadata,
    staleTime: Infinity, // Metadata rarely changes
  });

  // 3. Query: Owned Coins
  const { data: ownedData } = useQuery({
    queryKey: ["owned"],
    queryFn: fetchOwnedCoins,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // 4. Query: Periods (Dependent on Country Filter)
  const { data: periods } = useQuery({
    queryKey: ["periods", filters.country],
    queryFn: () => fetchPeriods(filters.country),
    enabled: !!filters.country,
    staleTime: 1000 * 60 * 30,
  });

  // 5. Query: Main Coins List
  // Only runs once we have ownership data
  const {
    data: coins,
    isLoading: coinsLoading,
    isFetching,
  } = useQuery({
    queryKey: ["coins", { ...filters, search: debouncedSearch }],
    queryFn: () =>
      fetchCoins({
        filters: { ...filters, search: debouncedSearch },
        ownedCache: ownedData?.cache || {},
      }),
    enabled: !!ownedData, // Wait for ownership map
    keepPreviousData: true, // Optimistic UI transition
    staleTime: 1000 * 60 * 5, // Cache results for 5 mins
  });

  return {
    coins: coins || [],
    loading: coinsLoading || isFetching || !ownedData,
    filters,
    setFilters,
    metadata: {
      countries: metaData?.countries || [],
      categories: metaData?.categories || [],
      periods: periods || [],
    },
    ownedCount: ownedData?.count || 0,
  };
}
