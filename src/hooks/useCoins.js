import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

// --- CONFIGURATION ---

const EXPLORE_DISTRIBUTION = [
  { typeId: 1, target: 60 }, // Circulation
  { typeId: 2, target: 50 }, // Commemorative
  { typeId: 3, target: 50 }, // Collector
  { typeId: 4, target: 20 }, // Tokens
  { typeId: 5, target: 10 }, // Notgelds
  { typeId: 6, target: 10 }, // Notgelds (Probes)
];

const SELECT_COINS_FIELDS = `
  coin_id, name, year, price_usd, km, subject, 
  type_id, period_id, denomination_id, series_id,
  marked, 
  d_denominations(denomination_name),
  d_period(period_name, period_start_year, period_link),
  d_series(series_name, series_range, series_link)
`;

// --- HELPERS ---

// Helper to attach images and ownership status (Shared by both fetchers)
const processCoinData = (coin, ownedCache) => {
  const ownedData = ownedCache[coin.coin_id];
  const getImages = (side) => {
    if (!ownedData) return { full: null, medium: null, thumb: null };
    const full = ownedData.full[side];
    const medium = ownedData.medium[side] || full;
    const thumb = ownedData.thumb[side] || medium || full;
    return { full, medium, thumb };
  };

  return {
    ...coin,
    is_owned: !!ownedData,
    images: {
      obverse: getImages("obverse"),
      reverse: getImages("reverse"),
    },
  };
};

// Shuffle Helper (Fisher-Yates)
const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

// --- FETCHERS ---

// 1. Fetch Metadata (Now includes Type Counts)
const fetchMetadata = async () => {
  // Fetch counts for explore mode distribution in parallel
  const countPromises = EXPLORE_DISTRIBUTION.map(async (dist) => {
    const { count } = await supabase
      .from("f_coins")
      .select("*", { count: "exact", head: true })
      .eq("type_id", dist.typeId);
    return { typeId: dist.typeId, count: count || 0 };
  });

  const [countries, categories, periodLinks, ...typeCountsResults] =
    await Promise.all([
      supabase.from("d_countries").select("*").order("country_name"),
      supabase.from("d_categories").select("*").order("type_name"),
      supabase.from("b_periods_countries").select("period_id, country_id"),
      ...countPromises,
    ]);

  // Map counts for easy lookup: { 1: 150000, 2: 50000, ... }
  const typeCounts = typeCountsResults.reduce((acc, curr) => {
    acc[curr.typeId] = curr.count;
    return acc;
  }, {});

  return {
    countries: countries.data || [],
    categories: categories.data || [],
    periodLinks: periodLinks.data || [],
    typeCounts,
  };
};

// 2. Fetch Owned Coins
const fetchOwnedCoins = async () => {
  const { data } = await supabase.from("d_coins_owned").select(`
      coin_id, 
      url_obverse, url_reverse, 
      medium_url_obverse, medium_url_reverse, 
      thumb_url_obverse, thumb_url_reverse,
      f_coins!inner(period_id)
      `);

  const cache = {};
  const ownedPeriodIds = new Set();

  (data || []).forEach((c) => {
    if (c.f_coins?.period_id) {
      ownedPeriodIds.add(c.f_coins.period_id);
    }
    cache[c.coin_id] = {
      full: { obverse: c.url_obverse, reverse: c.url_reverse },
      medium: { obverse: c.medium_url_obverse, reverse: c.medium_url_reverse },
      thumb: { obverse: c.thumb_url_obverse, reverse: c.thumb_url_reverse },
    };
  });
  return { cache, count: data?.length || 0, ownedPeriodIds };
};

// 3. Fetch Periods
const fetchPeriods = async (countryId) => {
  if (!countryId) return [];
  const { data } = await supabase
    .from("b_periods_countries")
    .select(`period_id, d_period!inner(*)`)
    .eq("country_id", countryId);

  const periods = data?.map((d) => d.d_period) || [];
  return periods.sort(
    (a, b) => (b.period_start_year || 0) - (a.period_start_year || 0)
  );
};

