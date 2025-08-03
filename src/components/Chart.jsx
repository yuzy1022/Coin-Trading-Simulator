import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { Settings, Eye, EyeOff, PenLine, Trash2 } from 'lucide-react'; // 아이콘 추가

const Chart = ({ data, currentPrice, coinSymbol = 'BTC', timeframe = '4시간', position }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const candlestickSeriesRef = useRef();
  const priceLineRef = useRef(null); // 청산가 라인을 위한 ref 추가
  const volumeSeriesRef = useRef();
  const maSeriesRefs = useRef({});
  const dataRef = useRef(data);

  // --- 추세선 기능 상태 ---
  const [isDrawing, setIsDrawing] = useState(false);
  const [trendLines, setTrendLines] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [draggingHandle, setDraggingHandle] = useState(null);

  const trendLinesSeriesRef = useRef(new Map());
  const ghostLineSeriesRef = useRef(null);
  const drawingStateRef = useRef({ isDrawing, startPoint, selectedLineId, draggingHandle });
  const isProcessingCrosshairMove = useRef(false);

  const [hoveredCandle, setHoveredCandle] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // 기본 이동평균선 설정
  const defaultMASettings = [
    { id: 'ma7', period: 7, color: '#ff6b6b', visible: true, name: 'MA5', opacity: 1.0 },
    { id: 'ma15', period: 15, color: '#4ecdc4', visible: true, name: 'MA15', opacity: 1.0 },
    { id: 'ma30', period: 30, color: '#45b7d1', visible: true, name: 'MA30', opacity: 1.0 },
    { id: 'ma60', period: 60, color: '#f9ca24', visible: false, name: 'MA60', opacity: 1.0 },
    { id: 'ma120', period: 120, color: '#6c5ce7', visible: false, name: 'MA120', opacity: 1.0 },
    { id: 'ma240', period: 240, color: '#fd79a8', visible: false, name: 'MA240', opacity: 1.0 }
  ];

  // localStorage에서 설정 불러오기
  const loadMASettings = () => {
    try {
      const saved = localStorage.getItem('maSettings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        // 기본 설정과 저장된 설정을 병합 (새로운 MA가 추가된 경우 대비)
        return defaultMASettings.map(defaultMA => {
          const savedMA = parsedSettings.find(saved => saved.id === defaultMA.id);
          return savedMA ? { ...defaultMA, ...savedMA } : defaultMA;
        });
      }
    } catch (error) {
      console.warn('Failed to load MA settings from localStorage:', error);
    }
    return defaultMASettings;
  };

  // localStorage에 설정 저장하기
  const saveMASettings = (settings) => {
    try {
      localStorage.setItem('maSettings', JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save MA settings to localStorage:', error);
    }
  };
  

  // 이동평균선 설정 상태 (localStorage에서 불러온 설정으로 초기화)
  const [maSettings, setMaSettings] = useState(loadMASettings);

  // 컴포넌트가 리렌더링 될 때마다 ref에 최신 상태 저장
  useEffect(() => {
    dataRef.current = data;
    // --- 수정: trendLines를 ref에 추가 ---
    drawingStateRef.current = { isDrawing, startPoint, selectedLineId, draggingHandle, trendLines };
    saveMASettings(maSettings);
  }, [data, isDrawing, startPoint, selectedLineId, draggingHandle, maSettings, trendLines]); // 의존성 배열에도 trendLines 추가

  // 이동평균 계산 함수
  const calculateMA = (data, period) => {
    const maData = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, candle) => acc + candle.close, 0);
      const avg = sum / period;
      maData.push({
        time: data[i].timestamp ? Math.floor(data[i].timestamp / 1000) : Date.now() / 1000,
        value: avg
      });
    }
    return maData;
  };

  // 현재 이동평균 값 계산
  const getCurrentMAValues = () => {
    if (!data || data.length === 0) return {};
    
    const currentMAValues = {};
    maSettings.forEach(maSetting => {
      if (maSetting.visible && data.length >= maSetting.period) {
        const maData = calculateMA(data, maSetting.period);
        if (maData.length > 0) {
          currentMAValues[maSetting.id] = maData[maData.length - 1].value;
        }
      }
    });
    
    return currentMAValues;
  };

  // 투명도가 적용된 색상 생성
  const getColorWithOpacity = (color, opacity) => {
    // hex 색상을 rgba로 변환
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const drawLine = (line) => {
    if (!chartRef.current) return null;
    const lineSeries = chartRef.current.addLineSeries({
      color: '#f9ca24',
      lineWidth: 2,
      lineStyle: 0,
      lastValueVisible: false,
      priceLineVisible: false,
    });
    lineSeries.setData([
      { time: line.start.time, value: line.start.price },
      { time: line.end.time, value: line.end.price },
    ]);
    return lineSeries;
  };

  const handleDeleteLastLine = () => {
    if (trendLines.length === 0) return;
    const lastLineId = trendLines[trendLines.length - 1].id;
    const seriesToRemove = trendLinesSeriesRef.current.get(lastLineId);

    if (seriesToRemove) {
      chartRef.current.removeSeries(seriesToRemove);
      trendLinesSeriesRef.current.delete(lastLineId);
    }
    setTrendLines(prevLines => prevLines.slice(0, -1));
  };
  
  const toggleDrawingMode = () => {
    setIsDrawing(prev => !prev);
    setStartPoint(null);
    setSelectedLineId(null); // 그리기 모드 변경 시 선택 해제
    if (ghostLineSeriesRef.current) {
      ghostLineSeriesRef.current.setData([]);
    }
  };

  useEffect(() => {
    const chartElement = chartContainerRef.current;
    if (!chartElement) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#1a1f2e' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: '#2a3441' },
        horzLines: { color: '#2a3441' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: '#2a3441',
        autoScale: false, // 가격 축 자동 스케일링 비활성화
      },
      timeScale: {
        borderColor: '#2a3441',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
    });
    chartRef.current = chart;

    // 캔들스틱 차트 추가
    candlestickSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#10b981',
      wickDownColor: '#ef4444',
      wickUpColor: '#10b981',
      priceScaleId: 'right',
    });

    // 거래량 차트 먼저 추가 (가장 아래)
    volumeSeriesRef.current = chartRef.current.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.7,
        bottom: 0,
      },
    });

    chartRef.current.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.7,
        bottom: 0,
      },
      borderColor: '#2a3441',
    });

    // --- 수정: 유령선을 처음에 한 번만 생성 ---
    ghostLineSeriesRef.current = chart.addLineSeries({
      color: 'rgba(255, 255, 255, 0.6)',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    try {
      const savedLines = JSON.parse(localStorage.getItem('trendLines') || '[]');
      setTrendLines(savedLines);
    } catch (e) { console.error("Failed to parse trendLines", e); setTrendLines([]); }
    
    // 클릭 이벤트 핸들러 (그리기 / 선택 / 드래그)
    chart.subscribeClick(param => {
      const { isDrawing, startPoint, draggingHandle, trendLines } = drawingStateRef.current;
      const price = candlestickSeriesRef.current.coordinateToPrice(param.point.y);
      if (!param.point || !param.time || price === null) return;
      
      // 드래그 중이었다면, 드래그를 종료합니다.
      if (draggingHandle) {
        // 드래그가 끝나면, 최종 위치를 React 상태에 업데이트합니다.
        setTrendLines(prevLines => prevLines.map(line => {
          if (line.id === draggingHandle.lineId) {
            const updatedPoint = { time: param.time, price };
            return { ...line, [draggingHandle.handle]: updatedPoint };
          }
          return line;
        }));
        setDraggingHandle(null);
        return;
      }
      
      // 그리기 모드일 경우, 새 추세선을 그립니다.
      if (isDrawing) {
        if (!startPoint) {
          setStartPoint({ time: param.time, price });
        } else {
          const finalLine = { id: Date.now(), start: startPoint, end: { time: param.time, price } };
          setTrendLines(prev => [...prev, finalLine]);
          setStartPoint(null);
          setIsDrawing(false);
        }
        return;
      }

      // --- 수정된 부분: 기존 추세선 선택 및 드래그 시작 ---
      const timeScale = chart.timeScale();
      let clickedOnHandle = null;

      for (const line of trendLines) {
        
        const startCoordX = timeScale.timeToCoordinate(line.start.time);
        const startCoordY = candlestickSeriesRef.current.priceToCoordinate(line.start.price);
        const endCoordX = timeScale.timeToCoordinate(line.end.time);
        const endCoordY = candlestickSeriesRef.current.priceToCoordinate(line.end.price);

        // 라인의 양 끝점이 화면에 보이지 않으면(좌표 변환 실패) 건너뜁니다.
        if (startCoordX === null || startCoordY === null || endCoordX === null || endCoordY === null) {
          continue;
        }
        
        // 마우스 클릭 위치와 라인 끝점 사이의 거리를 계산합니다.
        const distToStart = Math.hypot(param.point.x - startCoordX, param.point.y - startCoordY);
        const distToEnd = Math.hypot(param.point.x - endCoordX, param.point.y - endCoordY);

        const clickRadius = 15; // 클릭 감지 반경
        if (distToStart < clickRadius) {
          clickedOnHandle = { lineId: line.id, handle: 'start' };
          break;
        }
        if (distToEnd < clickRadius) {
          clickedOnHandle = { lineId: line.id, handle: 'end' };
          break;
        }
      }

      if (clickedOnHandle) {
        setDraggingHandle(clickedOnHandle);
        setSelectedLineId(clickedOnHandle.lineId);
      } else {
        setSelectedLineId(null);
      }
    });

    // 마우스 이동 이벤트 핸들러 (미리보기 / 드래그)
    chart.subscribeCrosshairMove((param) => {
      if (isProcessingCrosshairMove.current) return;
      try {
        isProcessingCrosshairMove.current = true;
        const { isDrawing, startPoint, draggingHandle, trendLines } = drawingStateRef.current;

        // 캔들 정보 표시 로직 (기존과 동일)
        if (param.time && dataRef.current.length > 0) {
          const candleIndex = dataRef.current.findIndex(candle => Math.floor(candle.timestamp / 1000) === param.time);
          if (candleIndex >= 0) {
            const currentCandle = dataRef.current[candleIndex];
            const previousCandle = candleIndex > 0 ? dataRef.current[candleIndex - 1] : null;
            setHoveredCandle({ ...currentCandle, previousCandle, index: candleIndex });
          } else {
            setHoveredCandle(null);
          }
        } else {
          setHoveredCandle(null);
        }

        // --- 수정된 부분: 유령선과 드래그 로직을 모두 포함 ---
        if (param.point && param.time) {
          const price = candlestickSeriesRef.current.coordinateToPrice(param.point.y);
          if (price === null) return;

          // 1. 새 추세선을 그리는 중일 때 (유령선 표시)
          if (isDrawing && startPoint) {
            if (startPoint.time !== param.time) {
              const points = [
                { time: startPoint.time, value: startPoint.price },
                { time: param.time, value: price },
              ];
              points.sort((a, b) => a.time - b.time);
              ghostLineSeriesRef.current.applyOptions({ visible: true });
              ghostLineSeriesRef.current.setData(points);
            }
          } 
          // 2. 기존 추세선을 수정하는 중일 때 (드래그)
          else if (draggingHandle) {
            const seriesToDrag = trendLinesSeriesRef.current.get(draggingHandle.lineId);
            const originalLine = trendLines.find(l => l.id === draggingHandle.lineId);

            if (seriesToDrag && originalLine) {
              const updatedPoint = { time: param.time, value: price };
              const stationaryPoint = draggingHandle.handle === 'start'
                ? { time: originalLine.end.time, value: originalLine.end.price }
                : { time: originalLine.start.time, value: originalLine.start.price };
              
              const points = [updatedPoint, stationaryPoint];
              points.sort((a, b) => a.time - b.time);
              seriesToDrag.setData(points);
            }
          }
        }
      } finally {
        isProcessingCrosshairMove.current = false;
      }
    });

    // --- 수정: 키보드 이벤트 핸들러 추가 ---
    const handleKeyDown = (event) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const { selectedLineId } = drawingStateRef.current;
        if (selectedLineId !== null) {
          setTrendLines(prevLines => prevLines.filter(line => line.id !== selectedLineId));
          setSelectedLineId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown); // 이벤트 리스너 제거
      if (chartRef.current) chartRef.current.remove();
    };
  }, []);

  useEffect(() => {
    // isDrawing 상태가 false로 변경되면(추세선 그리기가 끝나거나 취소되면) 유령선을 숨깁니다.
    if (!isDrawing && ghostLineSeriesRef.current) {
      ghostLineSeriesRef.current.setData([]);
    }
  }, [isDrawing]);

  // trendLines 상태가 변경될 때 영구적인 선들을 다시 그리는 useEffect
  useEffect(() => {
    if (!chartRef.current) return;
    // 기존 선들 모두 삭제
    trendLinesSeriesRef.current.forEach(series => chartRef.current.removeSeries(series));
    trendLinesSeriesRef.current.clear();
    
    // 현재 trendLines 배열에 있는 모든 선을 다시 그리기
    trendLines.forEach(line => {
      // --- 수정: 선택된 선은 다른 색으로 표시 ---
      const isSelected = line.id === selectedLineId;
      const lineSeries = chartRef.current.addLineSeries({
        color: isSelected ? '#3b82f6' : '#f9ca24',
        lineWidth: isSelected ? 3 : 2,
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const points = [
        { time: line.start.time, value: line.start.price },
        { time: line.end.time, value: line.end.price },
      ];
      points.sort((a, b) => a.time - b.time);
      lineSeries.setData(points);
      trendLinesSeriesRef.current.set(line.id, lineSeries);
    });

    // 로컬 스토리지에 저장
    localStorage.setItem('trendLines', JSON.stringify(trendLines));
  }, [trendLines, selectedLineId]);

  // 이동평균선 업데이트
  useEffect(() => {
    if (!chartRef.current || !data.length) return;

    // 기존 이동평균선 제거 (안전하게)
    if (maSeriesRefs.current) {
      Object.entries(maSeriesRefs.current).forEach(([key, series]) => {
        if (series && chartRef.current) {
          try {
            chartRef.current.removeSeries(series);
          } catch (error) {
            console.warn('Error removing series:', error);
          }
        }
      });
    }
    maSeriesRefs.current = {};

    // 이동평균선 추가 (캔들 위에 표시)
    maSettings.forEach(maSetting => {
      if (maSetting.visible && data.length >= maSetting.period && chartRef.current) {
        try {
          const maData = calculateMA(data, maSetting.period);
          const series = chartRef.current.addLineSeries({
            color: getColorWithOpacity(maSetting.color, maSetting.opacity),
            lineWidth: 2,
            priceScaleId: 'right',
            title: maSetting.name,
            crosshairMarkerVisible: false, // 십자선 마커 제거
            lastValueVisible: true, // 우측 가격 라벨 표시
            priceLineVisible: false, // 현재 가격 점선은 숨김
          });
          series.setData(maData);
          maSeriesRefs.current[maSetting.id] = series;
        } catch (error) {
          console.warn('Error adding MA series:', error);
        }
      }
    });
}, [maSettings, data.length]);

  useEffect(() => {
    if (candlestickSeriesRef.current && volumeSeriesRef.current && data.length > 0) {
      const candleData = data.map((item) => ({
        time: item.timestamp ? Math.floor(item.timestamp / 1000) : Date.now() / 1000,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));
      
      const volumeData = data.map((item) => ({
        time: item.timestamp ? Math.floor(item.timestamp / 1000) : Date.now() / 1000,
        value: item.volume,
        color: item.close >= item.open ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
      }));
      
      candlestickSeriesRef.current.setData(candleData);
      volumeSeriesRef.current.setData(volumeData);
      
      if (data.length <= 1001) {
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [data]);

  useEffect(() => {
    if (!candlestickSeriesRef.current) return;

    // 기존 라인 제거
    if (priceLineRef.current) {
        candlestickSeriesRef.current.removePriceLine(priceLineRef.current);
        priceLineRef.current = null;
    }

    // 포지션과 청산가가 있으면 새 라인 생성
    if (position && position.liquidationPrice) {
      priceLineRef.current = candlestickSeriesRef.current.createPriceLine({
        price: position.liquidationPrice,
        color: '#ef4444', // 빨간색
        lineWidth: 2,
        lineStyle: 2, // 0: Solid, 1: Dotted, 2: Dashed, 3: LargeDashed
        axisLabelVisible: true,
        title: '청산가',
      });
    }
  }, [position]); // position이 변경될 때마다 실행

  // 이동평균선 설정 변경 함수들
  const toggleMAVisibility = (id) => {
    setMaSettings(prev => prev.map(ma => 
      ma.id === id ? { ...ma, visible: !ma.visible } : ma
    ));
  };

  const updateMAPeriod = (id, period) => {
    const numPeriod = parseInt(period);
    if (numPeriod > 0 && numPeriod <= 500) {
      setMaSettings(prev => prev.map(ma => 
        ma.id === id ? { ...ma, period: numPeriod, name: `MA${numPeriod}` } : ma
      ));
    }
  };

  const updateMAColor = (id, color) => {
    setMaSettings(prev => prev.map(ma => 
      ma.id === id ? { ...ma, color } : ma
    ));
  };

  const updateMAOpacity = (id, opacity) => {
    const numOpacity = parseFloat(opacity);
    if (numOpacity >= 0 && numOpacity <= 1) {
      setMaSettings(prev => prev.map(ma => 
        ma.id === id ? { ...ma, opacity: numOpacity } : ma
      ));
    }
  };

  const formatPrice = (price) => {
    if (coinSymbol === 'ADA') {
      return `$${price.toFixed(4)}`;
    }
    return `$${price.toFixed(2)}`;
  };

  const formatVolume = (volume) => {
    if (volume >= 1000000000) {
      return `${(volume / 1000000000).toFixed(1)}B`;
    } else if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toFixed(0);
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

  const getDataPeriodInfo = () => {
    if (!data || data.length === 0) return '';
    
    const firstCandle = data[0];
    const lastCandle = data[data.length - 1];
    
    if (!firstCandle?.timestamp || !lastCandle?.timestamp) return '';
    
    const startDate = new Date(firstCandle.timestamp);
    const endDate = new Date(lastCandle.timestamp);
    
    const formatDate = (date) => {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };
    
    return `${formatDate(startDate)} ~ ${formatDate(endDate)}`;
  };

  const getCurrentVolumeInfo = () => {
    if (!data || data.length === 0) return '';
    const currentCandle = data[data.length - 1];
    return currentCandle ? formatVolume(currentCandle.volume) : '';
  };

  const renderCandleInfo = () => {
    const currentMAValues = getCurrentMAValues();
    
    if (!hoveredCandle) {
      return (
        <div>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-bold">실시간 차트 ({timeframe})</h3>
              <p className="text-sm" style={{ color: '#9ca3af' }}>
                {getDataPeriodInfo()}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">
                {formatPrice(currentPrice)}
              </div>
              <div className="text-sm" style={{ color: '#9ca3af' }}>
                거래량: {getCurrentVolumeInfo()}
              </div>
            </div>
          </div>
          
          {/* 현재 이동평균선 값들 표시 */}
          {Object.keys(currentMAValues).length > 0 && (
            <div className="flex flex-wrap gap-4 text-sm">
              {maSettings
                .filter(ma => ma.visible && currentMAValues[ma.id])
                .map(ma => (
                  <span key={ma.id} style={{ color: getColorWithOpacity(ma.color, ma.opacity) }}>
                    <span className="font-bold">{ma.name}:</span> {formatPrice(currentMAValues[ma.id])}
                  </span>
                ))}
            </div>
          )}
        </div>
      );
    }

    const { open, high, low, close, volume, previousCandle, timestamp } = hoveredCandle;
    const change = previousCandle ? close - previousCandle.close : 0;
    const changePercent = previousCandle ? ((close - previousCandle.close) / previousCandle.close) * 100 : 0;
    const isUp = close >= open;

    return (
      <div>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-bold">캔들 정보 ({timeframe})</h3>
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              {formatDateTime(timestamp)}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-lg font-bold ${change >= 0 ? 'text-green' : 'text-red'}`}>
              {formatPrice(close)}
            </div>
            <div className={`text-sm ${change >= 0 ? 'text-green' : 'text-red'}`}>
              {change >= 0 ? '+' : ''}{formatPrice(change)} ({change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
            </div>
          </div>
        </div>
        
        <div className="flex gap-8 text-sm mb-3">
          <span style={{ color: '#9ca3af' }}>시가<span className={`font-bold ${isUp ? 'text-green' : 'text-red'}`}>{formatPrice(open)}&nbsp;&nbsp;</span></span>
          <span style={{ color: '#9ca3af' }}>고가<span className={`font-bold ${isUp ? 'text-green' : 'text-red'}`}>{formatPrice(high)}&nbsp;&nbsp;</span></span>
          <span style={{ color: '#9ca3af' }}>저가<span className={`font-bold ${isUp ? 'text-green' : 'text-red'}`}>{formatPrice(low)}&nbsp;&nbsp;</span></span>
          <span style={{ color: '#9ca3af' }}>종가<span className={`font-bold ${isUp ? 'text-green' : 'text-red'}`}>{formatPrice(close)}&nbsp;&nbsp;</span></span>
          <span style={{ color: '#9ca3af' }}>거래량<span className={`font-bold ${isUp ? 'text-green' : 'text-red'}`}>{formatVolume(volume)}&nbsp;&nbsp;</span></span>
        </div>

        {/* 호버된 캔들에서의 이동평균선 값들 표시 */}
        {Object.keys(currentMAValues).length > 0 && (
          <div className="flex flex-wrap gap-4 text-sm">
            {maSettings
              .filter(ma => ma.visible && currentMAValues[ma.id])
              .map(ma => (
                <span key={ma.id} style={{ color: getColorWithOpacity(ma.color, ma.opacity) }}>
                  <span className="font-bold">{ma.name}:</span> {formatPrice(currentMAValues[ma.id])}
                </span>
              ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-4" style={{ minHeight: '120px' }}>
        <div className="flex justify-between items-start mb-2">
          <div style={{ flex: 1 }}>
            {renderCandleInfo()}
          </div>

          <div className="flex items-center gap-2">
            <button
              className={`btn btn-sm ${isDrawing ? 'btn-danger' : 'btn-secondary'}`}
              onClick={toggleDrawingMode}
              style={{ padding: '8px' }}
            >
              <PenLine size={16} />
              {isDrawing ? '취소' : '추세선'}
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={handleDeleteLastLine}
              style={{ padding: '8px' }}
            >
              <Trash2 size={16} />
            </button>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => setShowSettings(!showSettings)}
            style={{ marginLeft: '16px', padding: '8px' }}
          >
            <Settings size={16} />
          </button>
        </div>

        {/* 이동평균선 설정 패널 */}
        {showSettings && (
          <div className="card mt-2" style={{ background: '#0f172a', padding: '16px' }}>
            <h4 className="font-bold mb-3">이동평균선 설정</h4>
            <div className="grid gap-4">
              {maSettings.map(ma => (
                <div key={ma.id} className="card" style={{ background: '#1a1f2e', padding: '12px' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ma.visible}
                        onChange={() => toggleMAVisibility(ma.id)}
                        className="w-4 h-4"
                      />
                      {ma.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                      <span className="text-sm font-bold" style={{ color: getColorWithOpacity(ma.color, ma.opacity) }}>
                        {ma.name}
                      </span>
                    </label>
                    
                    <input
                      type="number"
                      value={ma.period}
                      onChange={(e) => updateMAPeriod(ma.id, e.target.value)}
                      className="input text-sm"
                      style={{ width: '60px', padding: '4px 8px' }}
                      min="1"
                      max="500"
                    />
                    
                    <input
                      type="color"
                      value={ma.color}
                      onChange={(e) => updateMAColor(ma.id, e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer"
                      style={{ border: '1px solid #374151' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: '#9ca3af' }}>투명도</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.1"
                        value={ma.opacity}
                        onChange={(e) => updateMAOpacity(ma.id, e.target.value)}
                        className="flex-1"
                        style={{ height: '4px' }}
                      />
                      <span className="text-sm" style={{ color: '#9ca3af', minWidth: '30px' }}>
                        {Math.round(ma.opacity * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-3 text-sm" style={{ color: '#9ca3af' }}>
              💡 체크박스: 표시/숨김 | 숫자: 기간 변경 | 색상: 선 색상 | 투명도: 0.1~1.0
            </div>
          </div>
        )}
      </div>
      
      <div ref={chartContainerRef} style={{ width: '100%', height: '500px' }} />
    </div>
  );
};

export default Chart;
