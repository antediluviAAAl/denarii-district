import { X, CheckCircle, ExternalLink, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import FadeInImage from "./FadeInImage";

// Fetcher Function
async function fetchCoinDetails(coinId) {
  const { data, error } = await supabase
    .from("f_coins")
    .select(
      `
      *,
      d_period!inner(period_name, period_link),
      d_series(series_name, series_link, series_range),
      d_categories(type_name),
      d_denominations(denomination_name)
    `
    )
    .eq("coin_id", coinId)
    .single();

  if (error) throw error;
  if (!data) return null;

  // Fetch Country Name via Period
  let countryName = "Unknown";
  if (data.period_id) {
    const { data: cData } = await supabase
      .from("b_periods_countries")
      .select("d_countries(country_name)")
      .eq("period_id", data.period_id)
      .limit(1);
    if (cData && cData[0]) countryName = cData[0].d_countries.country_name;
  }

  return { ...data, countryName };
}

export default function CoinModal({ coin, onClose }) {
  // Use Query for Caching
  const { data: details, isLoading } = useQuery({
    queryKey: ["coin_detail", coin.coin_id],
    queryFn: () => fetchCoinDetails(coin.coin_id),
    staleTime: 1000 * 60 * 30, // Keep details cached for 30 mins
  });

  // Merge Data
  const displayData = details ? { ...coin, ...details } : coin;

  // EXPLICIT: Preserve the ownership and image objects from the parent (Cache)
  // because 'details' fetch comes from f_coins which might not have the new image columns
  displayData.is_owned = coin.is_owned;
  displayData.images = coin.images; 

  const renderLink = (text, url) => {
    if (!url) return <span>{text || "Unknown"}</span>;
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="modal-link"
        onClick={(e) => e.stopPropagation()}
      >
        {text}{" "}
        <ExternalLink size={10} style={{ marginLeft: 2, marginBottom: 1 }} />
      </a>
    );
  };

  // PERFORMANCE: Use Full Quality images for the Detail Modal
  const obverseFull = displayData.images?.obverse?.full;
  const reverseFull = displayData.images?.reverse?.full;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrapper">
            <h2>{displayData.name}</h2>
            {displayData.is_owned && (
              <div className="modal-owned-badge">
                <CheckCircle size={18} /> <span>Owned</span>
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {isLoading && !details ? (
            <div
              style={{ padding: "2rem", textAlign: "center", color: "#6b7280" }}
            >
              Loading full details...
            </div>
          ) : (
            <>
              {/* Images Section */}
              <div className="coin-images">
                {obverseFull && (
                  <div className="coin-image-modal">
                    <h3>Obverse</h3>
                    <FadeInImage
                      src={obverseFull}
                      className="modal-image"
                      alt="Obverse"
                    />
                  </div>
                )}
                {reverseFull && (
                  <div className="coin-image-modal">
                    <h3>Reverse</h3>
                    <FadeInImage
                      src={reverseFull}
                      className="modal-image"
                      alt="Reverse"
                    />
                  </div>
                )}
              </div>

              {/* Data Grid */}
              <div className="coin-details-grid three-col">
                <div className="detail-group">
                  <h3>Identification</h3>
                  <div className="detail-item">
                    <strong>Coin ID:</strong> {displayData.coin_id}
                  </div>
                  <div className="detail-item">
                    <strong>KM#:</strong> {displayData.km || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Denomination:</strong>{" "}
                    {displayData.d_denominations?.denomination_name ||
                      "Unknown"}
                  </div>
                  <div className="detail-item">
                    <strong>Year:</strong>
                    <span>
                      {displayData.year || "?"}
                      {displayData.d_series?.series_range && (
                        <span className="series-range">
                          {" "}
                          ({displayData.d_series.series_range})
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="detail-group">
                  <h3>Groups</h3>
                  <div className="detail-item link-item">
                    <strong>Series:</strong>
                    {renderLink(
                      displayData.d_series?.series_name,
                      displayData.d_series?.series_link
                    )}
                  </div>
                  <div className="detail-item link-item">
                    <strong>Period:</strong>
                    {renderLink(
                      displayData.d_period?.period_name,
                      displayData.d_period?.period_link
                    )}
                  </div>
                  <div className="detail-item">
                    <strong>Country:</strong>{" "}
                    {displayData.countryName || "Loading..."}
                  </div>
                </div>

                <div className="detail-group">
                  <h3>Extra</h3>
                  <div className="detail-item">
                    <strong>Subject:</strong> {displayData.subject || "N/A"}
                  </div>
                  <div className="detail-item">
                    <strong>Price (USD):</strong>
                    <span className="price-tag">
                      {displayData.price_usd
                        ? `$${displayData.price_usd.toFixed(2)}`
                        : "N/A"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Marked:</strong>
                    {displayData.marked ? (
                      <span className="badge-true">Yes</span>
                    ) : (
                      <span className="badge-false">No</span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}