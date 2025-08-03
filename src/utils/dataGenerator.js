// Mock data generator for cryptocurrency prices
export const generateMockData = (length = 1500, coinSymbol = 'BTC') => {
  const data = [];
  
  // Different base prices and characteristics for different coins
  const coinConfigs = {
    BTC: { basePrice: 45000 + Math.random() * 10000, volatility: 0.02, trend: 0.001 },
    ETH: { basePrice: 2500 + Math.random() * 1000, volatility: 0.025, trend: 0.0012 },
    BNB: { basePrice: 300 + Math.random() * 100, volatility: 0.03, trend: 0.0008 },
    ADA: { basePrice: 0.5 + Math.random() * 0.3, volatility: 0.035, trend: 0.0015 }
  };
  
  const config = coinConfigs[coinSymbol] || coinConfigs.BTC;
  let basePrice = config.basePrice;
  
  for (let i = 0; i < length; i++) {
    const trend = Math.sin(i / 100) * config.trend;
    const randomChange = (Math.random() - 0.5) * config.volatility;
    
    const priceChange = trend + randomChange;
    const newPrice = basePrice * (1 + priceChange);
    
    // Generate OHLC data
    const open = basePrice;
    const close = newPrice;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    
    data.push({
      open: parseFloat(open.toFixed(coinSymbol === 'ADA' ? 4 : 2)),
      high: parseFloat(high.toFixed(coinSymbol === 'ADA' ? 4 : 2)),
      low: parseFloat(low.toFixed(coinSymbol === 'ADA' ? 4 : 2)),
      close: parseFloat(close.toFixed(coinSymbol === 'ADA' ? 4 : 2)),
      volume: Math.floor(Math.random() * 1000000) + 100000,
      timestamp: null // Mock 데이터는 타임스탬프가 나중에 추가됨
    });
    
    basePrice = newPrice;
  }
  
  return data;
};

// Simulate real-time data updates
export const generateNextCandle = (lastCandle, coinSymbol = 'BTC') => {
  const coinConfigs = {
    BTC: { volatility: 0.015 },
    ETH: { volatility: 0.018 },
    BNB: { volatility: 0.022 },
    ADA: { volatility: 0.025 }
  };
  
  const config = coinConfigs[coinSymbol] || coinConfigs.BTC;
  const randomChange = (Math.random() - 0.5) * config.volatility;
  
  const open = lastCandle.close;
  const close = open * (1 + randomChange);
  const high = Math.max(open, close) * (1 + Math.random() * 0.008);
  const low = Math.min(open, close) * (1 - Math.random() * 0.008);
  
  return {
    open: parseFloat(open.toFixed(coinSymbol === 'ADA' ? 4 : 2)),
    high: parseFloat(high.toFixed(coinSymbol === 'ADA' ? 4 : 2)),
    low: parseFloat(low.toFixed(coinSymbol === 'ADA' ? 4 : 2)),
    close: parseFloat(close.toFixed(coinSymbol === 'ADA' ? 4 : 2)),
    volume: Math.floor(Math.random() * 1000000) + 100000,
    timestamp: lastCandle.timestamp ? lastCandle.timestamp + (15 * 60 * 1000) : Date.now() // 15분 간격으로 가정
  };
};
