import { useEffect, useState, type FormEvent } from 'react';
import type { TradeRequest } from '../types';

interface Props {
  onBuy: (request: TradeRequest) => Promise<void>;
  onSell: (request: TradeRequest) => Promise<void>;
  autoSymbol?: string;
  autoPrice?: number;
}

export default function TradeForm({ onBuy, onSell, autoSymbol, autoPrice }: Props) {
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (autoSymbol && !symbol) {
      setSymbol(autoSymbol);
    }
  }, [autoSymbol, symbol]);

  useEffect(() => {
    if (autoPrice !== undefined && !price) {
      setPrice(String(autoPrice.toFixed(2)));
    }
  }, [autoPrice, price]);

  const buttonText = mode === 'buy' ? 'Buy stock' : 'Sell stock';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    const request = {
      symbol: symbol.trim().toUpperCase(),
      quantity: Number(quantity),
      price: Number(price)
    };

    try {
      if (mode === 'buy') {
        await onBuy(request);
      } else {
        await onSell(request);
      }
      setSymbol('');
      setQuantity('');
      setPrice('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card trade-card">
      <div className="trade-tabs">
        <button
          type="button"
          className={mode === 'buy' ? 'tab active' : 'tab'}
          onClick={() => setMode('buy')}
        >
          Buy
        </button>
        <button
          type="button"
          className={mode === 'sell' ? 'tab active' : 'tab'}
          onClick={() => setMode('sell')}
        >
          Sell
        </button>
      </div>
      <h2 className="page-title">{mode === 'buy' ? 'Buy stock' : 'Sell stock'}</h2>
      <form onSubmit={handleSubmit} className="field-group">
        <label>
          Symbol
          <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="Enter Symbol" required />
        </label>
        <label>
          Quantity
          <input
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="1"
            required
          />
        </label>
        <label>
          Price
          <input
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="170.50"
            required
          />
        </label>
        <button type="submit" className="primary" disabled={isLoading}>
          {isLoading ? 'Submitting...' : buttonText}
        </button>
      </form>
    </div>
  );
}
