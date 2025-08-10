import React, { useState, useEffect } from 'react';
import { Play, TrendingUp } from 'lucide-react';
import { getAvailableTimeframes, calculateEstimatedPeriod } from '../utils/binanceApi';

const MainScreen = ({ onStartGame }) => {
  // --- START: 수정된 부분 ---

  // 1. 로컬 스토리지에서 저장된 설정 불러오기
  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('coinTradingGameSettings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
    }
    return null; // 저장된 설정이 없거나 오류 발생 시 null 반환
  };

  const savedSettings = loadSettings();
  const today = new Date().toISOString().split('T')[0];

  // 2. 저장된 값 또는 기본값으로 상태 초기화
  const [tradingPeriod, setTradingPeriod] = useState(savedSettings?.tradingPeriod || 500);
  const [selectedCoin, setSelectedCoin] = useState(savedSettings?.selectedCoin || 'BTC');
  const [selectedTimeframe, setSelectedTimeframe] = useState(savedSettings?.selectedTimeframe || '4h');
  const [startDate, setStartDate] = useState(savedSettings?.startDate || '2020-01-01');
  const [endDate, setEndDate] = useState(savedSettings?.endDate || today);
  const [dateError, setDateError] = useState('');

  // 3. 설정값이 변경될 때마다 로컬 스토리지에 저장
  useEffect(() => {
    try {
      const settings = {
        tradingPeriod,
        selectedCoin,
        selectedTimeframe,
        startDate,
        endDate,
      };
      localStorage.setItem('coinTradingGameSettings', JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage", error);
    }
  }, [tradingPeriod, selectedCoin, selectedTimeframe, startDate, endDate]);

  // --- END: 수정된 부분 ---

  const coins = [
    { symbol: 'BTC', name: '비트코인' },
    { symbol: 'ETH', name: '이더리움' },
		{ symbol: 'XRP', name: '리플' },
		{ symbol: 'SOL', name: '솔라나' },
    { symbol: 'BNB', name: '바이낸스 코인' },
    { symbol: 'ADA', name: '카르다노' },
  ];

  const timeframes = getAvailableTimeframes();
  const estimatedPeriod = calculateEstimatedPeriod(selectedTimeframe, tradingPeriod);

	useEffect(() => {
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const timeframeInfo = timeframes.find(t => t.value === selectedTimeframe);
    const timeframeMs = timeframeInfo?.ms || 0;
    
    // --- 1. 최소 시작일 유효성 검사  ---
    const binanceLaunchMs = new Date('2017-01-01').getTime();
    const requiredHistoryMs = 1000 * timeframeMs; // 이전 1000개 캔들에 필요한 시간
    const earliestSelectableDateMs = binanceLaunchMs + requiredHistoryMs;

    if (startMs < earliestSelectableDateMs) {
      const earliestDate = new Date(earliestSelectableDateMs);
      setDateError(`시작일이 너무 이릅니다. ${timeframeInfo?.label} 기준 1000개 과거 데이터를 위해, 시작일은 ${earliestDate.toLocaleDateString('ko-KR')} 이후여야 합니다.`);
      return; // 검사 종료
    }

    // --- 2. 종료일이 시작일보다 빠른지 검사 ---
    if (startMs >= endMs) {
      setDateError('종료일은 시작일보다 이후여야 합니다.');
      return; // 검사 종료
    }

    // --- 3. 설정한 기간이 플레이할 캔들 수에 비해 짧은지 검사 ---
    const selectedRangeMs = endMs - startMs;
    const requiredMs = tradingPeriod * timeframeMs;
    
    if (selectedRangeMs < requiredMs) {
      const requiredDays = Math.ceil(requiredMs / (1000 * 60 * 60 * 24));
      setDateError(`플레이 기간이 너무 짧습니다. ${tradingPeriod}개의 ${timeframeInfo?.label}을(를) 위해서는 최소 ${requiredDays}일의 기간이 필요합니다.`);
    } else {
      // 모든 검사를 통과하면 에러 메시지 초기화
      setDateError('');
    }
  }, [startDate, endDate, tradingPeriod, selectedTimeframe, timeframes]);
    
  const handleStart = () => {
    // 유효성 검사 에러가 있으면 게임 시작 방지
    if (dateError) {
      alert(dateError);
      return;
    }

    onStartGame({
      tradingPeriod,
      selectedCoin,
      selectedTimeframe,
      initialBalance: 10000,
      startDate, // 시작일 전달
      endDate,   // 종료일 전달
    });
  };

  return (
    <div className="flex flex-col items-center gap-4" style={{ minHeight: '100vh', justifyContent: 'center' }}>
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-4 mb-4">
          <TrendingUp size={48} className="text-green" />
          <h1 className="text-xl font-bold">코인 트레이딩 시뮬레이터</h1>
        </div>
        <p style={{ color: '#9ca3af' }}>실제 과거 데이터로 가상 트레이딩을 연습해보세요</p>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block mb-2 font-bold">코인 선택</label>
            <select 
              className="input" 
              style={{ width: '100%' }}
              value={selectedCoin}
              onChange={(e) => setSelectedCoin(e.target.value)}
            >
              {coins.map(coin => (
                <option key={coin.symbol} value={coin.symbol}>
                  {coin.name} ({coin.symbol})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2 font-bold">캔들 간격</label>
            <select 
              className="input" 
              style={{ width: '100%' }}
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value)}
            >
              {timeframes.map(timeframe => (
                <option key={timeframe.value} value={timeframe.value}>
                  {timeframe.label}
                </option>
              ))}
            </select>
          </div>

					<div>
            <label className="block mb-2 font-bold">플레이 기간 설정</label>
            <div className="grid grid-2 gap-2">
              <input
                type="date"
                className="input"
                value={startDate}
                min="2017-01-01"
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <input
                type="date"
                className="input"
                value={endDate}
                min={startDate}
                max={today}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {dateError && <p className="text-sm mt-2 text-red">{dateError}</p>}
          </div>
					
          <div>
            <label className="block mb-2 font-bold">매매 기간 설정 (캔들수)</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="100"
                max="1000"
                step="50"
                value={tradingPeriod}
                onChange={(e) => setTradingPeriod(Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <span className="text-lg font-bold">{tradingPeriod} 캔들</span>
            </div>
            <p className="text-sm mt-2" style={{ color: '#9ca3af' }}>
              {startDate} ~ {endDate} 기간 내 랜덤한 {estimatedPeriod} 분량의 {timeframes.find(t => t.value === selectedTimeframe)?.label} 데이터
            </p>
          </div>

          <div className="grid grid-2 gap-4 mt-4">
            <div className="card" style={{ background: '#0f172a', textAlign: 'center' }}>
              <p className="text-sm" style={{ color: '#9ca3af' }}>초기 자산</p>
              <p className="text-lg font-bold text-green">$10,000</p>
            </div>
            <div className="card" style={{ background: '#0f172a', textAlign: 'center' }}>
              <p className="text-sm" style={{ color: '#9ca3af' }}>거래 수수료</p>
              <p className="text-lg font-bold">0.05%</p>
            </div>
          </div>

          <div className="card" style={{ background: '#0f172a', padding: '12px' }}>
            <p className="text-sm font-bold mb-2">📊 실제 데이터 사용</p>
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              바이낸스 API를 통해 실제 과거 {timeframes.find(t => t.value === selectedTimeframe)?.label} 데이터를 무작위로 선택하여 제공합니다.
            </p>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '20px' }}
            onClick={handleStart}
						disabled={!!dateError}
          >
            <Play size={20} />
            게임 시작
          </button>
        </div>
      </div>
    </div>
  );
};

export default MainScreen;