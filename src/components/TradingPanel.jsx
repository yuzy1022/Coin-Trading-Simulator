import React, { useState } from 'react';
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
  leverage, // props 추가
  onLeverageChange, // props 추가
  marginType, // props 추가
  onMarginTypeChange, // props 추가
}) => {
  const [quantityPercentage, setQuantityPercentage] = useState(10);
  const [closePercentage, setClosePercentage] = useState(100);
  const [customCloseQuantity, setCustomCloseQuantity] = useState('');

  // currentPrice가 유효하지 않으면 기본값 사용
  const validCurrentPrice = currentPrice && currentPrice > 0 ? currentPrice : 1;

  // 1. 수수료를 고려하여 실제 사용 가능한 '최대 증거금'을 계산합니다.
  // 공식: 최대 증거금 = 현재 잔고 / (1 + 레버리지 * 수수료율)
  const maxUsableMargin = balance / (1 + leverage * 0.0005);
  
  // 2. 최대 가능 수량은 이 '최대 증거금'을 기준으로 계산합니다.
  const maxQuantity = (maxUsableMargin * leverage) / validCurrentPrice;

  // 3. 슬라이더의 퍼센트에 따라 포지션 수량을 계산하는 함수를 수정합니다.
  const calculateQuantityFromPercentage = (percentage) => {
    if (!validCurrentPrice || !balance || balance <= 0) return 0;
    
    // 사용하려는 증거금 = (실제 사용 가능한 최대 증거금) * (선택한 비율 / 100)
    const marginToUse = maxUsableMargin * (percentage / 100);
    const positionValue = marginToUse * leverage;
    const calculatedQty = positionValue / validCurrentPrice;

    // 소수점 4자리 이하 절사
    return Math.floor(calculatedQty * 10000) / 10000;
  };

  const quantity = calculateQuantityFromPercentage(quantityPercentage);
  const positionValue = quantity * validCurrentPrice;
  // 증거금 비용 표시는 실제 사용할 증거금(positionValue / leverage)으로 보여줍니다.
  const marginCost = positionValue / leverage;
  const fee = positionValue * 0.0005;

  const handleLong = () => {
    if (quantity > 0 && quantity <= maxQuantity && validCurrentPrice > 0) {
      if (!position || position.type === 'long') {
        onOpenPosition('long', quantity);
      }
    }
  };

  const handleShort = () => {
    if (quantity > 0 && quantity <= maxQuantity && validCurrentPrice > 0) {
      if (!position || position.type === 'short') {
        onOpenPosition('short', quantity);
      }
    }
  };

	const handleClosePosition = () => {
    if (!position) return;
    
    let closeQuantity;

		// 남은 포지션이 0.0001 이하로 매우 작을 경우, 전체 수량을 청산 수량으로 설정
    if (position.totalQuantity <= 0.0001) {
        closeQuantity = position.totalQuantity;
    } 
		// 사용자가 직접 청산 수량을 입력한 경우
    else if (customCloseQuantity && parseFloat(customCloseQuantity) > 0) {
      // 사용자 정의 수량이 있고 유효한 경우, 현재 보유 수량을 초과하지 않도록 보정
      closeQuantity = Math.min(parseFloat(customCloseQuantity), position.totalQuantity);
    } else if (closePercentage === 100) {
      // 청산 비율이 100%일 경우, 보유 수량 전체를 청산
      closeQuantity = position.totalQuantity;
    } else {
      // 그 외의 경우 (부분 청산), 계산된 비율만큼 청산
      closeQuantity = (position.totalQuantity * closePercentage) / 100;
    }
    console.log(position)
		console.log(closeQuantity)
    // 최종 청산 수량을 소수점 4자리로 반올림하여 전달 (필요시)
    onClosePosition(parseFloat(closeQuantity.toFixed(4))); 
    
    // 청산 후 입력값 초기화
    setCustomCloseQuantity('');
    if (closePercentage === 100) {
      setClosePercentage(100);
    }
  };
	
  // const handleClosePosition = () => {
  //   if (!position) return;
    
  //   let closeQuantity;
  //   if (customCloseQuantity && parseFloat(customCloseQuantity) > 0) {
  //     closeQuantity = Math.min(parseFloat(customCloseQuantity), position.totalQuantity);
  //   } else {
  //     closeQuantity = (position.totalQuantity * closePercentage) / 100;
  //   }
    
  //   onClosePosition(closeQuantity);
    
  //   // 청산 후 입력값 초기화
  //   setCustomCloseQuantity('');
  //   if (closePercentage === 100) {
  //     setClosePercentage(100);
  //   }
  // };

  const canAddLong = !position || position.type === 'long';
  const canAddShort = !position || position.type === 'short';

  const formatPrice = (price) => {
    if (!price || price <= 0) return '$0.00';
    if (coinSymbol === 'ADA') {
      return `$${price.toFixed(4)}`;
    }
    return `$${price.toFixed(2)}`;
  };

const getCloseQuantity = () => {
    if (!position) return 0;

    let calculatedQuantity;
    if (customCloseQuantity && parseFloat(customCloseQuantity) > 0) {
      calculatedQuantity = Math.min(parseFloat(customCloseQuantity), position.totalQuantity);
    } else {
      calculatedQuantity = (position.totalQuantity * closePercentage) / 100;
    }
    
    // 계산된 수량이 0.0001보다 작으면 0.0001로 고정
    if (calculatedQuantity > 0 && calculatedQuantity < 0.0001) {
      return 0.0001;
    }

    return calculatedQuantity;
  };

  // 데이터가 로딩 중일 때 비활성화
  const isDataLoading = !currentPrice || currentPrice <= 0;

  return (
    <div className="card">
      <h3 className="font-bold mb-4">트레이딩 패널</h3>
      
      <div className="flex flex-col gap-4">
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
            type="range"
            min="0.1"
            max="3"
            step="0.1"
            value={playbackSpeed}
            onChange={(e) => onChangeSpeed(Number(e.target.value))}
            style={{ 
              width: '100%',
              height: '6px',
              borderRadius: '3px',
              background: '#374151',
              outline: 'none',
              appearance: 'none',
              cursor: 'pointer'
            }}
            className="speed-slider"
            disabled={isDataLoading}
          />
          <div className="flex justify-between text-sm mt-1" style={{ color: '#9ca3af' }}>
            <span>0.1x</span>
            <span>1.5x</span>
            <span>3.0x</span>
          </div>
        </div>

        {isDataLoading && (
          <div className="card" style={{ background: '#0f172a', padding: '12px', textAlign: 'center' }}>
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              데이터 로딩 중...
            </p>
          </div>
        )}

        <div>
            <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-yellow" />
                <label className="text-sm font-bold">레버리지 설정</label>
                <span className="text-sm font-bold" style={{ color: '#f9ca24' }}>
                {leverage}x
                </span>
            </div>
            <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={leverage}
                onChange={(e) => onLeverageChange(Number(e.target.value))}
                disabled={!!position} // 포지션이 있을 경우 레버리지 변경 비활성화
                style={{ 
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: '#374151',
                  outline: 'none',
                  appearance: 'none',
                  cursor: 'pointer'
                }}
                className="speed-slider"
            />
            <div className="flex justify-between text-sm mt-1" style={{ color: '#9ca3af' }}>
                <span>1x</span>
                <span>50x</span>
                <span>100x</span>
            </div>
            {position && <p className="text-xs mt-1" style={{color: '#9ca3af'}}>포지션 보유 중에는 레버리지를 변경할 수 없습니다.</p>}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <ChevronsRight size={16} />
            <label className="text-sm font-bold">마진 모드</label>
          </div>
          <div className="grid grid-2 gap-2">
            <button
              className={`btn-sm ${marginType === 'isolated' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onMarginTypeChange('isolated')}
              disabled={!!position}
            >
              격리
            </button>
            <button
              className={`btn-sm ${marginType === 'cross' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onMarginTypeChange('cross')}
              disabled={!!position}
            >
              교차
            </button>
          </div>
          {position && <p className="text-xs mt-1" style={{color: '#9ca3af'}}>포지션 보유 중에는 마진 모드를 변경할 수 없습니다.</p>}
        </div>

        <div>
          <label className="block mb-2 text-sm font-bold">포지션 크기</label>
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">가용 증거금 비율</span>
              <span className="text-sm font-bold">{quantityPercentage}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={quantityPercentage}
              onChange={(e) => setQuantityPercentage(Number(e.target.value))}
              style={{ 
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: 'linear-gradient(to right, #10b981 0%, #f59e0b 50%, #ef4444 100%)',
                outline: 'none',
                appearance: 'none',
                cursor: 'pointer'
              }}
              disabled={isDataLoading}
            />
            <div className="flex justify-between text-sm mt-1" style={{ color: '#9ca3af' }}>
              <span>1%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm">또는 직접 입력</label>
            <input
              type="number"
              className="input"
              style={{ width: '100%' }}
              value={isDataLoading ? '' : quantity}
              onChange={(e) => {
                const newQuantity = Number(e.target.value);
                const newPositionValue = newQuantity * validCurrentPrice;
                const newMarginCost = newPositionValue / leverage;
                const newPercentage = Math.min(100, (newMarginCost / maxUsableMargin) * 100);
                setQuantityPercentage(Math.round(newPercentage));
              }}
              step="0.01"
              min="0"
              max={maxQuantity}
              disabled={isDataLoading}
              placeholder={isDataLoading ? "로딩 중..." : "수량 입력"}
            />
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
              최대: {isDataLoading ? '0.0000' : maxQuantity.toFixed(4)}
            </p>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
              포지션 가치: {formatPrice(positionValue)}
            </p>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
              증거금: {formatPrice(marginCost)} (예상 수수료: {formatPrice(fee)})
            </p>
          </div>
        </div>
        
        <div className="grid grid-2 gap-2">
          <button
            className="btn btn-success"
            onClick={handleLong}
            disabled={!canAddLong || quantity <= 0 || quantity > maxQuantity || isDataLoading}
            style={{ opacity: (!canAddLong || isDataLoading) ? 0.5 : 1 }}
          >
            <TrendingUp size={16} />
            {position?.type === 'long' ? '롱 추가' : '롱 (매수)'}
          </button>
          
          <button
            className="btn btn-danger"
            onClick={handleShort}
            disabled={!canAddShort || quantity <= 0 || quantity > maxQuantity || isDataLoading}
            style={{ opacity: (!canAddShort || isDataLoading) ? 0.5 : 1 }}
          >
            <TrendingDown size={16} />
            {position?.type === 'short' ? '숏 추가' : '숏 (매도)'}
          </button>
        </div>

        {position && (
          <div className="card" style={{ background: '#0f172a', padding: '12px' }}>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2">
              <X size={16} />
              포지션 청산
            </h4>
            
            <div className="flex flex-col gap-3">
              <div>
                <label className="block mb-2 text-sm">청산 비율</label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={closePercentage}
                  onChange={(e) => {
                    setClosePercentage(Number(e.target.value));
                    setCustomCloseQuantity(''); // 슬라이더 사용시 직접 입력 초기화
                  }}
                  style={{ 
                    width: '100%',
                    height: '6px',
                    borderRadius: '3px',
                    background: '#374151',
                    outline: 'none',
                    appearance: 'none',
                    cursor: 'pointer'
                  }}
                  disabled={isDataLoading}
                />
                <div className="flex justify-between text-sm mt-1" style={{ color: '#9ca3af' }}>
                  <span>1%</span>
                  <span className="font-bold">{closePercentage}%</span>
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
                  onChange={(e) => {
                    setCustomCloseQuantity(e.target.value);
                    if (e.target.value) {
                      setClosePercentage(0); // 직접 입력시 슬라이더 초기화
                    }
                  }}
                  step="0.01"
                  min="0.01"
                  max={position.totalQuantity}
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
                {
								  (closePercentage === 100 && !customCloseQuantity) || (getCloseQuantity() >= position.totalQuantity)
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
