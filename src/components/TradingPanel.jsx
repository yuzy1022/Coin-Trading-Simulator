import React, { useState, useEffect } from 'react';
import { Play, Pause, TrendingUp, TrendingDown, Gauge, X, Zap, ChevronsRight } from 'lucide-react';

const TradingPanel = ({ 
  currentPrice, 
  balance, 
  position, 
  onOpenPosition, 
  onClosePosition,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onChangeSpeed,
  coinSymbol = 'BTC',
  leverage,
  onLeverageChange,
  marginType,
  onMarginTypeChange,
}) => {
  // --- 포지션 오픈 관련 state ---
  const [quantityPercentage, setQuantityPercentage] = useState(10);
  const [orderQuantity, setOrderQuantity] = useState('');
  
  // --- 포지션 청산 관련 state ---
  const [closePercentage, setClosePercentage] = useState(100);
  const [customCloseQuantity, setCustomCloseQuantity] = useState('');

  const validCurrentPrice = currentPrice && currentPrice > 0 ? currentPrice : 1;
  const maxUsableMargin = balance / (1 + leverage * 0.0005);
  const maxQuantity = (maxUsableMargin * leverage) / validCurrentPrice;

  const calculateQuantityFromPercentage = (percentage) => {
    if (!validCurrentPrice || !balance || balance <= 0) return 0;
    const marginToUse = maxUsableMargin * (percentage / 100);
    const positionValue = marginToUse * leverage;
    const calculatedQty = positionValue / validCurrentPrice;
    return Math.floor(calculatedQty * 10000) / 10000;
  };

  // 컴포넌트 로드 또는 주요 값 변경 시 초기 수량 설정
  useEffect(() => {
    const initialQuantity = calculateQuantityFromPercentage(quantityPercentage);
    setOrderQuantity(initialQuantity > 0 ? initialQuantity.toString() : '');
  }, [balance, currentPrice, leverage, maxQuantity]);

  // --- 추가된 부분: 포지션 보유 상태가 변경될 때 청산 패널의 값을 초기화 ---
  useEffect(() => {
    if (position && position.totalQuantity > 0) {
      // 포지션이 생기면, 청산 슬라이더와 입력창을 100%로 초기화
      setClosePercentage(100);
      setCustomCloseQuantity(position.totalQuantity.toFixed(4));
    } else {
      // 포지션이 없으면 다시 기본값으로 리셋
      setClosePercentage(100);
      setCustomCloseQuantity('');
    }
  }, [position]); // 'position' 객체가 변경될 때마다 실행

  const quantityAsNumber = parseFloat(orderQuantity) || 0;
  const positionValue = quantityAsNumber * validCurrentPrice;
  const marginCost = positionValue / leverage;
  const fee = positionValue * 0.0005;

  // --- 포지션 오픈 핸들러 ---
  const handleLong = () => {
    if (quantityAsNumber > 0 && quantityAsNumber <= maxQuantity && validCurrentPrice > 0) {
      if (!position || position.type === 'long') {
        onOpenPosition('long', quantityAsNumber);
      }
    }
  };
  const handleShort = () => {
    if (quantityAsNumber > 0 && quantityAsNumber <= maxQuantity && validCurrentPrice > 0) {
      if (!position || position.type === 'short') {
        onOpenPosition('short', quantityAsNumber);
      }
    }
  };
  const handlePercentageChange = (e) => {
    const percentage = Number(e.target.value);
    setQuantityPercentage(percentage);
    const newQuantity = calculateQuantityFromPercentage(percentage);
    setOrderQuantity(newQuantity > 0 ? newQuantity.toFixed(4) : '');
  };
  const handleQuantityChange = (e) => {
    const newQuantityStr = e.target.value;
    setOrderQuantity(newQuantityStr);

    const newQuantityNum = parseFloat(newQuantityStr);
    if (!isNaN(newQuantityNum) && newQuantityNum > 0 && validCurrentPrice > 0) {
      const newMarginCost = (newQuantityNum * validCurrentPrice) / leverage;
      const newPercentage = Math.min(100, (newMarginCost / maxUsableMargin) * 100);
      setQuantityPercentage(newPercentage);
    } else if (newQuantityStr === '' || newQuantityNum === 0) {
      setQuantityPercentage(0);
    }
  };

  // --- 포지션 청산 핸들러 ---
	const handleClosePosition = () => {
    if (!position) return;
    
    let closeQuantity = getCloseQuantity();
    if (closeQuantity <= 0) return;

    // 만약 사용자가 100% 슬라이더를 사용했거나, 거의 전체에 가까운 수량을 입력하여
    // 남은 수량이 매우 작아지는 경우, 그냥 전체를 청산하도록 처리.
    const remainingAfterClose = position.totalQuantity - closeQuantity;
    if (remainingAfterClose > 0 && remainingAfterClose < 0.0001) {
      closeQuantity = position.totalQuantity;
    }
    
    onClosePosition(parseFloat(closeQuantity.toFixed(4))); 
  };
	
  // --- 추가된 부분: 청산 슬라이더와 입력 필드를 동기화하는 핸들러 ---
  const handleClosePercentageChange = (e) => {
    if (!position) return;
    const percentage = Number(e.target.value);
    setClosePercentage(percentage);
    const newQuantity = (position.totalQuantity * percentage) / 100;
    setCustomCloseQuantity(newQuantity.toFixed(4));
  };

  const handleCustomCloseQuantityChange = (e) => {
    if (!position) return;
    const newQuantityStr = e.target.value;
    setCustomCloseQuantity(newQuantityStr);

    const newQuantityNum = parseFloat(newQuantityStr);
    if (!isNaN(newQuantityNum) && newQuantityNum >= 0 && position.totalQuantity > 0) {
      const newPercentage = Math.min(100, (newQuantityNum / position.totalQuantity) * 100);
      setClosePercentage(newPercentage);
    } else if (newQuantityStr === '' || newQuantityNum === 0) {
      setClosePercentage(0);
    }
  };

  const canAddLong = !position || position.type === 'long';
  const canAddShort = !position || position.type === 'short';

  const formatPrice = (price) => {
    if (!price || price <= 0) return '$0.00';
    if (coinSymbol === 'ADA') {
      return `$${price.toFixed(4)}`;
    }
    return `$${price.toFixed(2)}`;
  };

  // --- 수정된 부분: 청산 수량 계산 로직 간소화 ---
  const getCloseQuantity = () => {
    if (!position) return 0;

    let calculatedQuantity = parseFloat(customCloseQuantity) || 0;
    
    // 청산 수량이 보유 수량을 넘지 않도록 제한
    calculatedQuantity = Math.min(calculatedQuantity, position.totalQuantity);
    
    if (calculatedQuantity > 0 && calculatedQuantity < 0.0001) {
      return 0.0001;
    }
    return calculatedQuantity;
  };

  const isDataLoading = !currentPrice || currentPrice <= 0;

  return (
    <div className="card">
      <h3 className="font-bold mb-4">트레이딩 패널</h3>
      
      <div className="flex flex-col gap-4">
        {/* 재생, 속도, 레버리지, 마진 모드 UI (기존과 동일) */}
        <div className="flex gap-2">
          <button
            className={`btn ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onTogglePlay}
            style={{ flex: 1 }}
            disabled={isDataLoading}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            {isPlaying ? '일시정지' : '시작'}
          </button>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Gauge size={16} />
            <label className="text-sm font-bold">재생 속도</label>
            <span className="text-sm" style={{ color: '#9ca3af' }}>
              {playbackSpeed.toFixed(1)}x
            </span>
          </div>
          <input
            type="range" min="0.1" max="3" step="0.1"
            value={playbackSpeed}
            onChange={(e) => onChangeSpeed(Number(e.target.value))}
            className="speed-slider" disabled={isDataLoading}
            style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#374151', outline: 'none', appearance: 'none', cursor: 'pointer' }}
          />
          <div className="flex justify-between text-sm mt-1" style={{ color: '#9ca3af' }}>
            <span>0.1x</span><span>1.5x</span><span>3.0x</span>
          </div>
        </div>
        {isDataLoading && (<div className="card" style={{ background: '#0f172a', padding: '12px', textAlign: 'center' }}><p className="text-sm" style={{ color: '#9ca3af' }}>데이터 로딩 중...</p></div>)}
        <div>
            <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-yellow" />
                <label className="text-sm font-bold">레버리지 설정</label>
                <span className="text-sm font-bold" style={{ color: '#f9ca24' }}>{leverage}x</span>
            </div>
            <input
                type="range" min="1" max="100" step="1"
                value={leverage}
                onChange={(e) => onLeverageChange(Number(e.target.value))}
                disabled={!!position}
                className="speed-slider"
                style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#374151', outline: 'none', appearance: 'none', cursor: 'pointer' }}
            />
            <div className="flex justify-between text-sm mt-1" style={{ color: '#9ca3af' }}>
                <span>1x</span><span>50x</span><span>100x</span>
            </div>
            {position && <p className="text-xs mt-1" style={{color: '#9ca3af'}}>포지션 보유 중에는 레버리지를 변경할 수 없습니다.</p>}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ChevronsRight size={16} /><label className="text-sm font-bold">마진 모드</label>
          </div>
          <div className="grid grid-2 gap-2">
            <button className={`btn-sm ${marginType === 'isolated' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onMarginTypeChange('isolated')} disabled={!!position}>격리</button>
            <button className={`btn-sm ${marginType === 'cross' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => onMarginTypeChange('cross')} disabled={!!position}>교차</button>
          </div>
          {position && <p className="text-xs mt-1" style={{color: '#9ca3af'}}>포지션 보유 중에는 마진 모드를 변경할 수 없습니다.</p>}
        </div>

        {/* --- 포지션 오픈 UI (수정됨) --- */}
        <div>
          <label className="block mb-2 text-sm font-bold">포지션 크기</label>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">가용 증거금 비율</span>
              <span className="text-sm font-bold">{Math.round(quantityPercentage)}%</span>
            </div>
            <input
              type="range" min="0" max="100" step="1"
              value={quantityPercentage}
              onChange={handlePercentageChange}
              style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'linear-gradient(to right, #10b981 0%, #f59e0b 50%, #ef4444 100%)', outline: 'none', appearance: 'none', cursor: 'pointer' }}
              disabled={isDataLoading}
            />
            <div className="flex justify-between text-sm mt-1" style={{ color: '#9ca3af' }}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
          <div>
            <label className="block mb-2 text-sm">또는 직접 입력</label>
            <input
              type="number"
              className="input"
              style={{ width: '100%' }}
              value={isDataLoading ? '' : orderQuantity}
              onChange={handleQuantityChange}
              step="0.0001" min="0" max={maxQuantity.toFixed(4)}
              disabled={isDataLoading}
              placeholder={isDataLoading ? "로딩 중..." : "수량 입력"}
            />
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>최대: {isDataLoading ? '0.0000' : maxQuantity.toFixed(4)}</p>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>포지션 가치: {formatPrice(positionValue)}</p>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>증거금: {formatPrice(marginCost)} (예상 수수료: {formatPrice(fee)})</p>
          </div>
        </div>
        
        <div className="grid grid-2 gap-2">
          <button className="btn btn-success" onClick={handleLong} disabled={!canAddLong || quantityAsNumber <= 0 || quantityAsNumber > maxQuantity || isDataLoading} style={{ opacity: (!canAddLong || isDataLoading) ? 0.5 : 1 }}>
            <TrendingUp size={16} />{position?.type === 'long' ? '롱 추가' : '롱 (매수)'}
          </button>
          <button className="btn btn-danger" onClick={handleShort} disabled={!canAddShort || quantityAsNumber <= 0 || quantityAsNumber > maxQuantity || isDataLoading} style={{ opacity: (!canAddShort || isDataLoading) ? 0.5 : 1 }}>
            <TrendingDown size={16} />{position?.type === 'short' ? '숏 추가' : '숏 (매도)'}
          </button>
        </div>

        {/* --- 포지션 청산 UI (수정됨) --- */}
        {position && (
          <div className="card" style={{ background: '#0f172a', padding: '12px' }}>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><X size={16} />포지션 청산</h4>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block mb-2 text-sm">청산 비율</label>
                <input
                  type="range" min="0" max="100" step="1"
                  value={closePercentage}
                  onChange={handleClosePercentageChange} // 수정된 핸들러
                  style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#374151', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                  disabled={isDataLoading}
                />
                <div className="flex justify-between text-sm mt-1" style={{ color: '#9ca3af' }}>
                  <span>0%</span>
                  <span className="font-bold">{Math.round(closePercentage)}%</span>
                  <span>100%</span>
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm">또는 직접 입력</label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%' }}
                  value={customCloseQuantity}
                  onChange={handleCustomCloseQuantityChange} // 수정된 핸들러
                  step="0.0001" min="0" max={position.totalQuantity.toFixed(4)}
                  placeholder={`최대: ${position.totalQuantity.toFixed(4)}`}
                  disabled={isDataLoading}
                />
              </div>
              <div className="text-sm" style={{ color: '#9ca3af' }}>
                청산 수량: {getCloseQuantity().toFixed(4)} / {position.totalQuantity.toFixed(4)}
              </div>
              <button
                className="btn btn-secondary"
                onClick={handleClosePosition}
                style={{ width: '100%' }}
                disabled={getCloseQuantity() <= 0 || isDataLoading}
              >
                {/* 수정된 부분: 청산 버튼 텍스트 로직 개선 */}
                {Math.abs(getCloseQuantity() - position.totalQuantity) < 0.0001
                  ? '전체 청산'
                  : '부분 청산'
                }
              </button>
            </div>
          </div>
        )}

        <div className="card" style={{ background: '#0f172a' }}>
          <div className="text-sm" style={{ color: '#9ca3af' }}>현재 잔고</div>
          <div className="text-lg font-bold">{formatPrice(balance)}</div>
        </div>
      </div>
    </div>
  );
};

export default TradingPanel;