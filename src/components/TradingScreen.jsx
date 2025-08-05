// TradingScreen.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Chart from './Chart';
import TradingPanel from './TradingPanel';
import PositionInfo from './PositionInfo';
import { TrendingUp, Clock, DollarSign, Zap } from 'lucide-react';
import { getAvailableTimeframes } from '../utils/binanceApi';

const TradingScreen = ({ config, data, onEndGame }) => {
  const [currentIndex, setCurrentIndex] = useState(999);
  const [balance, setBalance] = useState(config.initialBalance);
  const [position, setPosition] = useState(null);
  const [trades, setTrades] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [leverage, setLeverage] = useState(1);
  const [liquidationPrice, setLiquidationPrice] = useState(null);
  const [marginType, setMarginType] = useState('isolated');
  const intervalRef = useRef(null);
  const gameEndedRef = useRef(false);

  const isDataValid = data && Array.isArray(data) && data.length > 0 && currentIndex < data.length;
  const currentCandle = isDataValid ? data[currentIndex] : null;
  const currentPrice = currentCandle ? currentCandle.close : 0;
  
  const tradingStartIndex = 1000;
  const tradingProgress = Math.max(0, currentIndex - tradingStartIndex + 1);
  const remainingCandles = Math.max(0, config.tradingPeriod - tradingProgress);
  const progress = (tradingProgress / config.tradingPeriod) * 100;

  const timeframes = getAvailableTimeframes();
  const currentTimeframe = timeframes.find(t => t.value === config.selectedTimeframe);
  const tradingStartTime = data && data[tradingStartIndex] ? data[tradingStartIndex].timestamp : null;
  const tradingEndTime = data && data[Math.min(tradingStartIndex + config.tradingPeriod - 1, data.length - 1)] 
    ? data[Math.min(tradingStartIndex + config.tradingPeriod - 1, data.length - 1)].timestamp 
    : null;

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.slice(0, currentIndex + 1);
  }, [data, currentIndex]);

  useEffect(() => {
    if (isPlaying && remainingCandles > 0 && isDataValid && currentPrice > 0) {
      const interval = 150 / playbackSpeed;
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + 1;
          if (next >= tradingStartIndex + config.tradingPeriod || next >= data.length) {
            setIsPlaying(false);
            return prev;
          }
          return next;
        });
      }, interval);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, remainingCandles, config.tradingPeriod, playbackSpeed, isDataValid, currentPrice, data.length, tradingStartIndex]);
  
  useEffect(() => {
    if (position && currentCandle) {
      if (position.entryIndex === currentIndex) return;

      let triggeredLiquidation = false;
      if (position.type === 'long' && currentCandle.low <= position.liquidationPrice) {
        triggeredLiquidation = true;
      } else if (position.type === 'short' && currentCandle.high >= position.liquidationPrice) {
        triggeredLiquidation = true;
      }
      
      if (triggeredLiquidation) {
        handleLiquidation();
      }
    }
  }, [currentIndex, position, currentCandle]);

  useEffect(() => {
    if (remainingCandles <= 0 && !gameEndedRef.current && currentPrice > 0) {
      gameEndedRef.current = true;
      calculateResults();
    }
  }, [remainingCandles, currentPrice]);

  const handleLiquidation = () => {
    if (!position) return;

    let pnl;
    let finalBalance = balance;

    if (position.marginType === 'isolated') {
        pnl = -position.margin;
    } else {
        pnl = -(position.margin + balance);
        finalBalance = 0;
    }
    
    setBalance(finalBalance);

    const liquidationTrade = {
      ...position,
      exitPrice: position.liquidationPrice,
      exitTime: currentIndex,
      exitTimestamp: currentCandle?.timestamp,
      pnl: pnl,
      balanceAfter: finalBalance,
      status: 'Liquidation'
    };
    
    setTrades(prev => [...prev, liquidationTrade]);
    setPosition(null);
    setLiquidationPrice(null);

    setTimeout(() => {
        alert(`포지션이 청산되었습니다! (${position.marginType === 'isolated' ? '격리' : '교차'}) 청산가: ${formatPrice(position.liquidationPrice)}`);
    }, 100);
  };

  const calculateResults = () => {
    let finalBalance = balance;
    let finalTrades = [...trades];
    
    if (position && currentPrice > 0) {
      const pnl = position.type === 'long' 
        ? (currentPrice - position.avgPrice) * position.totalQuantity
        : (position.avgPrice - currentPrice) * position.totalQuantity;
      
      const fee = currentPrice * position.totalQuantity * 0.0005;
      finalBalance = balance + position.margin + pnl - fee;
      
      const finalTrade = { ...position, exitPrice: currentPrice, exitTime: currentIndex, exitTimestamp: currentCandle?.timestamp, pnl, balanceAfter: finalBalance, status: 'Closed' };
      finalTrades = [...trades, finalTrade];
    }

    const totalReturn = ((finalBalance - config.initialBalance) / config.initialBalance) * 100;
    
    // 이 부분은 App.jsx로 전달될 최종 결과 데이터입니다. 필요에 따라 내용을 채워주세요.
    onEndGame({
      initialBalance: config.initialBalance,
      finalBalance,
      totalReturn,
      totalTrades: finalTrades.length,
      maxDrawdown: 0, // MDD 계산 로직은 추가 구현이 필요합니다.
      trades: finalTrades,
      tradingStartTime,
      tradingEndTime,
      coinSymbol: config.selectedCoin,
      timeframe: currentTimeframe?.label || config.selectedTimeframe,
    });
  };

  const openPosition = (type, quantity) => {
    if (!currentPrice || currentPrice <= 0 || quantity <= 0) return;

    const positionValue = currentPrice * quantity;
    const margin = positionValue / leverage;
    const fee = positionValue * 0.0005;

    if (balance < margin + fee) {
      alert('증거금이 부족합니다.');
      return;
    }

    if (!position) {
      // --- 새 포지션 진입 ---
      let liqPrice;
      const maintenanceMarginRatio = 0.005; // 유지 증거금 비율 (BTC 기준 0.5%)
      
      if (marginType === 'isolated') {
        if (type === 'long') {
          liqPrice = currentPrice * (1 - (1 / leverage) + maintenanceMarginRatio);
        } else {
          liqPrice = currentPrice * (1 + (1 / leverage) - maintenanceMarginRatio);
        }
      } else { // cross
        if (type === 'long') {
          liqPrice = currentPrice - ((margin + balance) / quantity);
        } else {
          liqPrice = currentPrice + ((margin + balance) / quantity);
        }
      }
      setLiquidationPrice(liqPrice);
      
      setPosition({
        type,
        totalQuantity: quantity,
        avgPrice: currentPrice,
        entryTimestamp: currentCandle?.timestamp,
        trades: [{ quantity, price: currentPrice }],
        leverage,
        margin,
        liquidationPrice: liqPrice,
        marginType,
        entryIndex: currentIndex,
      });

    } else if (position.type === type) {
      // --- 기존 포지션에 추가 (물타기) ---
      const newTotalQuantity = position.totalQuantity + quantity;
      const newAvgPrice = ((position.avgPrice * position.totalQuantity) + (currentPrice * quantity)) / newTotalQuantity;
      const newTotalMargin = position.margin + margin;
      
      let newLiqPrice;
      const maintenanceMarginRatio = 0.005;

      // --- BUG FIX START: 숏 포지션 청산가 계산 로직 추가 ---
      if (marginType === 'isolated') {
        if (type === 'long') {
          newLiqPrice = newAvgPrice * (1 - (1 / leverage) + maintenanceMarginRatio);
        } else { // 'short'
          newLiqPrice = newAvgPrice * (1 + (1 / leverage) - maintenanceMarginRatio);
        }
      } else { // cross
        const availableBalanceForLiq = balance; // 현재 거래의 증거금이 차감되기 전 잔고
        if (type === 'long') {
          newLiqPrice = newAvgPrice - ((newTotalMargin + availableBalanceForLiq) / newTotalQuantity);
        } else { // 'short'
          newLiqPrice = newAvgPrice + ((newTotalMargin + availableBalanceForLiq) / newTotalQuantity);
        }
      }
      // --- BUG FIX END ---

      setLiquidationPrice(newLiqPrice);

      setPosition({
        ...position,
        totalQuantity: newTotalQuantity,
        avgPrice: newAvgPrice,
        margin: newTotalMargin,
        liquidationPrice: newLiqPrice,
        trades: [...position.trades, { quantity, price: currentPrice }]
      });

    } else {
      alert('반대 포지션을 잡으려면 현재 포지션을 먼저 청산해야 합니다.');
      return;
    }
    
    setBalance(prev => prev - margin - fee);
  };

  const closePosition = (closeQuantity) => {
    if (!position || closeQuantity <= 0 || closeQuantity > position.totalQuantity || !currentPrice || currentPrice <= 0) return;
    
    const pnl = position.type === 'long' 
      ? (currentPrice - position.avgPrice) * closeQuantity
      : (position.avgPrice - currentPrice) * closeQuantity;

    const closeValue = currentPrice * closeQuantity;
    const fee = closeValue * 0.0005;
    
    const marginToReturn = position.margin * (closeQuantity / position.totalQuantity);
    const newBalance = balance + marginToReturn + pnl - fee;
    setBalance(newBalance);
    
    const trade = { ...position, totalQuantity: closeQuantity, exitPrice: currentPrice, exitTimestamp: currentCandle?.timestamp, pnl, balanceAfter: newBalance, status: 'Closed' };
    setTrades(prev => [...prev, trade]);
    
    const remainingQuantity = position.totalQuantity - closeQuantity;
    if (remainingQuantity < 0.0001) {
      setPosition(null);
      setLiquidationPrice(null);
    } else {
      const remainingMargin = position.margin - marginToReturn;
      setPosition({
        ...position,
        totalQuantity: remainingQuantity,
        margin: remainingMargin, 
      });
    }
  };

  // useCallback으로 togglePlay 함수를 메모이제이션하여 불필요한 재생성을 방지합니다.
  const togglePlay = useCallback(() => {
    // 데이터가 유효할 때만 재생/일시정지 상태 변경
    if (isDataValid && currentPrice > 0) {
      setIsPlaying(prevIsPlaying => !prevIsPlaying);
    }
  }, [isDataValid, currentPrice]); // isDataValid와 currentPrice가 변경될 때만 함수를 재생성

  // 스페이스바를 통한 재생/일시정지 기능
  useEffect(() => {
    const handleKeyDown = (event) => {
      // 입력 필드에 포커스가 있을 때는 스페이스바 이벤트를 무시
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }

      // 스페이스바를 눌렀을 때
      if (event.code === 'Space') {
        event.preventDefault(); // 스크롤 등 기본 동작 방지
        togglePlay(); // 재생/일시정지 함수 호출
      }
    };

    // 컴포넌트가 마운트될 때 이벤트 리스너 추가
    window.addEventListener('keydown', handleKeyDown);

    // 컴포넌트가 언마운트될 때 이벤트 리스너 제거
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay]); // 최적화된 togglePlay 함수를 의존성 배열에 추가

  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
  };

  const formatPrice = (price) => {
    if (!price || price <= 0) return '$0.00';
    if (config.selectedCoin === 'ADA') return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  if (gameEndedRef.current) return null;
  
  if (!isDataValid) {
    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <div className="card text-center">
                <p className="text-lg font-bold">데이터를 불러오는 중입니다...</p>
                <p className="text-sm text-gray-400">잠시만 기다려주세요.</p>
            </div>
        </div>
    );
  }


  return (
    <div className="grid gap-4" style={{ height: '100vh', gridTemplateRows: 'auto auto 1fr' }}>
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <TrendingUp className="text-green" />
          {config.selectedCoin} 트레이딩 ({currentTimeframe?.label || config.selectedTimeframe})
        </h1>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold">
            <Zap size={16} className="text-yellow" />
            <span>레버리지: {leverage}x</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span>{remainingCandles} 캔들 남음</span>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign size={16} />
            <span className="font-bold">{formatPrice(balance)}</span>
          </div>
        </div>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateRows: '3fr 1fr', gap: '16px', overflow: 'hidden' }}>
            <div className="card" style={{ overflow: 'auto' }}>
                <Chart 
                    data={chartData}
                    currentPrice={currentPrice}
                    coinSymbol={config.selectedCoin}
                    timeframe={currentTimeframe?.label || config.selectedTimeframe}
                    position={position}
                />
            </div>
            <div className="card" style={{ overflow: 'auto' }}>
                <PositionInfo
                    position={position}
                    currentPrice={currentPrice}
                    trades={trades}
                    coinSymbol={config.selectedCoin}
                />
            </div>
        </div>
        <div className="card" style={{ overflow: 'auto' }}>
            <TradingPanel
                currentPrice={currentPrice}
                balance={balance}
                position={position}
                onOpenPosition={openPosition}
                onClosePosition={closePosition}
                isPlaying={isPlaying}
                onTogglePlay={togglePlay}
                playbackSpeed={playbackSpeed}
                onChangeSpeed={changeSpeed}
                coinSymbol={config.selectedCoin}
                leverage={leverage}
                onLeverageChange={setLeverage}
                marginType={marginType}
                onMarginTypeChange={setMarginType}
            />
        </div>
    </div>
    </div>
  );
};

export default TradingScreen;