// TradingScreen.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Chart from './Chart';
import TradingPanel from './TradingPanel';
import PositionInfo from './PositionInfo';
import { TrendingUp, Clock, DollarSign, Zap } from 'lucide-react'; // Zap 아이콘 추가
import { getAvailableTimeframes } from '../utils/binanceApi';

const TradingScreen = ({ config, data, onEndGame }) => {
  const [currentIndex, setCurrentIndex] = useState(999);
  const [balance, setBalance] = useState(config.initialBalance);
  const [position, setPosition] = useState(null);
  const [trades, setTrades] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [leverage, setLeverage] = useState(1); // 레버리지 상태 추가
  const [liquidationPrice, setLiquidationPrice] = useState(null); // 청산 가격 상태 추가
  const [marginType, setMarginType] = useState('isolated'); // 마진 모드 상태 추가 (기본값: 격리)
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

  // 자동 재생 로직
  useEffect(() => {
    if (isPlaying && remainingCandles > 0 && isDataValid && currentPrice > 0) {
      const interval = 100 / playbackSpeed;
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
  
  // *** 청산 확인 로직 ***
  useEffect(() => {
    if (position && currentCandle) {
      // 포지션에 진입한 캔들에서는 청산 검사를 건너뜁니다.
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

  // 게임 종료 시 포지션 자동 청산 및 결과 계산
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
        // 격리 모드: 포지션 증거금만 손실
        pnl = -position.margin;
        // finalBalance는 이미 증거금이 차감된 상태이므로 그대로 유지
    } else { // cross
        // 교차 모드: 계좌 잔고 전체 손실
        pnl = -(position.margin + balance);
        finalBalance = 0; // 잔고 0 처리
    }
    
    setBalance(finalBalance); // 업데이트된 잔고 설정

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
    }, 100); // 0.1초 지연
  };

  const calculateResults = () => {
    let finalBalance = balance;
    let finalTrades = [...trades];
    
    if (position && currentPrice > 0) {
      const pnl = position.type === 'long' 
        ? (currentPrice - position.avgPrice) * position.totalQuantity
        : (position.avgPrice - currentPrice) * position.totalQuantity;
      
      const fee = currentPrice * position.totalQuantity * 0.0005;
      
      // 진입 시 사용했던 증거금을 돌려주고 손익과 수수료 적용
      finalBalance = balance + position.margin + pnl - fee;
      
      const finalTrade = {
        ...position,
        exitPrice: currentPrice,
        exitTime: currentIndex,
        exitTimestamp: currentCandle?.timestamp,
        pnl,
        balanceAfter: finalBalance,
        status: 'Closed'
      };
      
      finalTrades = [...trades, finalTrade];
    }

    const totalReturn = ((finalBalance - config.initialBalance) / config.initialBalance) * 100;
    onEndGame({
      // ... 결과 데이터
    });
  };

  // *** 포지션 진입 로직 수정 ***
  const openPosition = (type, quantity) => {
    if (!currentPrice || currentPrice <= 0 || quantity <= 0) return;

    const positionValue = currentPrice * quantity;
    const margin = positionValue / leverage;
    const fee = positionValue * 0.0005;

    if (balance < margin + fee) {
      alert('증거금이 부족합니다.');
      return;
    }

    // --- 청산가 계산 로직 수정 ---
    let liqPrice;
    if (marginType === 'isolated') {
        // 격리 마진: 포지션 증거금만으로 청산가 계산
        const maintenanceMarginRatio = 0.005; 
        if (type === 'long') {
            liqPrice = currentPrice * (1 - (1 / leverage) + maintenanceMarginRatio);
        } else {
            liqPrice = currentPrice * (1 + (1 / leverage) - maintenanceMarginRatio);
        }
    } else { // cross
        // 교차 마진: 포지션 증거금 + 사용 가능한 모든 잔고로 청산가 계산
        if (type === 'long') {
            liqPrice = currentPrice - ((margin + balance) / quantity);
        } else {
            liqPrice = currentPrice + ((margin + balance) / quantity);
        }
    }
    setLiquidationPrice(liqPrice);
    
    if (!position) {
      setPosition({
        type,
        totalQuantity: quantity,
        avgPrice: currentPrice,
        entryTimestamp: currentCandle?.timestamp,
        trades: [{ quantity, price: currentPrice }],
        leverage,
        margin,
        liquidationPrice: liqPrice,
        marginType, // 포지션 정보에 마진 모드 저장
        entryIndex: currentIndex,
      });
    } else if (position.type === type) {
      // 물타기 로직 (교차모드에서는 청산가 재계산 방식이 더 복잡하지만 시뮬레이터에서는 단순화)
      const newTotalQuantity = position.totalQuantity + quantity;
      const newAvgPrice = ((position.avgPrice * position.totalQuantity) + (currentPrice * quantity)) / newTotalQuantity;
      const newTotalMargin = position.margin + margin;
      
      let newLiqPrice;
      if (marginType === 'isolated') {
          const maintenanceMarginRatio = 0.005;
          newLiqPrice = newAvgPrice * (1 - (1 / leverage) + maintenanceMarginRatio);
      } else {
          newLiqPrice = newAvgPrice - ((newTotalMargin + (balance - margin)) / newTotalQuantity);
      }
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

  // *** 포지션 종료 로직 수정 ***
  const closePosition = (closeQuantity) => {
    if (!position || closeQuantity <= 0 || closeQuantity > position.totalQuantity || !currentPrice || currentPrice <= 0) return;
    
    const pnl = position.type === 'long' 
      ? (currentPrice - position.avgPrice) * closeQuantity
      : (position.avgPrice - currentPrice) * closeQuantity;

    const closeValue = currentPrice * closeQuantity;
    const fee = closeValue * 0.0005;
    
    // 청산하는 비율만큼 증거금을 되돌려 받음
    const marginToReturn = position.margin * (closeQuantity / position.totalQuantity);
    const newBalance = balance + marginToReturn + pnl - fee;
    setBalance(newBalance);
    
    const trade = {
      ...position,
      totalQuantity: closeQuantity,
      exitPrice: currentPrice,
      exitTimestamp: currentCandle?.timestamp,
      pnl,
      balanceAfter: newBalance,
      status: 'Closed'
    };
    setTrades(prev => [...prev, trade]);
    
    const remainingQuantity = position.totalQuantity - closeQuantity;
    if (remainingQuantity < 0.0001) {
      setPosition(null);
      setLiquidationPrice(null);
    } else {
      setPosition({
        ...position,
        totalQuantity: remainingQuantity,
        margin: position.margin * (remainingQuantity / position.totalQuantity) // 남은 증거금 업데이트
      });
    }
  };

  const togglePlay = () => {
    if (isDataValid && currentPrice > 0) {
      setIsPlaying(!isPlaying);
    }
  };

  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
  };

  const formatPrice = (price) => {
    if (!price || price <= 0) return '$0.00';
    if (config.selectedCoin === 'ADA') return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  if (gameEndedRef.current) return null;

  // ... (데이터 로딩 중 UI는 기존과 동일)

  return (
    <div className="grid gap-4" style={{ height: '100vh' }}>
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

      {/* --- 최종 수정된 레이아웃 구조 --- */}
      <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          height: 'calc(100vh - 120px)'
        }}>
        
        {/* 상단 좌측: 차트 (2칸 차지) */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <Chart 
            data={chartData}
            currentPrice={currentPrice}
            coinSymbol={config.selectedCoin}
            timeframe={currentTimeframe?.label || config.selectedTimeframe}
            position={position}
          />
        </div>
        
        {/* 상단 우측: 트레이딩 패널 (1칸 차지) */}
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
        
        {/* 하단: 포지션 정보 (3칸 전체 차지) */}
        <div className="card" style={{ gridColumn: 'span 3' }}>
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