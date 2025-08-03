// Binance API utility functions
const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// 심볼 매핑 (우리 앱의 심볼 -> 바이낸스 심볼)
const SYMBOL_MAPPING = {
  'BTC': 'BTCUSDT',
  'ETH': 'ETHUSDT', 
  'BNB': 'BNBUSDT',
  'ADA': 'ADAUSDT'
};

// 시간 간격 매핑 및 밀리초 변환
const TIMEFRAME_MAPPING = {
  '15m': { binanceInterval: '15m', ms: 15 * 60 * 1000, displayName: '15분 봉' },
  '30m': { binanceInterval: '30m', ms: 30 * 60 * 1000, displayName: '30분 봉' },
  '1h': { binanceInterval: '1h', ms: 60 * 60 * 1000, displayName: '1시간 봉' },
  '4h': { binanceInterval: '4h', ms: 4 * 60 * 60 * 1000, displayName: '4시간 봉' },
  '8h': { binanceInterval: '8h', ms: 8 * 60 * 60 * 1000, displayName: '8시간 봉' },
  '1d': { binanceInterval: '1d', ms: 24 * 60 * 60 * 1000, displayName: '1일 봉' }
};

/**
 * 바이낸스에서 캔들스틱 데이터 가져오기 (여러 번 호출로 1000개 이상 지원)
 * @param {string} symbol - 코인 심볼 (BTC, ETH, etc.)
 * @param {number} candleCount - 필요한 캔들 수
 * @param {string} timeframe - 시간 간격 (15m, 30m, 1h, 4h, 8h, 1d)
 * @returns {Promise<Array>} 캔들스틱 데이터 배열
 */
