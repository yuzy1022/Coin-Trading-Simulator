import React from 'react';
import { RotateCcw, TrendingUp, TrendingDown, Activity, DollarSign, Calendar } from 'lucide-react';

const ResultScreen = ({ results, onRestart }) => {
  const {
    initialBalance,
    finalBalance,
    totalReturn,
    totalTrades,
    maxDrawdown,
    trades,
    tradingStartTime,
    tradingEndTime,
    coinSymbol,
    timeframe
  } = results;

  const winningTrades = trades.filter(trade => trade.pnl > 0).length;
  const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0;
  const totalProfit = finalBalance - initialBalance;

  const formatPrice = (price) => {
    if (coinSymbol === 'ADA') {
      return `$${price.toFixed(4)}`;
    }
    return `$${price.toFixed(2)}`;
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateOnly = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTradingPeriod = () => {
    if (!tradingStartTime || !tradingEndTime) return '';
    
    const startDate = new Date(tradingStartTime);
    const endDate = new Date(tradingEndTime);
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) {
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      return `${diffHours}시간`;
    } else if (diffDays < 30) {
      return `${diffDays}일`;
    } else if (diffDays < 365) {
      const diffMonths = Math.ceil(diffDays / 30);
      return `${diffMonths}개월`;
    } else {
      const diffYears = Math.ceil(diffDays / 365);
      return `${diffYears}년`;
    }
  };

  return (
    <div className="flex flex-col items-center gap-4" style={{ minHeight: '100vh', justifyContent: 'center' }}>
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold mb-2">트레이딩 결과</h1>
        <p style={{ color: '#9ca3af' }}>게임이 종료되었습니다</p>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '600px' }}>
        {/* 트레이딩 기간 정보 */}
        {tradingStartTime && tradingEndTime && (
          <div className="card mb-6" style={{ background: '#0f172a', padding: '16px' }}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={20} className="text-green" />
              <h3 className="font-bold">트레이딩 기간</h3>
            </div>
            <div className="grid grid-2 gap-4 text-sm">
              <div>
                <p style={{ color: '#9ca3af' }}>시작일</p>
                <p className="font-bold">{formatDateOnly(tradingStartTime)}</p>
                <p className="text-sm" style={{ color: '#9ca3af' }}>{formatDateTime(tradingStartTime)}</p>
              </div>
              <div>
                <p style={{ color: '#9ca3af' }}>종료일</p>
                <p className="font-bold">{formatDateOnly(tradingEndTime)}</p>
                <p className="text-sm" style={{ color: '#9ca3af' }}>{formatDateTime(tradingEndTime)}</p>
              </div>
            </div>
            <div className="mt-3 text-center">
              <p style={{ color: '#9ca3af' }}>총 기간: <span className="font-bold">{getTradingPeriod()}</span></p>
              <p style={{ color: '#9ca3af' }}>코인: <span className="font-bold">{coinSymbol}</span> | 시간봉: <span className="font-bold">{timeframe}</span></p>
            </div>
          </div>
        )}

        <div className="grid grid-3 gap-4 mb-6">
          <div className="card text-center" style={{ background: '#0f172a' }}>
            <DollarSign className="mx-auto mb-2 text-green" size={24} />
            <p className="text-sm" style={{ color: '#9ca3af' }}>최종 수익률</p>
            <p className={`text-xl font-bold ${totalReturn >= 0 ? 'text-green' : 'text-red'}`}>
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
            </p>
          </div>

          <div className="card text-center" style={{ background: '#0f172a' }}>
            <TrendingUp className="mx-auto mb-2 text-green" size={24} />
            <p className="text-sm" style={{ color: '#9ca3af' }}>최종 수익금</p>
            <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green' : 'text-red'}`}>
              {totalProfit >= 0 ? '+' : ''}{formatPrice(totalProfit)}
            </p>
          </div>

          <div className="card text-center" style={{ background: '#0f172a' }}>
            <Activity className="mx-auto mb-2" size={24} />
            <p className="text-sm" style={{ color: '#9ca3af' }}>총 거래 횟수</p>
            <p className="text-xl font-bold">{totalTrades}</p>
          </div>
        </div>

        <div className="grid grid-2 gap-4 mb-6">
          <div className="flex justify-between">
            <span>초기 자산:</span>
            <span className="font-bold">{formatPrice(initialBalance)}</span>
          </div>
          
          <div className="flex justify-between">
            <span>최종 자산:</span>
            <span className="font-bold">{formatPrice(finalBalance)}</span>
          </div>
          
          <div className="flex justify-between">
            <span>승률:</span>
            <span className="font-bold">{winRate.toFixed(1)}%</span>
          </div>
          
          <div className="flex justify-between">
            <span>최대 손실률:</span>
            <span className="font-bold text-red">{maxDrawdown.toFixed(2)}%</span>
          </div>
        </div>

        {trades.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold mb-3">거래 내역</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {trades.map((trade, index) => {
                const positionSize = trade.avgPrice * trade.totalQuantity;
                return (
                  <div key={index} className="card mb-2" style={{ background: '#0f172a', padding: '12px' }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className={`font-bold ${trade.type === 'long' ? 'text-green' : 'text-red'}`}>
                          {trade.type === 'long' ? '롱' : '숏'}
                        </span>
                        <span className="text-sm ml-2" style={{ color: '#9ca3af' }}>
                          {trade.totalQuantity?.toFixed(4) || '0.0000'}
                        </span>
                      </div>
                      <span className={`font-bold ${trade.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                        {trade.pnl >= 0 ? '+' : ''}{formatPrice(trade.pnl)}
                      </span>
                    </div>
                    <div className="text-sm" style={{ color: '#9ca3af' }}>
                      진입: {formatPrice(trade.entryPrice || trade.avgPrice || 0)} → 청산: {formatPrice(trade.exitPrice || 0)}
                    </div>
                    <div className="text-sm" style={{ color: '#9ca3af' }}>
                      포지션 사이즈: {formatPrice(positionSize)}
                    </div>
                    {trade.entryTimestamp && trade.exitTimestamp && (
                      <div className="text-sm" style={{ color: '#9ca3af' }}>
                        진입: {formatDateTime(trade.entryTimestamp)}
                      </div>
                    )}
                    {trade.exitTimestamp && (
                      <div className="text-sm" style={{ color: '#9ca3af' }}>
                        청산: {formatDateTime(trade.exitTimestamp)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button 
          className="btn btn-primary" 
          style={{ width: '100%' }}
          onClick={onRestart}
        >
          <RotateCcw size={20} />
          다시 시작
        </button>
      </div>
    </div>
  );
};

export default ResultScreen;
