import React, { useState, useEffect } from 'react';
import MainScreen from './components/MainScreen';
import TradingScreen from './components/TradingScreen';
import ResultScreen from './components/ResultScreen';
import { fetchHistoricalData } from './utils/binanceApi';

const App = () => {
  const [gameState, setGameState] = useState('main'); // 'main', 'trading', 'result', 'loading'
  const [gameConfig, setGameConfig] = useState({
    tradingPeriod: 500,
    initialBalance: 10000,
    selectedCoin: 'BTC',
    selectedTimeframe: '4h'
  });
  const [gameData, setGameData] = useState(null);
  const [gameResults, setGameResults] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');

  const startGame = async (config) => {
    setGameConfig(config);
    setGameState('loading');
    setLoadingMessage('실제 과거 데이터를 불러오는 중...');
    
    try {
      // 실제 바이낸스 데이터 가져오기 (기본 1000캔들 + 트레이딩 기간)
      const totalCandles = 1000 + config.tradingPeriod;
      const data = await fetchHistoricalData(config.selectedCoin, totalCandles, config.selectedTimeframe);
      
      setGameData(data);
      setGameState('trading');
    } catch (error) {
      console.error('Failed to load historical data:', error);
      setLoadingMessage('데이터 로딩에 실패했습니다. 다시 시도해주세요.');
      
      // 3초 후 메인 화면으로 돌아가기
      setTimeout(() => {
        setGameState('main');
      }, 3000);
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
      {gameState === 'main' && (
        <MainScreen onStartGame={startGame} />
      )}
      {gameState === 'loading' && (
        <div className="flex flex-col items-center gap-4" style={{ minHeight: '100vh', justifyContent: 'center' }}>
          <div className="card text-center" style={{ maxWidth: '400px' }}>
            <div className="mb-4">
              <div className="progress-bar mb-4">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: '100%',
                    animation: 'pulse 2s infinite'
                  }}
                ></div>
              </div>
              <p className="text-lg font-bold mb-2">{loadingMessage}</p>
              <p className="text-sm" style={{ color: '#9ca3af' }}>
                바이낸스에서 실제 과거 데이터를 가져오고 있습니다...
              </p>
            </div>
          </div>
        </div>
      )}
      {gameState === 'trading' && (
        <TradingScreen 
          config={gameConfig}
          data={gameData}
          onEndGame={endGame}
        />
      )}
      {gameState === 'result' && (
        <ResultScreen 
          results={gameResults}
          onRestart={resetGame}
        />
      )}
    </div>
  );
};

export default App;
