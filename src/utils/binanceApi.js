// Binance API utility functions
const BINANCE_API_BASE = 'https://api.binance.com/api/v3';

// 심볼 매핑 (우리 앱의 심볼 -> 바이낸스 심볼)
const SYMBOL_MAPPING = {
  'BTC': 'BTCUSDT',
  'ETH': 'ETHUSDT',
	'XRP': 'XRPUSDT',
	'SOL': 'SOLUSDT',
  'BNB': 'BNBUSDT',
  'ADA': 'ADAUSDT',
};

// 시간 간격 매핑 및 밀리초 변환
const TIMEFRAME_MAPPING = {
  '1m': { binanceInterval: '1m', ms: 1 * 60 * 1000, displayName: '1분 봉' },
  '5m': { binanceInterval: '5m', ms: 5 * 60 * 1000, displayName: '5분 봉' },
  '15m': { binanceInterval: '15m', ms: 15 * 60 * 1000, displayName: '15분 봉' },
  '30m': { binanceInterval: '30m', ms: 30 * 60 * 1000, displayName: '30분 봉' },
  '1h': { binanceInterval: '1h', ms: 60 * 60 * 1000, displayName: '1시간 봉' },
  '4h': { binanceInterval: '4h', ms: 4 * 60 * 60 * 1000, displayName: '4시간 봉' },
  '8h': { binanceInterval: '8h', ms: 8 * 60 * 60 * 1000, displayName: '8시간 봉' },
  '1d': { binanceInterval: '1d', ms: 24 * 60 * 60 * 1000, displayName: '1일 봉' }
};

/**
 * 바이낸스에서 캔들스틱 데이터 가져오기 (사용자 지정 기간 내에서 랜덤 데이터)
 * @param {string} symbol - 코인 심볼 (BTC, ETH, etc.)
 * @param {number} candleCount - 필요한 캔들 수 (과거 1000개 + 플레이 기간)
 * @param {string} timeframe - 시간 간격 (15m, 30m, 1h, 4h, 8h, 1d)
 * @param {string} userStartDate - 사용자 지정 시작일 (YYYY-MM-DD)
 * @param {string} userEndDate - 사용자 지정 종료일 (YYYY-MM-DD)
 * @returns {Promise<Array>} 캔들스틱 데이터 배열
 */
export const fetchHistoricalData = async (symbol, candleCount, timeframe = '4h', userStartDate, userEndDate) => {
  try {
    const binanceSymbol = SYMBOL_MAPPING[symbol] || 'BTCUSDT';
    const timeframeConfig = TIMEFRAME_MAPPING[timeframe] || TIMEFRAME_MAPPING['4h'];
    
    // --- BUG FIX START: 랜덤 기간 추출 로직 전체 수정 ---
    const tradingPeriodCandles = candleCount - 1000;
    if (tradingPeriodCandles <= 0) {
      throw new Error("플레이할 캔들 수가 유효하지 않습니다.");
    }

    // 1. 사용자가 설정한 기간 내에서 '플레이할 기간'을 랜덤으로 선택
    const tradingTimeNeeded = tradingPeriodCandles * timeframeConfig.ms;
    const searchRangeStart = new Date(userStartDate).getTime();
    const searchRangeEnd = new Date(userEndDate).getTime();

    // 플레이 기간이 시작될 수 있는 가장 늦은 시점
    const latestPlayableStartTime = searchRangeEnd - tradingTimeNeeded;

    if (searchRangeStart > latestPlayableStartTime) {
      // 이 오류는 MainScreen에서 먼저 처리되지만, 만약을 위한 안전장치
      throw new Error('선택한 기간이 요청된 캔들 수에 비해 너무 짧습니다.');
    }

    // 플레이 기간의 시작 시점을 무작위로 선택
    const randomPlayableStartTime = Math.floor(
      Math.random() * (latestPlayableStartTime - searchRangeStart + 1)
    ) + searchRangeStart;

    // 2. 실제 API로 요청할 시작 시점 계산 (랜덤 시작 시점 - 과거 1000개 캔들 시간)
    const historyTimeNeeded = 1000 * timeframeConfig.ms;
    const apiCallStartTime = randomPlayableStartTime - historyTimeNeeded;

    // 최종 시작 시점을 캔들 시간 간격에 맞춰 정렬
    const alignedStartTime = Math.floor(apiCallStartTime / timeframeConfig.ms) * timeframeConfig.ms;
    // --- BUG FIX END ---
    
    console.log(`Fetching ${candleCount} candles for ${binanceSymbol} (${timeframeConfig.displayName}) within ${userStartDate} ~ ${userEndDate}`);
    console.log(`Randomized playable start time: ${new Date(randomPlayableStartTime).toISOString()}`);
    console.log(`Actual API call start time (with history): ${new Date(alignedStartTime).toISOString()}`);
    
    const allData = [];
    let currentStartTime = alignedStartTime;
    let remainingCandles = candleCount;
    
    while (remainingCandles > 0) {
      const batchSize = Math.min(1000, remainingCandles);
      const response = await fetch(
        `${BINANCE_API_BASE}/klines?symbol=${binanceSymbol}&interval=${timeframeConfig.binanceInterval}&startTime=${currentStartTime}&limit=${batchSize}`
      );
      
      if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
      
      const batchData = await response.json();
      if (batchData.length === 0) {
        console.warn('No more data available from Binance API');
        break;
      }
      
      const formattedBatch = batchData.map(candle => ({
        open: parseFloat(candle[1]),
        high: parseFloat(candle[2]),
        low: parseFloat(candle[3]),
        close: parseFloat(candle[4]),
        volume: parseFloat(candle[5]),
        timestamp: candle[0]
      }));
      
      allData.push(...formattedBatch);
      
      const lastCandle = batchData[batchData.length - 1];
      currentStartTime = lastCandle[0] + timeframeConfig.ms;
      remainingCandles -= batchData.length;
      
      if (remainingCandles > 0) await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Successfully fetched total ${allData.length} candles (requested: ${candleCount})`);
    if (allData.length > 0) {
      console.log(`Data period: ${new Date(allData[0]?.timestamp).toISOString()} ~ ${new Date(allData[allData.length - 1]?.timestamp).toISOString()}`);
    }
    
    return {
      data: allData.slice(0, candleCount),
      playableStartTime: randomPlayableStartTime
    };
    
  } catch (error) {
    console.error('Error fetching historical data:', error);
    
    console.log('Falling back to mock data...');
    // Fallback 로직은 동적 import를 사용하므로 dataGenerator.js 파일이 필요합니다.
    const { generateMockData } = await import('./dataGenerator'); 
    const mockData = generateMockData(candleCount, symbol);
    
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