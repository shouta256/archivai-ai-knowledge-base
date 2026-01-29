"use client";

import { useCallback, useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { getStroke } from "perfect-freehand";

/**
 * InkCanvas - Hardware-accurate handwriting capture for Apple Pencil
 * 
 * This component captures raw stylus input without iOS handwriting correction.
 * It uses the Pointer Events API to directly access Apple Pencil pressure,
 * tilt, and other hardware data.
 * 
 * Key features:
 * - Real pressure sensitivity from Apple Pencil (not simulated)
 * - Raw stroke data without iOS text recognition/correction
 * - Exports strokes as JSON for database storage
 * - Exports canvas as PNG for Gemini Vision processing
 */

// Stroke point with pressure and timing data
export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
  timestamp: number;
}

// A single stroke (pen down -> pen up)
export interface InkStroke {
  id: string;
  points: InkPoint[];
  color: string;
  size: number;
}

// Complete ink data for export
export interface InkData {
  strokes: InkStroke[];
  width: number;
  height: number;
  createdAt: string;
  devicePixelRatio: number;
}

// Ref handle for external control
export interface InkCanvasHandle {
  clear: () => void;
  undo: () => void;
  exportInkData: () => InkData;
  exportAsPng: () => Promise<Blob | null>;
}

interface InkCanvasProps {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeSize?: number;
  backgroundColor?: string;
  onStrokesChange?: (strokes: InkStroke[]) => void;
  className?: string;
}

// perfect-freehand options for natural handwriting
// Setting simulatePressure to false uses real Apple Pencil pressure
const getStrokeOptions = (size: number) => ({
  size,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  easing: (t: number) => t,
  start: {
    taper: 0,
    cap: true,
  },
  end: {
    taper: 0,
    cap: true,
  },
  simulatePressure: false, // CRITICAL: Use real pressure from Apple Pencil
});

// Convert perfect-freehand points to SVG path
function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
}

// Generate unique ID for strokes
function generateStrokeId(): string {
  return `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export const InkCanvas = forwardRef<InkCanvasHandle, InkCanvasProps>(function InkCanvas({
  width = 800,
  height = 600,
  strokeColor = "#000000",
  strokeSize = 4,
  backgroundColor = "#ffffff",
  onStrokesChange,
  className = "",
}, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<InkStroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPointRef = useRef<InkPoint | null>(null);

  // Notify parent of stroke changes
  useEffect(() => {
    onStrokesChange?.(strokes);
  }, [strokes, onStrokesChange]);

  // Handle pointer down - start new stroke
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      // Only respond to pen input for authentic stylus experience
      // Remove this check if you want mouse/touch support too
      // if (e.pointerType !== "pen") return;

      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);

      const rect = e.currentTarget.getBoundingClientRect();
      const point: InkPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure || 0.5, // Fallback for non-pressure devices
        tiltX: e.tiltX,
        tiltY: e.tiltY,
        timestamp: Date.now(),
      };

      const newStroke: InkStroke = {
        id: generateStrokeId(),
        points: [point],
        color: strokeColor,
        size: strokeSize,
      };

      setCurrentStroke(newStroke);
      setIsDrawing(true);
      lastPointRef.current = point;
    },
    [strokeColor, strokeSize]
  );

  // Handle pointer move - add points to current stroke
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing || !currentStroke) return;

      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      
      // Coalesced events give us more points for smoother strokes
      const events = e.nativeEvent.getCoalescedEvents?.() || [e.nativeEvent];
      
      const newPoints: InkPoint[] = events.map((evt) => ({
        x: evt.clientX - rect.left,
        y: evt.clientY - rect.top,
        pressure: evt.pressure || 0.5,
        tiltX: evt.tiltX,
        tiltY: evt.tiltY,
        timestamp: Date.now(),
      }));

      setCurrentStroke((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, ...newPoints],
        };
      });

      lastPointRef.current = newPoints[newPoints.length - 1];
    },
    [isDrawing, currentStroke]
  );

  // Handle pointer up - finish stroke
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDrawing || !currentStroke) return;

      e.preventDefault();
      e.currentTarget.releasePointerCapture(e.pointerId);

      // Add final point
      const rect = e.currentTarget.getBoundingClientRect();
      const finalPoint: InkPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure || 0.5,
        tiltX: e.tiltX,
        tiltY: e.tiltY,
        timestamp: Date.now(),
      };

      const finalStroke: InkStroke = {
        ...currentStroke,
        points: [...currentStroke.points, finalPoint],
      };

      setStrokes((prev) => [...prev, finalStroke]);
      setCurrentStroke(null);
      setIsDrawing(false);
      lastPointRef.current = null;
    },
    [isDrawing, currentStroke]
  );

  // Handle pointer cancel - discard current stroke
  const handlePointerCancel = useCallback(() => {
    setCurrentStroke(null);
    setIsDrawing(false);
    lastPointRef.current = null;
  }, []);

  // Clear all strokes
  const clear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke(null);
  }, []);

  // Undo last stroke
  const undo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  // Export ink data as JSON
  const exportInkData = useCallback((): InkData => {
    return {
      strokes,
      width,
      height,
      createdAt: new Date().toISOString(),
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    };
  }, [strokes, width, height]);

  // Export canvas as PNG blob
  const exportAsPng = useCallback(async (): Promise<Blob | null> => {
    if (!svgRef.current) return null;

    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.scale(dpr, dpr);
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(url);
          resolve(blob);
        }, "image/png");
      };
      img.src = url;
    });
  }, [width, height, backgroundColor]);

  // Render a stroke as SVG path
  const renderStroke = useCallback((stroke: InkStroke) => {
    const points = stroke.points.map((p) => [p.x, p.y, p.pressure] as [number, number, number]);
    const outlinePoints = getStroke(points, getStrokeOptions(stroke.size));
    const pathData = getSvgPathFromStroke(outlinePoints);

    return (
      <path
        key={stroke.id}
        d={pathData}
        fill={stroke.color}
        stroke="none"
      />
    );
  }, []);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    clear,
    undo,
    exportInkData,
    exportAsPng,
  }), [clear, undo, exportInkData, exportAsPng]);

  return (
    <div className={`relative ${className}`}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="cursor-crosshair"
        style={{
          backgroundColor,
          touchAction: "none", // Prevent browser touch behaviors
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Render completed strokes */}
        {strokes.map(renderStroke)}
        
        {/* Render current stroke being drawn */}
        {currentStroke && renderStroke(currentStroke)}
      </svg>

      {/* Stroke count indicator */}
      <div className="absolute bottom-2 left-2 text-xs text-gray-500">
        {strokes.length} stroke{strokes.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
});

// Hook for using InkCanvas with ref
export function useInkCanvas() {
  const canvasRef = useRef<InkCanvasHandle>(null);

  const clear = useCallback(() => {
    canvasRef.current?.clear();
  }, []);

  const undo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  const exportInkData = useCallback(() => {
    return canvasRef.current?.exportInkData();
  }, []);

  const exportAsPng = useCallback(async () => {
    return canvasRef.current?.exportAsPng();
  }, []);

  return {
    canvasRef,
    clear,
    undo,
    exportInkData,
    exportAsPng,
  };
}
