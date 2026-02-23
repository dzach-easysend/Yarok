/**
 * Web-only: horizontal scroll container with click-and-drag to scroll
 * (so the report card image strip can be swiped with the mouse).
 */

import { useRef, useCallback, useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  contentContainerStyle?: React.CSSProperties;
  testID?: string;
};

export default function HorizontalDragScrollView({
  children,
  style,
  contentContainerStyle,
  testID,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null);
  const didDragRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !scrollRef.current) return;
    didDragRef.current = false;
    dragRef.current = {
      startX: e.clientX,
      startScrollLeft: scrollRef.current.scrollLeft,
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
      const dx = d.startX - e.clientX;
      if (Math.abs(dx) > 3) didDragRef.current = true;
      el.scrollLeft = d.startScrollLeft + dx;
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
        overflowX: "auto",
        overflowY: "hidden",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        WebkitOverflowScrolling: "touch",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          ...contentContainerStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
}
