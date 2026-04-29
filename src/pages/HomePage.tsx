import { useEffect, useMemo, useState } from 'react';
import type { AuthResponse, Holding, StockDataResponse, StockSearchResult, TradeRequest } from '../types';
import { buyStock, getPortfolio, getStockData, searchStocks, sellStock } from '../api';
import ErrorBanner from '../components/ErrorBanner';
import PortfolioTable from '../components/PortfolioTable';
import StockSearch from '../components/StockSearch';
import TradeForm from '../components/TradeForm';

const INTERVAL_OPTIONS = [
  { value: '1min', label: '1min' },
  { value: 'hourly', label: 'hourly' },
  { value: 'daily', label: 'daily' },
  { value: 'weekly', label: 'weekly' },
  { value: 'monthly', label: 'monthly' }
];

function formatAxisLabel(label: string) {
  return label.length > 12 ? `${label.slice(0, 12)}...` : label;
}

function normalizeStockSeries(raw: unknown): Array<{ label: string; value: number }> {
  if (!raw || typeof raw !== 'object') return [];

  const addPoint = (
    label: string,
    value: unknown,
    output: Array<{ label: string; value: number }>
  ) => {
    const numeric = typeof value === 'string'
      ? Number(value.replace(/,/g, ''))
      : typeof value === 'number'
      ? value
      : NaN;

    if (!Number.isFinite(numeric) || !label) return;
    output.push({ label, value: numeric });
  };

  const series: Array<{ label: string; value: number }> = [];
  const data = raw as Record<string, any>;

  const findSeriesFromParallelArrays = () => {
    const candidateTimeKeys = Object.keys(data).filter((key) =>
      Array.isArray(data[key]) && /timestamp|date|time|label|timestamps|dates|times/i.test(key)
    );

    const candidateValueKeys = Object.keys(data).filter((key) =>
      Array.isArray(data[key]) && /close|price|value|amount|open|high|low|prices/i.test(key)
    );

    for (const timeKey of candidateTimeKeys) {
      for (const valueKey of candidateValueKeys) {
        if (timeKey === valueKey) continue;
        const timeArray = data[timeKey] as unknown[];
        const valueArray = data[valueKey] as unknown[];
        if (timeArray.length && timeArray.length === valueArray.length) {
          timeArray.forEach((label, index) => {
            addPoint(String(label ?? ''), valueArray[index], series);
          });
          return true;
        }
      }
    }

    return false;
  };

  if (findSeriesFromParallelArrays()) {
    return series
      .filter((point) => point.label && Number.isFinite(point.value))
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(-40);
  }

  if (Array.isArray(data.values)) {
    data.values.forEach((item: any) =>
      addPoint(
        item.time ?? item.date ?? item.label ?? item.timestamp ?? '',
        item.close ?? item.price ?? item.value ?? item.y ?? item[1],
        series
      )
    );
  }

  if (!series.length && Array.isArray(data.prices)) {
    data.prices.forEach((item: any) =>
      addPoint(
        item.time ?? item.date ?? item.label ?? item.timestamp ?? '',
        item.close ?? item.price ?? item.value ?? item.y ?? item[1],
        series
      )
    );
  }

  if (!series.length && Array.isArray(data.data)) {
    data.data.forEach((item: any) => {
      if (Array.isArray(item)) {
        addPoint(String(item[0] ?? ''), item[1] ?? item[4] ?? item[2], series);
      } else {
        addPoint(
          item.time ?? item.date ?? item.label ?? item.timestamp ?? '',
          item.close ?? item.price ?? item.value ?? item.y ?? item[1],
          series
        );
      }
    });
  }

  if (!series.length) {
    const timeSeriesKey = Object.keys(data).find((key) => /time series|series|prices|data/i.test(key));
    if (timeSeriesKey) {
      const rawSeries = data[timeSeriesKey];
      if (Array.isArray(rawSeries)) {
        rawSeries.forEach((item: any) =>
          addPoint(
            item.time ?? item.date ?? item.label ?? item.timestamp ?? '',
            item.close ?? item.price ?? item.value ?? item.y ?? item[1],
            series
          )
        );
      } else if (rawSeries && typeof rawSeries === 'object') {
        Object.entries(rawSeries).forEach(([key, value]) => {
          const item = value as Record<string, any>;
          addPoint(
            key,
            item['4. close'] ?? item.close ?? item.price ?? item.value ?? item['close'] ?? item[1],
            series
          );
        });
      }
    }
  }

  if (!series.length) {
    const dateKeys = Object.keys(data).filter((key) => /^\d{4}-\d{2}-\d{2}/.test(key));
    dateKeys.forEach((key) => {
      const item = data[key] as Record<string, any>;
      addPoint(
        key,
        item?.['4. close'] ?? item?.close ?? item?.price ?? item?.value ?? item?.[1],
        series
      );
    });
  }

  return series
    .filter((point) => point.label && Number.isFinite(point.value))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-40);
}