// 4. Fetch Explore Coins (Stratified Random Sampling)
const fetchExploreCoins = async ({ typeCounts, ownedCache }) => {
  // Execute parallel queries for each configured distribution
  const queries = EXPLORE_DISTRIBUTION.map(async ({ typeId, target }) => {
    const totalAvailable = typeCounts[typeId] || 0;

    // Safety: If not enough coins, just get what we have
    if (totalAvailable <= target) {
      const { data } = await supabase
        .from("f_coins")
        .select(SELECT_COINS_FIELDS)
        .eq("type_id", typeId);
      return data || [];
    }

    // Performance: Random Offset Strategy
    // We calculate a random starting point based on total count
    const maxOffset = totalAvailable - target;
    const offset = Math.floor(Math.random() * maxOffset);

    const { data } = await supabase
      .from("f_coins")
      .select(SELECT_COINS_FIELDS)
      .eq("type_id", typeId)
      .range(offset, offset + target - 1);

    return data || [];
  });

  const results = await Promise.all(queries);

  // Combine all groups into one array
  const flatCoins = results.flat();

  // Shuffle them so the grid isn't striped by category
  const shuffledCoins = shuffleArray(flatCoins);

  return shuffledCoins.map((coin) => processCoinData(coin, ownedCache));
};

// 5. Fetch Filtered Coins (Standard Logic)
const fetchCoins = async ({ filters, ownedCache }) => {
  let filterPeriodIds = null;
  const ownedIds = Object.keys(ownedCache);

  if (filters.showOwned === "owned" && ownedIds.length === 0) return [];

  if (filters.country && !filters.period) {
    const { data } = await supabase
      .from("b_periods_countries")
      .select("period_id")
      .eq("country_id", filters.country);
    filterPeriodIds = data?.map((p) => p.period_id) || [];
    if (filterPeriodIds.length === 0) return [];
  }

  const buildQuery = () => {
    let query = supabase.from("f_coins").select(SELECT_COINS_FIELDS);

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

  // Standard Batch Fetching for Filtered View
  const BATCH_SIZE = 1000;
  let rawData = [];
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

  return rawData.map((coin) => processCoinData(coin, ownedCache));
};

// --- HOOK ---

export function useCoins() {
  const [filters, setFilters] = useState({
    search: "",
    country: "",
    period: "",
    denomination: "",
    series: "",
    showOwned: "all",
    sortBy: "year_desc",
  });

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // 1. Determine Explore Mode
  // Defined as: No search, no country, no period, and viewing all coins
  const isExploreMode =
    !filters.search &&
    !filters.country &&
    !filters.period &&
    filters.showOwned === "all";

  // 2. Query: Metadata
  const { data: metaData } = useQuery({
    queryKey: ["metadata"],
    queryFn: fetchMetadata,
    staleTime: Infinity,
  });

  // 3. Query: Owned Coins
  const { data: ownedData } = useQuery({
    queryKey: ["owned"],
    queryFn: fetchOwnedCoins,
    staleTime: 1000 * 60 * 5,
  });

  // 4. Derived State: Valid Countries
  const validCountryIds = useMemo(() => {
    if (
      filters.showOwned !== "owned" ||
      !ownedData?.ownedPeriodIds ||
      !metaData?.periodLinks
    ) {
      return null;
    }
    const validIds = new Set();
    metaData.periodLinks.forEach((link) => {
      if (ownedData.ownedPeriodIds.has(link.period_id)) {
        validIds.add(link.country_id);
      }
    });
    return validIds;
  }, [filters.showOwned, ownedData, metaData]);

  // 5. Query: Periods
  const { data: periods } = useQuery({
    queryKey: ["periods", filters.country],
    queryFn: () => fetchPeriods(filters.country),
    enabled: !!filters.country,
    staleTime: 1000 * 60 * 30,
  });

  // 6. Query: Coins (Branches between Explore vs. Filtered)
  const {
    data: coins,
    isLoading: coinsLoading,
    isFetching,
  } = useQuery({
    // We add 'explore' to the key so it resets when mode changes
    queryKey: [
      "coins",
      {
        ...filters,
        search: debouncedSearch,
        mode: isExploreMode ? "explore" : "filter",
      },
    ],
    queryFn: () => {
      // Branch Logic: Explore Mode vs Standard Mode
      if (isExploreMode && metaData?.typeCounts) {
        return fetchExploreCoins({
          typeCounts: metaData.typeCounts,
          ownedCache: ownedData.cache || {},
        });
      }
      return fetchCoins({
        filters: { ...filters, search: debouncedSearch },
        ownedCache: ownedData?.cache || {},
      });
    },
    // We wait for ownedData AND metaData (needed for typeCounts in explore mode)
    enabled: !!ownedData && !!metaData,
    keepPreviousData: true,
    staleTime: 1000 * 60 * 5,
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
      validCountryIds,
    },
    ownedCount: ownedData?.count || 0,
    isExploreMode, // Expose this for UI
  };
}
