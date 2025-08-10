// TradingScreen.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Chart from './Chart';
import TradingPanel from './TradingPanel';
import PositionInfo from './PositionInfo';
import { TrendingUp, Clock, DollarSign, Zap } from 'lucide-react';
import { getAvailableTimeframes } from '../utils/binanceApi';

const TradingScreen = ({ config, data, onEndGame, startIndex }) => {
  const [currentIndex, setCurrentIndex] = useState(startIndex - 1);
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
  
  const tradingStartIndex = startIndex;
  const tradingProgress = Math.max(0, currentIndex - tradingStartIndex + 1);
  const remainingCandles = Math.max(0, config.tradingPeriod - tradingProgress);
  const progress = (tradingProgress / config.tradingPeriod) * 100;

  const timeframes = getAvailableTimeframes();
  const currentTimeframe = timeframes.find(t => t.value === config.selectedTimeframe);
  const tradingStartTime = data && data[tradingStartIndex - 1] ? data[tradingStartIndex - 1].timestamp : null;

	const truncate = (num, decimals) => {
	  const factor = Math.pow(10, decimals);
	  return Math.floor(num * factor) / factor;
	};

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

    const actualEndTime = currentCandle ? currentCandle.timestamp : null;
    
    const totalReturn = ((finalBalance - config.initialBalance) / config.initialBalance) * 100;
    
    onEndGame({
      initialBalance: config.initialBalance,
      finalBalance,
      totalReturn,
      totalTrades: finalTrades.length,
      maxDrawdown: 0,
      trades: finalTrades,
      tradingStartTime,
      tradingEndTime: actualEndTime,
      coinSymbol: config.selectedCoin,
      timeframe: currentTimeframe?.label || config.selectedTimeframe,
    });
  };

  const openPosition = (type, quantity) => {
    const cleanQuantity = truncate(quantity, 4);

    if (!currentPrice || currentPrice <= 0 || cleanQuantity <= 0) return;

    const positionValue = currentPrice * cleanQuantity;
    const margin = positionValue / leverage;
    const fee = positionValue * 0.0005;

    if (balance < margin + fee) {
      alert('증거금이 부족합니다.');
      return;
    }

    if (!position) {
      let liqPrice;
			const maintenanceMarginRatio = 0.005;
      
      if (marginType === 'isolated') {
        if (type === 'long') {
          liqPrice = currentPrice * (1 - (1 / leverage) + maintenanceMarginRatio);
        } else {
          liqPrice = currentPrice * (1 + (1 / leverage) - maintenanceMarginRatio);
        }
      } else { // cross
        if (type === 'long') {
          liqPrice = currentPrice - ((margin + balance) / cleanQuantity);
        } else {
          liqPrice = currentPrice + ((margin + balance) / cleanQuantity);
        }
      }
      setLiquidationPrice(liqPrice);

      setPosition({
        type,
        totalQuantity: cleanQuantity,
        avgPrice: currentPrice,
        entryTimestamp: currentCandle?.timestamp,
        trades: [{ quantity: cleanQuantity, price: currentPrice }],
        leverage, margin, liquidationPrice: liqPrice, marginType, entryIndex: currentIndex,
      });

    } else if (position.type === type) {
      const newTotalQuantity = truncate(position.totalQuantity + cleanQuantity, 4);
      const newAvgPrice = ((position.avgPrice * position.totalQuantity) + (currentPrice * cleanQuantity)) / newTotalQuantity;
      const newTotalMargin = position.margin + margin;
      
      let newLiqPrice;
			const maintenanceMarginRatio = 0.005;

      if (marginType === 'isolated') {
        if (type === 'long') {
          newLiqPrice = newAvgPrice * (1 - (1 / leverage) + maintenanceMarginRatio);
        } else { // 'short'
          newLiqPrice = newAvgPrice * (1 + (1 / leverage) - maintenanceMarginRatio);
        }
      } else { // cross
        const availableBalanceForLiq = balance;
        if (type === 'long') {
          newLiqPrice = newAvgPrice - ((newTotalMargin + availableBalanceForLiq) / newTotalQuantity);
        } else { // 'short'
          newLiqPrice = newAvgPrice + ((newTotalMargin + availableBalanceForLiq) / newTotalQuantity);
        }
      }

      setLiquidationPrice(newLiqPrice);

      setPosition({
        ...position,
        totalQuantity: newTotalQuantity,
        avgPrice: newAvgPrice,
        margin: newTotalMargin,
        liquidationPrice: newLiqPrice,
        trades: [...position.trades, { quantity: cleanQuantity, price: currentPrice }]
      });

    } else {
      alert('반대 포지션을 잡으려면 현재 포지션을 먼저 청산해야 합니다.');
      return;
    }
    
    setBalance(prev => prev - margin - fee);
  };

  const closePosition = (closeQuantity) => {
    if (!position || closeQuantity <= 0 || (closeQuantity - position.totalQuantity > 0.00000001) || !currentPrice || currentPrice <= 0) return;
    
    const finalCloseQuantity = Math.min(closeQuantity, position.totalQuantity);

    const pnl = position.type === 'long' 
      ? (currentPrice - position.avgPrice) * finalCloseQuantity
      : (position.avgPrice - currentPrice) * finalCloseQuantity;

    const closeValue = currentPrice * finalCloseQuantity;
    const fee = closeValue * 0.0005;
    
    const marginToReturn = position.totalQuantity > 0 
      ? position.margin * (finalCloseQuantity / position.totalQuantity)
      : position.margin;

    const newBalance = balance + marginToReturn + pnl - fee;
    setBalance(newBalance);
    
    const trade = { ...position, totalQuantity: finalCloseQuantity, exitPrice: currentPrice, exitTimestamp: currentCandle?.timestamp, pnl, balanceAfter: newBalance, status: 'Closed' };
    setTrades(prev => [...prev, trade]);
    
    const remainingQuantity = parseFloat((position.totalQuantity - finalCloseQuantity).toPrecision(12));
    
    if (remainingQuantity < 0.00001) {
      setPosition(null);
      setLiquidationPrice(null);
    } else {
      const remainingMargin = parseFloat((position.margin - marginToReturn).toPrecision(12));
      setPosition({
        ...position,
        totalQuantity: remainingQuantity,
        margin: remainingMargin, 
      });
    }
  };

  const togglePlay = useCallback(() => {
    if (isDataValid && currentPrice > 0) {
      setIsPlaying(prevIsPlaying => !prevIsPlaying);
    }
  }, [isDataValid, currentPrice]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }
      if (event.code === 'Space') {
        event.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay]);

  useEffect(() => {
    if (gameEndedRef.current || position || !currentPrice || currentPrice <= 0) {
      return;
    }

    const minPositionValue = currentPrice * 0.0001;
    const minMarginRequired = minPositionValue / leverage;
    const minFee = minPositionValue * 0.0005;
	
    if (balance < (minMarginRequired + minFee)) {
      gameEndedRef.current = true;
      setTimeout(() => {
        alert('잔고가 부족하여 더 이상 거래를 진행할 수 없습니다. 게임을 종료합니다.');
        calculateResults();
      }, 100);
    }
  }, [balance, position, currentPrice, leverage, calculateResults]);

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
    <div className="trading-screen-container">
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

      <div className="trading-screen-grid-areas">
        <div className="card chart-area" style={{ overflow: 'auto' }}>
          <Chart 
            data={chartData}
            currentPrice={currentPrice}
            coinSymbol={config.selectedCoin}
            timeframe={currentTimeframe?.label || config.selectedTimeframe}
            position={position}
            timeframeMs={currentTimeframe?.ms}
          />
        </div>
        <div className="card trading-panel-area" style={{ overflow: 'auto' }}>
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
        <div className="card position-info-area" style={{ overflow: 'auto' }}>
          <PositionInfo
            position={position}
            currentPrice={currentPrice}
            trades={trades}
            coinSymbol={config.selectedCoin}
          />
        </div>
      </div>
    </div>
  );
};

export default TradingScreen;