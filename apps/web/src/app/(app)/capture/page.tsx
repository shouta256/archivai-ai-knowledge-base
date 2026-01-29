"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InkCanvas, type InkCanvasHandle, type InkStroke } from "@/components/ink-canvas";
import { Pencil, Undo, Trash2, Save, Check, Loader2 } from "lucide-react";

export default function CapturePage() {
  const [strokes, setStrokes] = useState<InkStroke[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [strokeSize, setStrokeSize] = useState(4);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Ref to access canvas methods
  const canvasRef = useRef<InkCanvasHandle>(null);

  // Responsive canvas sizing
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.clientWidth - 2, 800); // -2 for border
        const height = Math.round(width * 0.625); // 5:8 aspect ratio
        setCanvasSize({ width, height });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Handle stroke changes from canvas
  const handleStrokesChange = useCallback((newStrokes: InkStroke[]) => {
    setStrokes(newStrokes);
    setSaved(false);
    setError(null);
  }, []);

  // Clear canvas
  const handleClear = useCallback(() => {
    if (canvasRef.current?.clear) {
      canvasRef.current.clear();
    }
    setStrokes([]);
  }, []);

  // Undo last stroke
  const handleUndo = useCallback(() => {
    if (canvasRef.current?.undo) {
      canvasRef.current.undo();
    }
  }, []);

  // Save ink note
  const handleSave = useCallback(async () => {
    if (!canvasRef.current || strokes.length === 0) {
      setError("Nothing to save");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Get ink data and PNG
      const inkData = canvasRef.current.exportInkData();
      const pngBlob = await canvasRef.current.exportAsPng();

      if (!pngBlob) {
        throw new Error("Failed to generate image");
      }

      // Create form data
      const formData = new FormData();
      formData.append("inkData", JSON.stringify(inkData));
      formData.append("image", pngBlob, `ink_${Date.now()}.png`);

      // Send to API
      const response = await fetch("/api/ingest/ink", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save");
      }

      setSaved(true);
      
      // Clear canvas after successful save
      setTimeout(() => {
        handleClear();
        setSaved(false);
      }, 2000);
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [strokes, handleClear]);

  // Color palette
  const colors = [
    "#000000", // Black
    "#374151", // Gray
    "#1d4ed8", // Blue
    "#059669", // Green
    "#dc2626", // Red
    "#9333ea", // Purple
    "#d97706", // Orange
  ];

  // Stroke sizes
  const sizes = [2, 4, 6, 8];

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Handwriting Capture
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Write with Apple Pencil. Your handwriting will be saved as-is without any text correction.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-4 pb-2 border-b">
            {/* Colors */}
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground mr-1">Color:</span>
              {colors.map((color) => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    strokeColor === color
                      ? "border-blue-500 scale-110"
                      : "border-gray-300"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setStrokeColor(color)}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>

            {/* Stroke size */}
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground mr-1">Size:</span>
              {sizes.map((size) => (
                <button
                  key={size}
                  className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${
                    strokeSize === size
                      ? "bg-blue-100 border-blue-500"
                      : "bg-white border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => setStrokeSize(size)}
                  aria-label={`Select size ${size}`}
                >
                  <div
                    className="rounded-full bg-current"
                    style={{
                      width: size * 2,
                      height: size * 2,
                      backgroundColor: strokeColor,
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={strokes.length === 0}
              >
                <Undo className="h-4 w-4 mr-1" />
                Undo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={strokes.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <div ref={containerRef} className="border rounded-lg overflow-hidden bg-white">
            <InkCanvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              strokeColor={strokeColor}
              strokeSize={strokeSize}
              backgroundColor="#ffffff"
              onStrokesChange={handleStrokesChange}
              className="w-full"
            />
          </div>

          {/* Status */}
          {error && (
            <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm text-muted-foreground">
              {strokes.length} stroke{strokes.length !== 1 ? "s" : ""}
            </span>
            
            <Button
              onClick={handleSave}
              disabled={strokes.length === 0 || isSaving}
              className="min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Note
                </>
              )}
            </Button>
          </div>

          {/* Instructions */}
          <div className="text-xs text-muted-foreground bg-gray-50 p-3 rounded">
            <p className="font-medium mb-1">Tips:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>Use Apple Pencil for best results with pressure sensitivity</li>
              <li>Your handwriting is saved exactly as written - no auto-correction</li>
              <li>Notes will be analyzed by AI to extract text content</li>
              <li>Tap Undo to remove the last stroke</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