function StockTrendChart({ series }: { series: Array<{ label: string; value: number }> }) {
  if (series.length < 2) {
    return null;
  }

  const width = 720;
  const height = 280;
  const padding = 40;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - padding * 2) / (series.length - 1);

  const points = series.map((point, index) => ({
    ...point,
    x: padding + index * stepX,
    y: padding + ((max - point.value) / range) * (height - padding * 2)
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  return (
    <div className="stock-chart-card">
      <div className="stock-chart-summary">
        <div>
          <span>Latest</span>
          <strong>{series[series.length - 1].value.toFixed(2)}</strong>
        </div>
        <div>
          <span>From</span>
          <strong>{formatAxisLabel(series[0].label)}</strong>
        </div>
        <div>
          <span>To</span>
          <strong>{formatAxisLabel(series[series.length - 1].label)}</strong>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="stock-chart-svg" role="img" aria-label="Stock trend line chart">
        <defs>
          <linearGradient id="trendGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(95, 141, 255, 0.65)" />
            <stop offset="100%" stopColor="rgba(95, 141, 255, 0.08)" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3].map((line) => {
          const y = padding + ((height - padding * 2) / 3) * line;
          return <line key={line} x1={padding} y1={y} x2={width - padding} y2={y} className="grid-line" />;
        })}

        <path d={`M ${padding} ${height - padding} L ${padding} ${padding} L ${width - padding} ${padding}`} className="axis-line" />
        <path d={linePath} className="trend-line" />
        <path d={`${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`} className="trend-fill" />

        <text x={padding - 8} y={padding + 4} className="axis-label">{max.toFixed(2)}</text>
        <text x={padding - 8} y={height - padding + 4} className="axis-label">{min.toFixed(2)}</text>
        <text x={padding} y={height - 10} className="axis-label axis-label--bottom">{formatAxisLabel(series[0].label)}</text>
        <text x={width - padding} y={height - 10} className="axis-label axis-label--bottom" textAnchor="end">
          {formatAxisLabel(series[series.length - 1].label)}
        </text>
      </svg>
    </div>
  );
}

interface Props {
  auth: AuthResponse;
  onLogout: () => void;
}

export default function HomePage({ auth, onLogout }: Props) {
  const [portfolio, setPortfolio] = useState<Holding[]>([]);
  const [stockResult, setStockResult] = useState<StockDataResponse | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);

  const chartPoints = useMemo(() => normalizeStockSeries(stockResult), [stockResult]);
  const autoFillSymbol = stockResult?.symbol?.toString().trim().toUpperCase() || selectedSymbol.trim().toUpperCase();
  const autoFillPrice = chartPoints.length ? chartPoints[chartPoints.length - 1].value : undefined;

  useEffect(() => {
    loadPortfolio();
  }, []);

  const loadPortfolio = async () => {
    setErrorMessage('');
    setIsLoadingPortfolio(true);
    try {
      const holdings = await getPortfolio();
      setPortfolio(holdings);
    } catch (error) {
      handleError(error);
    } finally {
      setIsLoadingPortfolio(false);
    }
  };

  const handleError = (error: unknown) => {
    if (error instanceof Error) {
      setErrorMessage(error.message);
      if (error.message.includes('login required') || error.message.includes('Access denied')) {
        onLogout();
      }
    } else {
      setErrorMessage('Unexpected error. Please try again.');
    }
  };

  const handleBuy = async (request: TradeRequest) => {
    setStatusMessage('');
    setErrorMessage('');
    try {
      await buyStock(request);
      setStatusMessage('Stock purchased successfully. Refreshing portfolio.');
      await loadPortfolio();
    } catch (error) {
      handleError(error);
    }
  };

  const handleSell = async (request: TradeRequest) => {
    setStatusMessage('');
    setErrorMessage('');
    try {
      await sellStock(request);
      setStatusMessage('Stock sold successfully. Refreshing portfolio.');
      await loadPortfolio();
    } catch (error) {
      handleError(error);
    }
  };

  const handleSearchSymbol = async (keyword: string) => {
    setErrorMessage('');
    try {
      return await searchStocks(keyword);
    } catch (error) {
      handleError(error);
      return [] as StockSearchResult[];
    }
  };

  const handleFetchQuote = async () => {
    setErrorMessage('');
    setStatusMessage('');
    if (!selectedSymbol.trim()) {
      setErrorMessage('Please select a stock symbol to load quote data.');
      return;
    }
    try {
      const data = await getStockData(selectedSymbol.trim(), selectedInterval);
      setStockResult(data);
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <div className="app-shell container">
      <div className="status-row">
        <div>
          <h1 className="page-title">Hello, {auth.username}</h1>
          <p className="small-text">Role: {auth.roles.join(', ')}</p>
        </div>
        <button className="secondary" onClick={onLogout}>
          Logout
        </button>
      </div>

      {errorMessage && <ErrorBanner message={errorMessage} />}
      {statusMessage && <ErrorBanner message={statusMessage} variant="success" />}

      <div className="cards-grid">
        <div className="card">
          <div className="status-row">
            <h2 className="page-title">Portfolio</h2>
            <button className="primary" onClick={loadPortfolio} disabled={isLoadingPortfolio}>
              {isLoadingPortfolio ? 'Refreshing...' : 'Refresh portfolio'}
            </button>
          </div>
          <PortfolioTable holdings={portfolio} />
        </div>

        <StockSearch onSearch={handleSearchSymbol} onSymbolSelect={setSelectedSymbol} />

        <div className="card">
          <h2 className="page-title">Quote data</h2>
          <div className="field-group">
            <label>
              Symbol
              <input value={selectedSymbol} onChange={(event) => setSelectedSymbol(event.target.value.toUpperCase())} placeholder="Enter Symbol" />
            </label>
            <label>
              Interval
              <select value={selectedInterval} onChange={(event) => setSelectedInterval(event.target.value)}>
                {INTERVAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="primary" onClick={handleFetchQuote}>
              Load quote
            </button>
          </div>
          <p className="page-subtitle">Market trend graphs show the latest quote movement on both axes.</p>
          {chartPoints.length > 1 ? (
            <StockTrendChart series={chartPoints} />
          ) : stockResult ? (
            <pre style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.04)', padding: '1rem', borderRadius: '1rem' }}>
              {JSON.stringify(stockResult, null, 2)}
            </pre>
          ) : null}
        </div>

        <TradeForm
          onBuy={handleBuy}
          onSell={handleSell}
          autoSymbol={autoFillSymbol}
          autoPrice={autoFillPrice}
        />
      </div>
    </div>
  );
}
