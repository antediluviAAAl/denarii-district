import { useState } from "react";
import "./styles.css";
import { useCoins } from "./hooks/useCoins";
import Header from "./components/Header";
import FilterBar from "./components/FilterBar";
import CoinGallery from "./components/CoinGallery";
import CoinModal from "./components/CoinModal";

export default function App() {
  const [selectedCoin, setSelectedCoin] = useState(null);

  // Lifted state: Both FilterBar and CoinGallery need access to this
  const [viewMode, setViewMode] = useState("grid");

  const { coins, loading, filters, setFilters, metadata, ownedCount } =
    useCoins();

  return (
    <div className="app-container">
      <Header ownedCount={ownedCount} displayCount={coins.length} />

      <main className="main-content">
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          metadata={metadata}
          viewMode={viewMode} // Pass down to control disabled state
        />

        <CoinGallery
          coins={coins}
          loading={loading}
          categories={metadata.categories}
          onCoinClick={setSelectedCoin}
          viewMode={viewMode} // Pass down current mode
          setViewMode={setViewMode} // Pass down setter
        />
      </main>

      {selectedCoin && (
        <CoinModal coin={selectedCoin} onClose={() => setSelectedCoin(null)} />
      )}

      <footer className="app-footer">
        <p>Numismatic Gallery v2 • {coins.length} coins loaded</p>
      </footer>
    </div>
  );
}
