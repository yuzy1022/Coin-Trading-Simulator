import React, { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { Settings, Eye, EyeOff, PenLine, Trash2 } from 'lucide-react'; // 아이콘 추가

const Chart = ({ data, latestCandle, coinSymbol = 'BTC', timeframe = '4시간', position }) => {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const candlestickSeriesRef = useRef();
  const priceLineRef = useRef(null); // 청산가 라인을 위한 ref 추가
  const entryPriceLineRef = useRef(null); //매수가 라인을 위한 ref 추가
  const currentPriceLineRef = useRef(null); // 현재가 라인을 위한 ref 추가
  const volumeSeriesRef = useRef();
  const maSeriesRefs = useRef({});
  const dataRef = useRef(data);

  // --- 추세선 기능 상태 ---
  const [isDrawing, setIsDrawing] = useState(false);
  const [trendLines, setTrendLines] = useState([]);
  const [startPoint, setStartPoint] = useState(null);
  const [selectedLineId, setSelectedLineId] = useState(null);
  const [draggingHandle, setDraggingHandle] = useState(null);
  
  // --- 모바일 전용 상태 추가 ---
  const [isMobile, setIsMobile] = useState(false); // 모바일 환경 감지
  const [drawingStep, setDrawingStep] = useState(0); // 0: off, 1: startPoint 설정, 2: endPoint 설정

  const trendLinesSeriesRef = useRef(new Map());
  const ghostLineSeriesRef = useRef(null);
  const currentHoverPointRef = useRef(null); // NEW: 현재 드래그/호버 위치 저장 Ref
  const drawingStateRef = useRef({ isDrawing, startPoint, selectedLineId, draggingHandle, trendLines, isMobile, drawingStep });
  const isProcessingCrosshairMove = useRef(false);
  const [isCrosshairVisible, setIsCrosshairVisible] = useState(false);

  const [hoveredCandle, setHoveredCandle] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // 기본 이동평균선 설정
  const defaultMASettings = [
    { id: 'ma7', period: 7, color: '#ff6b6b', visible: true, name: 'MA7', opacity: 1.0 },
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
    // --- 수정: ref에 새로운 상태와 trendLines 추가 ---
    drawingStateRef.current = { 
      isDrawing, 
      startPoint, 
      selectedLineId, 
      draggingHandle, 
      trendLines, 
      isMobile, 
      drawingStep 
    };
    saveMASettings(maSettings);
  }, [data, isDrawing, startPoint, selectedLineId, draggingHandle, maSettings, trendLines, isMobile, drawingStep]); // 의존성 배열에 새로운 상태 추가

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
    // 그리기 모드를 끄는 경우
    if (isDrawing) {
      setIsDrawing(false);
      setDrawingStep(0);
      setStartPoint(null);
      setSelectedLineId(null);
      currentHoverPointRef.current = null;
      if (ghostLineSeriesRef.current) {
        ghostLineSeriesRef.current.setData([]);
      }
    } else {
      // 그리기 모드를 켜는 경우
      setIsDrawing(true);
      setSelectedLineId(null);
      setStartPoint(null);
      setDrawingStep(1);

      if (chartRef.current) {
        if (ghostLineSeriesRef.current) {
          chartRef.current.removeSeries(ghostLineSeriesRef.current);
        }
        // 🔥 FIX: 눈에 잘 띄는 새로운 기본 스타일로 점을 생성합니다.
        ghostLineSeriesRef.current = chartRef.current.addLineSeries({
          priceScaleId: 'right',
          color: 'rgba(255, 255, 255, 1)',
          lineWidth: 2,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          pointMarkersVisible: true,
          pointMarkersRadius: 8,
          pointMarkersColor: '#FFFFFF', // 흰색 배경
          pointMarkersBorderColor: '#3B82F6', // 파란색 테두리
          pointMarkersBorderWidth: 2,
        });
      }

      const { isMobile } = drawingStateRef.current;
      if (isMobile && chartRef.current && candlestickSeriesRef.current && chartContainerRef.current && dataRef.current.length > 0) {
        const chart = chartRef.current;
        const chartWidth = chartContainerRef.current.clientWidth;
        const chartHeight = chartContainerRef.current.clientHeight;
        const centerPointY = chartHeight / 2;
        const centerPointX = chartWidth / 2;
        const centerTime = chart.timeScale().coordinateToTime(centerPointX);
        const centerPrice = candlestickSeriesRef.current.coordinateToPrice(centerPointY);
        const firstTime = Math.floor(dataRef.current[0].timestamp / 1000);
        const lastTime = Math.floor(dataRef.current[dataRef.current.length - 1].timestamp / 1000);

        if (ghostLineSeriesRef.current && centerTime !== null && centerPrice !== null) {
          const clampedTime = centerTime < firstTime || centerTime > lastTime ? lastTime : centerTime;
          const initialPointForChart = { time: clampedTime, value: centerPrice };
          const initialPointForRef = { time: clampedTime, price: centerPrice };
          currentHoverPointRef.current = initialPointForRef;
          setTimeout(() => {
            ghostLineSeriesRef.current.applyOptions({ visible: true, lineVisible: false });
            ghostLineSeriesRef.current.setData([initialPointForChart]);
          }, 0);
        } else {
          console.warn("Chart data or conversion failed for initial dot placement.");
        }
      }
    }
  };

  // --- NEW: 모바일 환경 감지 (한 번만 실행) ---
  useEffect(() => {
    // 터치 이벤트 지원 여부를 통해 모바일 환경 감지 (단순한 휴리스틱)
    const isTouchDevice = typeof window.orientation !== 'undefined' || navigator.userAgent.indexOf('IEMobile') !== -1 || ('ontouchstart' in window);
    setIsMobile(isTouchDevice);
  }, []);

  useEffect(() => {
    // 모바일이 아니거나, (그리기 중도 아니고 수정 중도 아닐 경우) 아무것도 하지 않음
    if (!isMobile || (!isDrawing && !draggingHandle)) return;

    const chartElement = chartContainerRef.current;
    if (!chartElement) return;

    // 터치 이동 이벤트 핸들러
    const handleTouchMove = (event) => {
      // 기본 스크롤 동작을 막아서 차트가 움직이지 않게 함
      event.preventDefault();

      if (event.touches.length === 0) return;

      const touch = event.touches[0];
      const rect = chartElement.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      const chart = chartRef.current;
      const series = candlestickSeriesRef.current;
      if (!chart || !series) return;

      const time = chart.timeScale().coordinateToTime(x);
      const price = series.coordinateToPrice(y);

      if (time === null || price === null) return;

      // 클릭(터치 종료) 시 최종 위치로 사용될 좌표를 업데이트
      currentHoverPointRef.current = { time, price };
      const currentPoint = { time, value: price };

      // drawingStateRef에서 최신 상태를 가져옴
      const { isDrawing, drawingStep, startPoint, draggingHandle, trendLines } = drawingStateRef.current;

      if (isDrawing) {
        // --- 1. 새로운 선을 그리는 경우 ---
        if (drawingStep === 1) { // 첫 번째 점
          ghostLineSeriesRef.current.applyOptions({ lineVisible: false });
          ghostLineSeriesRef.current.setData([currentPoint]);
        } else if (drawingStep === 2 && startPoint) { // 두 번째 점
          const points = [
            { time: startPoint.time, value: startPoint.price },
            currentPoint,
          ];
          points.sort((a, b) => a.time - b.time);
          ghostLineSeriesRef.current.applyOptions({ lineVisible: true });
          ghostLineSeriesRef.current.setData(points);
        }
      } else if (draggingHandle) {
        // --- 2. 기존 선을 수정하는 경우 ---
        const seriesToDrag = trendLinesSeriesRef.current.get(draggingHandle.lineId);
        const originalLine = trendLines.find(l => l.id === draggingHandle.lineId);

        if (seriesToDrag && originalLine) {
          const stationaryPoint = draggingHandle.handle === 'start'
            ? { time: originalLine.end.time, value: originalLine.end.price }
            : { time: originalLine.start.time, value: originalLine.start.price };
          
          const points = [currentPoint, stationaryPoint];
          points.sort((a, b) => a.time - b.time);
          seriesToDrag.setData(points);
        }
      }
    };

    // 이벤트 리스너 등록
    chartElement.addEventListener('touchmove', handleTouchMove, { passive: false });

    // 클린업 함수: 그리기/수정 모드가 끝나면 이벤트 리스너를 반드시 제거
    return () => {
      chartElement.removeEventListener('touchmove', handleTouchMove);
    };

  }, [isDrawing, draggingHandle, isMobile]); // isDrawing, draggingHandle, isMobile 상태가 변경될 때마다 실행

  // --- NEW: 차트/페이지 인터랙션 동적 제어 (isDrawing 또는 draggingHandle에 따라) ---
  useEffect(() => {
    if (!chartRef.current) return;

    const isDrawingOrDraggingHandle = isDrawing || !!draggingHandle;
    const enableNormalInteractions = !isDrawingOrDraggingHandle;

    const crosshairMode = 0;
    const disableAllChartMovement = isDrawingOrDraggingHandle;

    // 1. Lightweight Charts 인터랙션 동적 적용
    chartRef.current.applyOptions({
      crosshair: { mode: crosshairMode },
      handleScroll: {
        pressedMouseMove: enableNormalInteractions,
        // 🔥 FIX: 그리기 모드일 때는 차트 이동을 다시 비활성화합니다.
        horzTouchDrag: !disableAllChartMovement,
        vertTouchDrag: !disableAllChartMovement,
      },
      handleScale: {
        mouseWheel: !disableAllChartMovement,
        axisPressedMouseMove: {
          time: !disableAllChartMovement,
          price: !disableAllChartMovement,
        },
        pinch: !disableAllChartMovement,
      }
    });

    // 2. 페이지 스크롤 막기/허용 (body 스타일 제어)
    if (isDrawingOrDraggingHandle) {
      // 페이지 스크롤링 비활성화 (차트가 컨테이너를 벗어나는 것을 방지)
      document.body.style.overflow = 'hidden';
      // touch-action: none이 브라우저의 기본 스크롤 동작을 막아
      // 차트 내의 드래그 좌표를 CrosshairMove로 전달하게 합니다.
      document.body.style.touchAction = 'none'; 
    } else {
      // 페이지 스크롤링 활성화
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    
    // 유령선 숨김 (그리기/수정 모드가 아닐 때)
    if (!isDrawing && ghostLineSeriesRef.current) {
      // 그리기 모드 종료 시, lineVisible 설정을 원래대로 돌려놓습니다.
      ghostLineSeriesRef.current.applyOptions({ lineVisible: true });
      ghostLineSeriesRef.current.setData([]);
      currentHoverPointRef.current = null; // NEW: 호버 ref 초기화
    }

    // 클린업 함수: 컴포넌트 언마운트 시 항상 페이지 스크롤을 복원합니다.
    return () => {
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
    };

  }, [isDrawing, draggingHandle]); // isDrawing 또는 draggingHandle 상태에 의존

  useEffect(() => {
    const chartElement = chartContainerRef.current;
    if (!chartElement) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { color: '#1a1f2e' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: '#2a3441' },
        horzLines: { color: '#2a3441' },
      },
      crosshair: {
        mode: 0, // 기본 모드 (Magnet)
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
      // 스크롤 및 스케일(확대/축소) 옵션 추가 (기본값을 true로 설정하고, 동적으로 isDrawing에서 제어)
      handleScroll: {
        mouseWheel: true, 
        pressedMouseMove: true, 
        horzTouchDrag: true, // 모바일 기본값 true
        vertTouchDrag: true, // 모바일 기본값 true
      },
      handleScale: {
        mouseWheel: true, 
        axisPressedMouseMove: { 
            time: true,
            price: true,
        },
        axisDoubleClickReset: true, 
        pinch: true, // 모바일 핀치 줌 기본값 true
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
      lastValueVisible: false,
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

    // --- 수정: 유령선을 처음에 한 번만 생성 (점 시각화 옵션 추가) ---
    ghostLineSeriesRef.current = chart.addLineSeries({
      color: 'rgba(255, 255, 255, 1)',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      // 👇 NEW: 점(Point) 시각화 옵션 추가
      pointMarkersVisible: true, 
      pointMarkersRadius: 6, // 점 크기 설정
      pointMarkersColor: 'rgba(255, 255, 255, 1)', // 점 색상 설정 (흰색)
    });

    try {
      // const savedLines = JSON.parse(localStorage.getItem('trendLines') || '[]');
      // setTrendLines(savedLines);
    } catch (e) { console.error("Failed to parse trendLines", e); setTrendLines([]); }
    
    // --- NEW/MODIFIED: 클릭 이벤트 핸들러 (그리기 / 선택 / 드래그) ---
    chart.subscribeClick(param => {
      const { isDrawing, startPoint, draggingHandle, trendLines, isMobile, drawingStep } = drawingStateRef.current;
      const price = candlestickSeriesRef.current.coordinateToPrice(param.point.y);
      if (!param.point || !param.time || price === null) return;
      
      // 🔥 FIX: 드래그 수정 모드를 종료하는 로직을 수정합니다.
      if (draggingHandle) {
        // 탭한 위치가 아닌, 드래그가 끝난 '마지막 위치'를 최종 좌표로 사용합니다.
        const finalPoint = currentHoverPointRef.current;

        // finalPoint가 유효한 경우에만 업데이트를 수행합니다.
        if (finalPoint) {
          setTrendLines(prevLines => prevLines.map(line => {
            if (line.id === draggingHandle.lineId) {
              // 'param' (탭 위치) 대신 'finalPoint' (드래그 최종 위치)를 사용합니다.
              const updatedPoint = { time: finalPoint.time, price: finalPoint.price };
              return { ...line, [draggingHandle.handle]: updatedPoint };
            }
            return line;
          }));
        }
        
        // 드래그 핸들을 초기화하여 수정 모드를 종료합니다.
        setDraggingHandle(null);
        return;
      }
      
      if (isDrawing) {
        const defaultPoint = { time: param.time, price };
        const finalPoint = currentHoverPointRef.current || defaultPoint;

        if (isMobile) {
          if (drawingStep === 1) { 
            setStartPoint(finalPoint);
            setDrawingStep(2); 
            
            if (ghostLineSeriesRef.current) {
              ghostLineSeriesRef.current.applyOptions({
                color: 'rgba(59, 130, 246, 1)',
                pointMarkersColor: '#3B82F6', 
                pointMarkersBorderColor: '#FFFFFF',
              });
            }

          } else if (drawingStep === 2 && startPoint) { 
            if (startPoint.time === finalPoint.time && startPoint.price === finalPoint.price) {
              return; 
            }
            const finalLine = { id: Date.now(), start: startPoint, end: finalPoint }; 
            setTrendLines(prev => [...prev, finalLine]);
            setStartPoint(null);
            setIsDrawing(false); 
            setDrawingStep(0); 
            currentHoverPointRef.current = null; 

            if (ghostLineSeriesRef.current) {
              ghostLineSeriesRef.current.setData([]);
            }
          }
          return;
        } 
        else {
          if (!startPoint) {
            setStartPoint(finalPoint);
          } else {
            if (startPoint.time === finalPoint.time && startPoint.price === finalPoint.price) {
              return;
            }
            const finalLine = { id: Date.now(), start: startPoint, end: finalPoint };
            setTrendLines(prev => [...prev, finalLine]);
            setStartPoint(null);
            setIsDrawing(false);
            setDrawingStep(0);
          }
          return;
        }
      }

      const timeScale = chart.timeScale();
      let clickedOnHandle = null;
      for (const line of trendLines) {
        const startCoordX = timeScale.timeToCoordinate(line.start.time);
        const startCoordY = candlestickSeriesRef.current.priceToCoordinate(line.start.price);
        const endCoordX = timeScale.timeToCoordinate(line.end.time);
        const endCoordY = candlestickSeriesRef.current.priceToCoordinate(line.end.price);
        if (startCoordX === null || startCoordY === null || endCoordX === null || endCoordY === null) {
          continue;
        }
        const distToStart = Math.hypot(param.point.x - startCoordX, param.point.y - startCoordY);
        const distToEnd = Math.hypot(param.point.x - endCoordX, param.point.y - endCoordY);
        const clickRadius = 15;
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

    // --- NEW/MODIFIED: 마우스 이동 이벤트 핸들러 (미리보기 / 드래그) ---
    chart.subscribeCrosshairMove((param) => {
      if (param.point) {
        setIsCrosshairVisible(true);
      } else {
        setIsCrosshairVisible(false);
      }

      if (isProcessingCrosshairMove.current) return;
      try {
      isProcessingCrosshairMove.current = true;
      const { isDrawing, startPoint, draggingHandle, trendLines, isMobile, drawingStep } = drawingStateRef.current;

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
      
      // 유령선 및 드래그 로직
      if (param.point && param.time) {
          let price = candlestickSeriesRef.current.coordinateToPrice(param.point.y);
          if (price === null) return;
          let currentPoint = { time: param.time, price };
          
          // NEW: 현재 위치를 호버 ref에 실시간으로 저장 (탭 고정용)
          currentHoverPointRef.current = currentPoint;

          // 1. 추세선을 그리는 중일 때 (유령선 표시 및 점 이동)
          if (isDrawing) {
              if (isMobile) {
              // Mobile Drawing Logic: CrosshairMove는 점/선의 위치 미리보기 역할 (드래그 시 호출)
              if (drawingStep === 1) { // 1단계: 시작점 이동 프리뷰 (단일 점)
                  // 선을 숨기고 점(마커)만 보이도록 설정
                  ghostLineSeriesRef.current.applyOptions({ visible: true, lineVisible: false, pointMarkersVisible: true }); 
                  
                  // 🔥 BUG FIX: currentPoint의 'price'를 'value'로 매핑하여 전달합니다.
                  ghostLineSeriesRef.current.setData([{ time: currentPoint.time, value: currentPoint.price }]);
              } 
              else if (drawingStep === 2 && startPoint) { // 2단계: 끝점 이동 및 선 프리뷰
                  const points = [
                      { time: startPoint.time, value: startPoint.price },
                      { time: currentPoint.time, value: currentPoint.price },
                  ];
                  points.sort((a, b) => a.time - b.time);
                  
                  // 선과 점(마커)이 모두 보이도록 설정
                  ghostLineSeriesRef.current.applyOptions({ visible: true, lineVisible: true, pointMarkersVisible: true });
                  ghostLineSeriesRef.current.setData(points);
              }
              } else {
              // PC Drawing Logic: Ghost line from startPoint
              if (startPoint) {
                  if (startPoint.time !== param.time) {
                      const points = [
                      { time: startPoint.time, value: startPoint.price },
                      { time: param.time, value: price },
                      ];
                      points.sort((a, b) => a.time - b.time);
                      
                      // PC에서도 선과 점이 모두 보이도록 설정
                      ghostLineSeriesRef.current.applyOptions({ visible: true, lineVisible: true, pointMarkersVisible: true });
                      ghostLineSeriesRef.current.setData(points);
                  }
              }
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
          } else {
              // Not drawing/dragging: hide ghost line
              if (ghostLineSeriesRef.current) {
              ghostLineSeriesRef.current.setData([]);
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
  }, []); // isMobile 감지 로직을 별도의 useEffect로 분리했기 때문에, 여기서는 불필요한 의존성을 제거했습니다.

// --- MA 시리즈 제거 로직 (에러 로그 방지) ---
  // 이동평균선 업데이트
   useEffect(() => {
    // ⚠️ 경고: Strict Mode에서 두 번 실행될 때, chartRef.current가 null일 수 있으므로 반드시 확인합니다.
    if (!chartRef.current || !data.length) return;

    // 기존 이동평균선 제거 (안전하게)
    if (maSeriesRefs.current) {
      Object.entries(maSeriesRefs.current).forEach(([key, series]) => {
        // 시리즈가 존재하고 차트가 정의되었을 때만 제거 시도
        if (series && chartRef.current) {
          try {
            chartRef.current.removeSeries(series);
          } catch (error) {
            console.warn('Error removing series (Safe Mode):', error); 
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
            crosshairMarkerVisible: false, 
            lastValueVisible: false, 
            priceLineVisible: false, 
          });
          series.setData(maData);
          maSeriesRefs.current[maSetting.id] = series;
        } catch (error) {
          console.warn('Error adding MA series:', error);
        }
      }
    });

    // 🔥 FIX: 이동평균선이 미리보기 점 위를 덮었을 수 있으므로,
    // 그리기 모드일 경우 점을 다시 생성하여 최상위 레이어로 가져옵니다.
    const { isDrawing, drawingStep } = drawingStateRef.current;
    if (isDrawing && chartRef.current) {
      if (ghostLineSeriesRef.current) {
        // 기존 데이터를 임시로 저장해둡니다.
        const existingData = ghostLineSeriesRef.current.data();
        chartRef.current.removeSeries(ghostLineSeriesRef.current);
        
        // 현재 단계에 맞는 스타일을 결정합니다.
        const isStep2 = drawingStep === 2;
        const pointBG = isStep2 ? '#3B82F6' : '#FFFFFF';
        const pointBorder = isStep2 ? '#FFFFFF' : '#3B82F6';
        const lineColor = isStep2 ? 'rgba(59, 130, 246, 1)' : 'rgba(255, 255, 255, 1)';

        ghostLineSeriesRef.current = chartRef.current.addLineSeries({
          priceScaleId: 'right',
          color: lineColor,
          lineWidth: 2,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          pointMarkersVisible: true,
          pointMarkersRadius: 8,
          pointMarkersColor: pointBG,
          pointMarkersBorderColor: pointBorder,
          pointMarkersBorderWidth: 2,
        });

        // 저장해둔 데이터로 복원하여 점이 튀는 현상을 방지합니다.
        if (existingData.length > 0) {
          ghostLineSeriesRef.current.setData(existingData);
        }
      }
    }
  }, [maSettings, data.length]);

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
        // 영구적인 선에도 점 마커 옵션을 적용하여 끝점을 강조
        pointMarkersVisible: isSelected, // 선택된 선만 끝점을 표시
        pointMarkersRadius: 6,
        pointMarkersColor: isSelected ? '#3b82f6' : '#f9ca24',
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

    // --- 기존 라인들 모두 제거 ---
    // 청산가 라인 제거
    if (priceLineRef.current) {
        candlestickSeriesRef.current.removePriceLine(priceLineRef.current);
        priceLineRef.current = null;
    }
    // 매수가 라인 제거
    if (entryPriceLineRef.current) {
        candlestickSeriesRef.current.removePriceLine(entryPriceLineRef.current);
        entryPriceLineRef.current = null;
    }

    // --- 포지션이 있을 경우 새 라인들 생성 ---
    if (position) {
      // 1. 평균 매수가(avgPrice) 라인 생성 (신규 추가)
      if (position.avgPrice) {
        entryPriceLineRef.current = candlestickSeriesRef.current.createPriceLine({
          price: position.avgPrice,
          color: '#3b82f6', // 파란색
          lineWidth: 2,
          lineStyle: 2, // 1: Dotted (점선)
          axisLabelVisible: true,
          title: '매수가',
        });
      }

      // 2. 청산가(liquidationPrice) 라인 생성 (기존 로직)
      if (position.liquidationPrice) {
        priceLineRef.current = candlestickSeriesRef.current.createPriceLine({
          price: position.liquidationPrice,
          color: '#ef4444', // 빨간색
          lineWidth: 2,
          lineStyle: 2, // 2: Dashed (대시선)
          axisLabelVisible: true,
          title: '청산가',
        });
      }
    }
  }, [position]); // position 객체가 변경될 때마다 실행

  // 항상 최신 현재가를 표시하는 라인 업데이트
  useEffect(() => {
    // latestCandle이 없거나, 차트 시리즈가 준비되지 않았다면 실행하지 않습니다.
    if (!candlestickSeriesRef.current || !latestCandle) return;

    // 이전에 그렸던 현재가 라인이 있다면 제거합니다.
    if (currentPriceLineRef.current) {
      candlestickSeriesRef.current.removePriceLine(currentPriceLineRef.current);
      currentPriceLineRef.current = null;
    }

    // 캔들의 상승/하락 여부를 판단합니다.
    const isUp = latestCandle.close >= latestCandle.open;
    const lineColor = isUp ? '#10b981' : '#ef4444'; // 상승은 초록색, 하락은 빨간색

    // 유효한 현재가가 있을 때만 새로운 라인을 그립니다.
    if (latestCandle.close > 0) {
      currentPriceLineRef.current = candlestickSeriesRef.current.createPriceLine({
        price: latestCandle.close,
        color: lineColor, // 동적으로 결정된 색상 적용
        lineWidth: 1,
        lineStyle: 2, // 대시선(Dashed) 스타일
        axisLabelVisible: true,
        title: '현재가',
      });
    }
  }, [latestCandle]); // 의존성 배열을 latestCandle로 변경합니다.

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
    
    // customFormatDate와 동일한 로직을 적용하여 포맷을 통일합니다.
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}.${month}.${day} ${hour}:${minute}`;
  };

  const getDataPeriodInfo = () => {
    if (!data || data.length === 0) return '';
    
    const firstCandle = data[0];
    const lastCandle = data[data.length - 1];
    
    if (!firstCandle?.timestamp || !lastCandle?.timestamp) return '';
    
    const startDate = new Date(firstCandle.timestamp);
    const endDate = new Date(lastCandle.timestamp);
    
    // 사용자 정의 포맷 함수
    const customFormatDate = (date) => {
      const year = date.getFullYear();
      // getMonth()는 0부터 시작하므로 +1, 두 자릿수 포맷을 위해 padStart 사용
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hour = String(date.getHours()).padStart(2, '0');
      const minute = String(date.getMinutes()).padStart(2, '0');
      
      // 'YYYY.MM.DD HH:MM' 형식으로 반환
      return `${year}.${month}.${day} ${hour}:${minute}`;
    };
    
    // 수정된 customFormatDate 함수를 사용하여 기간 정보를 반환
    return `${customFormatDate(startDate)} ~ ${customFormatDate(endDate)}`;
  };

  const getCurrentVolumeInfo = () => {
    if (!data || data.length === 0) return '';
    const currentCandle = data[data.length - 1];
    return currentCandle ? formatVolume(currentCandle.volume) : '';
  };

  const renderCandleInfo = () => {
    const currentMAValues = getCurrentMAValues();
    
    if (!hoveredCandle) {
      // currentPrice 대신 latestCandle에서 가격 정보를 가져옵니다.
      const currentPrice = latestCandle ? latestCandle.close : 0;
      // 캔들 색상과 동일한 로직으로 텍스트 색상을 결정합니다.
      const priceColorClass = latestCandle && latestCandle.close >= latestCandle.open ? 'text-green' : 'text-red';
      
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
      <div className="mb-4" style={{ minHeight: '80px' }}>
        <div className="flex justify-between items-start mb-2">
          <div style={{ flex: 1 }}>
            {renderCandleInfo()}
          </div>

          {(!isCrosshairVisible || !isMobile) && (
            <div className="flex items-center gap-2">
              <button
                className={`btn btn-sm ${isDrawing ? 'btn-danger' : 'btn-secondary'}`}
                onClick={toggleDrawingMode}
                style={{ marginLeft: '8px', padding: '8px' }}
              >
                <PenLine size={16} />
                {isDrawing ? (isMobile ? `(${drawingStep == 1 ? "시작점" : "끝점"}) 취소` : '취소') : '추세선'}
              </button>
              <button
                className="btn btn-sm btn-secondary"
                onClick={handleDeleteLastLine}
                style={{ marginLeft: '8px', padding: '8px' }}
              >
                <Trash2 size={16} />
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowSettings(!showSettings)}
                style={{ marginLeft: '8px', padding: '8px' }}
              >
                <Settings size={16} />
              </button>
            </div>
          )}
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
      
      <div ref={chartContainerRef} style={{ width: '100%', height: '100%', minHeight: '480px' }} />
    </div>
  );
};

export default Chart;