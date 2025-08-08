import React, { useState, useEffect } from 'react';
import MainScreen from './components/MainScreen';
import TradingScreen from './components/TradingScreen';
import ResultScreen from './components/ResultScreen';
import { fetchHistoricalData } from './utils/binanceApi';

const App = () => {
  const [gameState, setGameState] = useState('main');
  const [gameConfig, setGameConfig] = useState({
    tradingPeriod: 500,
    initialBalance: 10000,
    selectedCoin: 'BTC',
    selectedTimeframe: '4h',
    startDate: '2020-01-01',
    endDate: new Date().toISOString().split('T')[0],
  });
  const [gameData, setGameData] = useState(null);
  const [gameResults, setGameResults] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  // --- 추가된 부분: 게임 시작 인덱스를 저장할 state ---
  const [gameStartIndex, setGameStartIndex] = useState(1000);

  const startGame = async (config) => {
    setGameConfig(config);
    setGameState('loading');
    setLoadingMessage('실제 과거 데이터를 불러오는 중...');
    
    try {
      const totalCandles = 1000 + config.tradingPeriod;
      
      // --- API로부터 객체를 받아 처리 ---
      const { data, playableStartTime } = await fetchHistoricalData(
        config.selectedCoin, totalCandles, config.selectedTimeframe,
        config.startDate, config.endDate
      );

      // API가 반환한 데이터 안에서, 우리가 원했던 플레이 시작 시간의 인덱스를 찾습니다.
      const startIndex = data.findIndex(candle => candle.timestamp >= playableStartTime);

      if (startIndex === -1) {
        console.error("API가 반환한 데이터에 원하는 시작 날짜가 없습니다. 기본값(1000)으로 시작합니다.");
        setGameStartIndex(1000);
      } else {
        // 찾은 인덱스가 1000보다 작으면(과거 데이터가 부족하면) 그 인덱스를, 충분하면 1000을 사용합니다.
        // 이는 과거 데이터가 1000개 미만일 때 차트가 깨지지 않게 하기 위함입니다.
        const historyCandlesAvailable = startIndex;
        setGameStartIndex(Math.min(1000, historyCandlesAvailable));
      }
      
      setGameData(data);
      setGameState('trading');
    } catch (error) {
      console.error('Failed to load historical data:', error);
      setLoadingMessage('데이터 로딩에 실패했습니다. 다시 시도해주세요.');
      
      setTimeout(() => setGameState('main'), 3000);
    }
  };

  const endGame = (results) => {
    setGameResults(results);
    setGameState('result');
  };

  const resetGame = () => {
    setGameState('main');
    setGameData(null);
    setGameResults(null);
    setLoadingMessage('');
  };

  return (
    <div className="container">
      {gameState === 'main' && (<MainScreen onStartGame={startGame} />)}
      {gameState === 'loading' && (
        <div className="flex flex-col items-center gap-4" style={{ minHeight: '100vh', justifyContent: 'center' }}>
          <div className="card text-center" style={{ maxWidth: '400px' }}>
            <div className="mb-4">
              <div className="progress-bar mb-4"><div className="progress-fill" style={{ width: '100%', animation: 'pulse 2s infinite' }}></div></div>
              <p className="text-lg font-bold mb-2">{loadingMessage}</p>
              <p className="text-sm" style={{ color: '#9ca3af' }}>바이낸스에서 실제 과거 데이터를 가져오고 있습니다...</p>
            </div>
          </div>
        </div>
      )}
      {gameState === 'trading' && (
        <TradingScreen 
          config={gameConfig}
          data={gameData}
          // --- 계산된 시작 인덱스를 prop으로 전달 ---
          startIndex={gameStartIndex}
          onEndGame={endGame}
        />
      )}
      {gameState === 'result' && (<ResultScreen results={gameResults} onRestart={resetGame} />)}
    </div>
  );
};

export default App;