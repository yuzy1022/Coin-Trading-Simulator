import React from 'react';
import { AlertTriangle, ChevronsRight } from 'lucide-react';

const PositionInfo = ({ position, currentPrice, trades, coinSymbol = 'BTC' }) => {
  // --- Helper Functions ---
  const calculatePnL = () => {
    if (!position) return 0;
    
    return position.type === 'long' 
      ? (currentPrice - position.avgPrice) * position.totalQuantity
      : (position.avgPrice - currentPrice) * position.totalQuantity;
  };

  const formatPrice = (price) => {
    if (price === undefined || price === null) return '$0.00';
    if (coinSymbol === 'ADA') {
      return `$${price.toFixed(4)}`;
    }
    return `$${price.toFixed(2)}`;
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // --- Logic Variables ---
  const pnl = calculatePnL();
  const positionValue = position ? position.avgPrice * position.totalQuantity : 0;
  // 수익률(ROE) 계산
  const roe = position ? (pnl / position.margin) * 100 : 0;

  return (
    <div className="card">
      <h3 className="font-bold mb-4">포지션 정보</h3>
      
      {position ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between">
            <span>타입:</span>
            <span className={position.type === 'long' ? 'text-green' : 'text-red'}>
              {position.type === 'long' ? '롱 (매수)' : '숏 (매도)'}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>총 수량:</span>
            <span>{position.totalQuantity.toFixed(4)}</span>
          </div>
          
          <div className="flex justify-between">
            <span>평균 단가:</span>
            <span>{formatPrice(position.avgPrice)}</span>
          </div>
          
          <div className="flex justify-between">
            <span>현재가:</span>
            <span>{formatPrice(currentPrice)}</span>
          </div>
          
          <div className="flex justify-between">
            <span>포지션 가치:</span>
            <span>{formatPrice(positionValue)}</span>
          </div>

          <div className="flex justify-between">
            <span className="flex items-center gap-1">
              <ChevronsRight size={14} />
              마진 모드:
            </span>
            <span className="font-bold">
              {position.marginType === 'isolated' ? '격리' : '교차'}
            </span>
          </div>

          <div className="flex justify-between">
            <span>레버리지:</span>
            <span className="font-bold">{position.leverage}x</span>
          </div>

          <div className="flex justify-between">
            <span>사용 증거금:</span>
            <span>{formatPrice(position.margin)}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="flex items-center gap-1">
              <AlertTriangle size={14} className="text-red" />
              청산 예정가:
            </span>
            <span className="font-bold text-red">
              {formatPrice(position.liquidationPrice)}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span>평가손익 (ROE %):</span>
            <span className={pnl >= 0 ? 'text-green' : 'text-red'}>
              {formatPrice(pnl)} ({roe >= 0 ? '+' : ''}{roe.toFixed(2)}%)
            </span>
          </div>

          {position.entryTimestamp && (
            <div className="flex justify-between text-sm" style={{ color: '#9ca3af' }}>
              <span>진입 시점:</span>
              <span>
                {formatDateTime(position.entryTimestamp)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: '#9ca3af' }}>현재 포지션이 없습니다</p>
      )}

      <div className="mt-4">
        <h4 className="font-bold mb-2">거래 내역</h4>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {trades.length === 0 ? (
            <p className="text-sm" style={{ color: '#9ca3af' }}>거래 내역이 없습니다</p>
          ) : (
            trades.slice().reverse().map((trade, index) => {
              const tradePositionValue = trade.avgPrice * trade.totalQuantity;
              const tradeRoe = trade.margin ? (trade.pnl / trade.margin) * 100 : 0;
              return (
                <div key={index} className="card mb-2" style={{ background: '#0f172a', padding: '8px' }}>
                  <div className="flex justify-between text-sm">
                    <span className={trade.type === 'long' ? 'text-green' : 'text-red'}>
                      {trade.status === 'Liquidation' ? '❌ 청산' : (trade.type === 'long' ? '롱' : '숏')} 
                      ({trade.totalQuantity.toFixed(4)})
                    </span>
                    <span className={trade.pnl >= 0 ? 'text-green' : 'text-red'}>
                      {formatPrice(trade.pnl)} ({tradeRoe >= 0 ? '+' : ''}{tradeRoe.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="text-xs" style={{ color: '#9ca3af' }}>
                    평균: {formatPrice(trade.avgPrice)} → {formatPrice(trade.exitPrice)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default PositionInfo;