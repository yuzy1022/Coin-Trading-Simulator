import React, { useState } from 'react';
import { Play, TrendingUp } from 'lucide-react';
import { getAvailableTimeframes, calculateEstimatedPeriod } from '../utils/binanceApi';

const MainScreen = ({ onStartGame }) => {
  const [tradingPeriod, setTradingPeriod] = useState(500);
  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [selectedTimeframe, setSelectedTimeframe] = useState('4h');

  const coins = [
    { symbol: 'BTC', name: '비트코인' },
    { symbol: 'ETH', name: '이더리움' },
    { symbol: 'BNB', name: '바이낸스 코인' },
    { symbol: 'ADA', name: '카르다노' }
  ];

  const timeframes = getAvailableTimeframes();
  const estimatedPeriod = calculateEstimatedPeriod(selectedTimeframe, tradingPeriod);
    
  const handleStart = () => {
    onStartGame({
      tradingPeriod,
      selectedCoin,
      selectedTimeframe,
      initialBalance: 10000
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
            <label className="block mb-2 font-bold">매매 기간 설정</label>
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
              {estimatedPeriod} 분량의 {timeframes.find(t => t.value === selectedTimeframe)?.label} 데이터 (실제 과거 데이터)
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
