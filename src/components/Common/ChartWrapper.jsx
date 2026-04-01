import { useState, useEffect, useRef, cloneElement } from 'react';

export default function ChartWrapper({ height = 280, children }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      const w = containerRef.current?.offsetWidth ?? 0;
      if (w > 0) setWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: `${height}px`, minHeight: `${height}px` }}>
      {width > 0 && cloneElement(children, { width, height })}
    </div>
  );
}
