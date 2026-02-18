/**
 * Web-only: scrollable container that supports wheel scroll and click-and-drag to scroll
 * (for consistency with map pan on web). Native uses DragScrollView.tsx (passthrough).
 */

import { useRef, useCallback, useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  contentContainerStyle?: React.CSSProperties;
  testID?: string;
};

export default function DragScrollView({
  children,
  style,
  contentContainerStyle,
  testID,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startScrollTop: number } | null>(null);
  const didDragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !scrollRef.current) return;
    didDragRef.current = false;
    dragRef.current = {
      startY: e.clientY,
      startScrollTop: scrollRef.current.scrollTop,
    };
    setIsDragging(true);
  }, []);

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (didDragRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didDragRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      const el = scrollRef.current;
      if (!d || !el) return;
      const dy = d.startY - e.clientY;
      if (Math.abs(dy) > 3) didDragRef.current = true;
      el.scrollTop = d.startScrollTop + dy;
    };
    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", onUp);
    };
  }, []);

  return (
    <div
      ref={scrollRef}
      data-testid={testID}
      onMouseDown={handleMouseDown}
      onClickCapture={handleClickCapture}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        ...style,
      }}
    >
      <div style={{ ...contentContainerStyle }}>{children}</div>
    </div>
  );
}
