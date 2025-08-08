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

	// 입력 모드와 입력창 값을 위한 state
  const [inputMode, setInputMode] = useState('quantity'); // 'quantity' 또는 'value'
  const [inputValue, setInputValue] = useState(''); // 사용자가 보는 입력창의 값
  
  // --- 포지션 청산 관련 state ---
  const [closePercentage, setClosePercentage] = useState(100);
  const [customCloseQuantity, setCustomCloseQuantity] = useState('');
	const [closeInputValue, setCloseInputValue] = useState(''); // 청산 패널 입력창에 보이는 값

  const validCurrentPrice = currentPrice && currentPrice > 0 ? currentPrice : 1;
  const maxUsableMargin = balance / (1 + leverage * 0.0005);
  const maxQuantity = (maxUsableMargin * leverage) / validCurrentPrice;

	const truncate = (num, decimals) => {
	  const factor = Math.pow(10, decimals);
	  return Math.floor(num * factor) / factor;
	};

  const calculateQuantityFromPercentage = (percentage) => {
    if (!validCurrentPrice || !balance || balance <= 0) return 0;

    const feeRate = 0.0005;

    // 1. 사용자가 슬라이더로 선택한 비율에 따른 '희망 증거금'을 계산합니다.
    //    이때는 수수료를 제외하지 않고 총 잔고를 기준으로 계산합니다.
    const desiredMargin = balance * (percentage / 100);

    // 2. 이 '희망 증거금'으로 잡을 수 있는 포지션 가치와 그에 따른 예상 수수료를 계산합니다.
    const desiredPositionValue = desiredMargin * leverage;
    const feeForDesiredPosition = desiredPositionValue * feeRate;

    let finalMargin = desiredMargin;

    // 3. 만약 (희망 증거금 + 예상 수수료)가 총 잔고를 초과하는 경우에만,
    //    수수료를 낼 수 있도록 증거금을 자동으로 줄여서 재계산합니다.
    //    주로 100%에 가깝게 설정했을 때 이 조건이 발동합니다.
    if (desiredMargin + feeForDesiredPosition > balance) {
      // 잔고 안에서 증거금과 수수료를 모두 해결할 수 있는 최대 증거금을 계산
      // 공식: 최종 증거금 = 현재 잔고 / (1 + 레버리지 * 수수료율)
      finalMargin = balance / (1 + leverage * feeRate);
    }

    // 4. 위에서 결정된 '최종 증거금'을 바탕으로 실제 주문 수량을 계산합니다.
    const finalPositionValue = finalMargin * leverage;
    const finalQuantity = finalPositionValue / validCurrentPrice;

    return truncate(finalQuantity, 4); // 소수점 4자리 이하 절사
  };

  // 컴포넌트 로드 또는 주요 값 변경 시 초기 수량 설정
  useEffect(() => {
    const initialQuantity = calculateQuantityFromPercentage(quantityPercentage);
    setOrderQuantity(initialQuantity > 0 ? initialQuantity.toString() : '');

		const newQuantity = calculateQuantityFromPercentage(quantityPercentage);

    if (inputMode === 'quantity') {
      setInputValue(newQuantity > 0 ? newQuantity.toFixed(4) : '');
    } else {
      const newValue = newQuantity * validCurrentPrice;
      setInputValue(newValue > 0 ? newValue.toFixed(2) : '');
    }
  }, [balance, currentPrice, leverage, maxQuantity]);

  // --- 추가된 부분: 포지션 보유 상태가 변경될 때 청산 패널의 값을 초기화 ---
  useEffect(() => {
    if (position && position.totalQuantity > 0) {
      const fullQuantity = position.totalQuantity;
      setClosePercentage(100);
      setCustomCloseQuantity(fullQuantity.toFixed(4)); // 내부 계산용 수량 설정

      // 현재 입력 모드에 맞춰 입력창에 표시될 값 설정
      if (inputMode === 'quantity') {
        setCloseInputValue(fullQuantity.toFixed(4));
      } else { // 'value' 모드일 경우
        setCloseInputValue((fullQuantity * validCurrentPrice).toFixed(2));
      }
    } else {
      // 포지션이 없으면 모두 초기화
      setClosePercentage(100);
      setCustomCloseQuantity('');
      setCloseInputValue('');
    }
  }, [position, inputMode, validCurrentPrice]);

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

    if (inputMode === 'quantity') {
      setInputValue(newQuantity > 0 ? newQuantity.toFixed(4) : '');
    } else {
      const newValue = newQuantity * validCurrentPrice;
      setInputValue(newValue > 0 ? newValue.toFixed(2) : '');
    }
  };
  const handleInputValueChange = (e) => {
	    const valueStr = e.target.value;
	    setInputValue(valueStr);
	
	    const valueNum = parseFloat(valueStr) || 0;
	    let newQuantity = 0;
	
	    if (inputMode === 'quantity') {
	      newQuantity = valueNum;
	    } else { // inputMode === 'value'
	      const calculatedQty = validCurrentPrice > 0 ? valueNum / validCurrentPrice : 0;
	      // 가치(USD)로 계산 시에도 즉시 소수점 4자리 이하 버림
	      newQuantity = truncate(calculatedQty, 4);
	    }
	    
	    setOrderQuantity(newQuantity > 0 ? newQuantity.toString() : '0');
	
	    if (newQuantity > 0) {
	      const newMarginCost = (newQuantity * validCurrentPrice) / leverage;
	      const newPercentage = Math.min(100, (newMarginCost / maxUsableMargin) * 100);
	      setQuantityPercentage(newPercentage);
	    } else {
	      setQuantityPercentage(0);
	    }
	};
  
  const switchInputMode = (newMode) => {
    if (inputMode === newMode) return;
    setInputMode(newMode);

    // --- 오픈 패널 값 변환 (기존 로직) ---
    const openQty = parseFloat(orderQuantity);
    if (!isNaN(openQty) && openQty > 0) {
      if (newMode === 'value') {
        setInputValue((openQty * validCurrentPrice).toFixed(2));
      } else {
        setInputValue(openQty.toString());
      }
    } else {
      setInputValue('');
    }

    // --- 청산 패널 값 변환 (추가된 로직) ---
    const closeQty = parseFloat(customCloseQuantity);
    if (!isNaN(closeQty) && closeQty > 0) {
      if (newMode === 'value') {
        setCloseInputValue((closeQty * validCurrentPrice).toFixed(2));
      } else {
        setCloseInputValue(closeQty.toString());
      }
    } else {
      setCloseInputValue('');
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
    console.log(position, parseFloat(closeQuantity.toFixed(4)))
    onClosePosition(parseFloat(closeQuantity.toFixed(4))); 
  };
	
  // --- 추가된 부분: 청산 슬라이더와 입력 필드를 동기화하는 핸들러 ---
  const handleClosePercentageChange = (e) => {
    if (!position) return;
    const percentage = Number(e.target.value);
    setClosePercentage(percentage);

    const newQuantity = (position.totalQuantity * percentage) / 100;
    setCustomCloseQuantity(newQuantity > 0 ? truncate(newQuantity, 4).toString() : '');

    // 입력 모드에 맞춰 입력창 값도 업데이트
    if (inputMode === 'quantity') {
      setCloseInputValue(newQuantity > 0 ? truncate(newQuantity, 4).toString() : '');
    } else {
      setCloseInputValue((newQuantity * validCurrentPrice).toFixed(2));
    }
  };

  const handleCloseInputValueChange = (e) => {
    if (!position) return;
    const valueStr = e.target.value;
    setCloseInputValue(valueStr);

    const valueNum = parseFloat(valueStr) || 0;
    let closeQuantity = 0;

    if (inputMode === 'quantity') {
      closeQuantity = valueNum;
    } else { // inputMode === 'value'
      closeQuantity = validCurrentPrice > 0 ? valueNum / validCurrentPrice : 0;
    }

    setCustomCloseQuantity(closeQuantity > 0 ? truncate(closeQuantity, 4).toString() : '');

    if (position.totalQuantity > 0) {
      const newPercentage = Math.min(100, (closeQuantity / position.totalQuantity) * 100);
      setClosePercentage(newPercentage);
    } else {
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
          <div className="mb-3">
            <label className="block mb-2 text-sm">입력 방식</label>
            <div className="grid grid-2 gap-2">
              <button
                className={`btn-sm ${inputMode === 'quantity' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => switchInputMode('quantity')}
                disabled={isDataLoading}
              >
                수량({coinSymbol})
              </button>
              <button
                className={`btn-sm ${inputMode === 'value' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => switchInputMode('value')}
                disabled={isDataLoading}
              >
                가치(USD)
              </button>
            </div>
          </div>

          <div>
            <label className="block mb-2 text-sm">직접 입력</label>
            <input
              type="number"
              className="input"
              style={{ width: '100%' }}
              value={isDataLoading ? '' : inputValue}
              onChange={handleInputValueChange}
              step="0.01"
              min="0"
              disabled={isDataLoading}
              placeholder={isDataLoading ? "로딩 중..." : (inputMode === 'quantity' ? `수량 (${coinSymbol})` : "가치 (USD)")}
            />
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
              포지션 가치: {formatPrice(positionValue)}
            </p>
            <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
              증거금: {formatPrice(marginCost)} (예상 수수료: {formatPrice(fee)})
            </p>
          </div>
        </div>
        
        <div className="grid grid-2 gap-2">
          <button className="btn btn-success" onClick={handleLong} disabled={!canAddLong || quantityAsNumber <= 0 || quantityAsNumber > maxQuantity || isDataLoading} style={{ opacity: (!canAddLong || isDataLoading) ? 0.5 : 1 }}>
            <TrendingUp size={14} />{position?.type === 'long' ? '롱 추가' : 'Long'}
          </button>
          <button className="btn btn-danger" onClick={handleShort} disabled={!canAddShort || quantityAsNumber <= 0 || quantityAsNumber > maxQuantity || isDataLoading} style={{ opacity: (!canAddShort || isDataLoading) ? 0.5 : 1 }}>
            <TrendingDown size={16} />{position?.type === 'short' ? '숏 추가' : 'Short'}
          </button>
        </div>

        {/* --- 포지션 청산 UI (수정됨) --- */}
        {position && (
          <div className="card" style={{ background: '#0f172a', padding: '12px' }}>
            <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><X size={16} />포지션 청산</h4>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block mb-2 text-sm">청산 비율 </label>
								<span className="text-sm font-bold">{Math.round(closePercentage)}%</span>
                <input
                  type="range" min="0" max="100" step="1"
                  value={closePercentage}
                  onChange={handleClosePercentageChange} // 수정된 핸들러
                  style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#374151', outline: 'none', appearance: 'none', cursor: 'pointer' }}
                  disabled={isDataLoading}
                />
                <div className="flex justify-between text-sm mt-1" style={{ color: '#9ca3af' }}>
                  <span>0%</span>
									<span>50%</span>
                  {/* <span className="font-bold">{Math.round(closePercentage)}%</span> */}
                  <span>100%</span>
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm">
                  {/* 입력 모드에 따라 라벨 변경 */}
                  {inputMode === 'quantity' ? '직접 수량 입력' : '직접 가치(USD) 입력'}
                </label>
                <input
                  type="number"
                  className="input"
                  style={{ width: '100%' }}
                  value={closeInputValue} // value를 closeInputValue로 변경
                  onChange={handleCloseInputValueChange} // onChange를 새 핸들러로 변경
                  step="0.01"
                  min="0"
                  max={inputMode === 'quantity' ? position.totalQuantity.toFixed(4) : (position.totalQuantity * validCurrentPrice).toFixed(2)}
                  placeholder={inputMode === 'quantity' ? `최대: ${position.totalQuantity.toFixed(4)}` : '가치(USD) 입력'}
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