export const fetchHistoricalData = async (symbol, candleCount, timeframe = '4h') => {
  try {
    const binanceSymbol = SYMBOL_MAPPING[symbol] || 'BTCUSDT';
    const timeframeConfig = TIMEFRAME_MAPPING[timeframe] || TIMEFRAME_MAPPING['4h'];
    
    
  //   // 시작 시점을 해당 시간 간격 단위로 정렬
  //   const alignedStartTime = Math.floor(randomStartTime / timeframeConfig.ms) * timeframeConfig.ms;
		const now = Date.now();
    const totalTimeNeeded = candleCount * timeframeConfig.ms;

    // 바이낸스 서비스 시작 시점 (2017년 1월 1일)
    const binanceLaunchTime = new Date('2017-01-01').getTime();

    // 데이터를 가져올 수 있는 가장 이른 시점 (현재 시간 - totalTimeNeeded)
    // 이 시점 이후여야 요청된 캔들 수를 현재까지 채울 수 있습니다.
    const latestPossibleStartTime = now - totalTimeNeeded - (1000 * timeframeConfig.ms); // 여유분 추가

    // **수정된 부분:**
    // randomStartTime의 하한선을 binanceLaunchTime으로 설정
    // 상한선은 latestPossibleStartTime으로 설정
    // 즉, 2017년 1월 1일(binanceLaunchTime)부터, 현재까지 totalTimeNeeded 기간을 채울 수 있는
    // 가장 이른 시작 시점(latestPossibleStartTime)까지 중에서 무작위로 시작 시점을 선택합니다.
    const randomStartTime = Math.floor(
      Math.random() * (latestPossibleStartTime - binanceLaunchTime)
    ) + binanceLaunchTime;

    // 시작 시점을 해당 시간 간격 단위로 정렬
    const alignedStartTime = Math.floor(randomStartTime / timeframeConfig.ms) * timeframeConfig.ms;
    
    console.log(`Fetching ${candleCount} candles for ${binanceSymbol} (${timeframeConfig.displayName}) starting from ${new Date(alignedStartTime).toISOString()}`);
    
    const allData = [];
    let currentStartTime = alignedStartTime;
    let remainingCandles = candleCount;
    
    // 바이낸스 API는 최대 1000개씩만 가져올 수 있으므로 여러 번 호출
    while (remainingCandles > 0) {
      const batchSize = Math.min(1000, remainingCandles);
      
      console.log(`Fetching batch: ${batchSize} candles from ${new Date(currentStartTime).toISOString()}`);
      
      const response = await fetch(
        `${BINANCE_API_BASE}/klines?symbol=${binanceSymbol}&interval=${timeframeConfig.binanceInterval}&startTime=${currentStartTime}&limit=${batchSize}`
      );
      
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }
      
      const batchData = await response.json();
      
      if (batchData.length === 0) {
        console.warn('No more data available from Binance API');
        break;
      }
      
      // 바이낸스 데이터를 우리 형식으로 변환 (타임스탬프 포함)
      const formattedBatch = batchData.map(candle => ({
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        timestamp: candle[0] // 바이낸스 타임스탬프 (밀리초)
      }));
      
      allData.push(...formattedBatch);
      
      // 다음 배치를 위한 시작 시간 계산 (마지막 캔들의 다음 시간)
      const lastCandle = batchData[batchData.length - 1];
      currentStartTime = lastCandle[0] + timeframeConfig.ms;
      
      remainingCandles -= batchData.length;
      
      console.log(`Fetched ${batchData.length} candles, ${remainingCandles} remaining`);
      
      // API 호출 간격 (rate limiting 방지)
      if (remainingCandles > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Successfully fetched total ${allData.length} candles (requested: ${candleCount})`);
    console.log(`Data period: ${new Date(allData[0]?.timestamp).toISOString()} ~ ${new Date(allData[allData.length - 1]?.timestamp).toISOString()}`);
    
    // 정확히 요청된 수만큼만 반환
    return allData.slice(0, candleCount);
    
  } catch (error) {
    console.error('Error fetching historical data:', error);
    
    // API 실패 시 기존 mock 데이터로 fallback (타임스탬프 추가)
    console.log('Falling back to mock data...');
    const { generateMockData } = await import('./dataGenerator');
    const mockData = generateMockData(candleCount, symbol);
    
    // Mock 데이터에 타임스탬프 추가
    const timeframeConfig = TIMEFRAME_MAPPING[timeframe] || TIMEFRAME_MAPPING['4h'];
    const now = Date.now();
    const startTime = now - (candleCount * timeframeConfig.ms);
    
    return mockData.map((candle, index) => ({
      ...candle,
      timestamp: startTime + (index * timeframeConfig.ms)
    }));
  }
};

/**
 * 사용 가능한 시간 간격 목록 반환
 * @returns {Array} 시간 간격 옵션 배열
 */
export const getAvailableTimeframes = () => {
  return Object.entries(TIMEFRAME_MAPPING).map(([key, config]) => ({
    value: key,
    label: config.displayName,
    ms: config.ms
  }));
};

/**
 * 시간 간격에 따른 예상 기간 계산
 * @param {string} timeframe - 시간 간격
 * @param {number} candleCount - 캔들 수
 * @returns {string} 예상 기간 문자열
 */
export const calculateEstimatedPeriod = (timeframe, candleCount) => {
  const timeframeConfig = TIMEFRAME_MAPPING[timeframe];
  if (!timeframeConfig) return '알 수 없음';
  
  const totalMs = candleCount * timeframeConfig.ms;
  const days = Math.round(totalMs / (24 * 60 * 60 * 1000));
  
  if (days < 1) {
    const hours = Math.round(totalMs / (60 * 60 * 1000));
    return `약 ${hours}시간`;
  } else if (days < 30) {
    return `약 ${days}일`;
  } else if (days < 365) {
    const months = Math.round(days / 30);
    return `약 ${months}개월`;
  } else {
    const years = Math.round(days / 365);
    return `약 ${years}년`;
  }
};

/**
 * 심볼이 유효한지 확인
 * @param {string} symbol - 확인할 심볼
 * @returns {boolean} 유효 여부
 */
export const isValidSymbol = (symbol) => {
  return Object.keys(SYMBOL_MAPPING).includes(symbol);
};

/**
 * 바이낸스 심볼로 변환
 * @param {string} symbol - 우리 앱의 심볼
 * @returns {string} 바이낸스 심볼
 */
export const toBinanceSymbol = (symbol) => {
  return SYMBOL_MAPPING[symbol] || 'BTCUSDT';
};
