import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { api, mediaUrl } from "../lib/api";
import { safeError } from "../lib/format";
import { cn } from "./ui";

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف."));
    reader.readAsDataURL(file);
  });
}

function validate(file: File): string | null {
  if (!/^image\/(jpeg|png|webp|gif|svg\+xml)$/.test(file.type)) return "اختر صورة بصيغة JPG أو PNG أو WebP أو GIF أو SVG.";
  if (file.size > 5 * 1024 * 1024) return "حجم الصورة يجب أن يكون أقل من 5 ميجابايت.";
  return null;
}

export function ImageUploader({
  value,
  onChange,
  label = "صورة",
  hint = "JPG / PNG / WebP — بحد أقصى 5 ميجابايت",
  className,
  aspect = "aspect-square",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  className?: string;
  aspect?: string;
  /** @deprecated uploads now follow the shared theme tokens automatically. */
  dark?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    const invalid = validate(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    setUploading(true);
    try {
      const dataBase64 = await readAsBase64(file);
      const result = await api.media.upload({ fileName: file.name, mimeType: file.type, dataBase64 });
      onChange(result.media.url);
    } catch (err: any) {
      setError(safeError(err) || "تعذر رفع الصورة.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="text-xs font-semibold text-ink-soft">{label}</div>
      <div
        className={cn(
          "group relative flex items-center justify-center overflow-hidden rounded-brand border-2 border-dashed border-line bg-surface transition",
          aspect,
          !value && "hover:border-brand-line"
        )}
      >
        {value ? (
          <>
            <img src={mediaUrl(value)} alt={label} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-overlay opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="rounded-brand-sm bg-card p-2 text-ink shadow-brand-card"
                title="تغيير الصورة"
              >
                <UploadCloud className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange("")}
                className="rounded-brand-sm bg-danger p-2 text-on-danger"
                title="حذف الصورة"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            {uploading ? <Loader2 className="h-6 w-6 animate-spin text-brand" /> : <ImagePlus className="h-7 w-7 text-subtle" />}
            <span className="text-xs font-semibold text-ink-soft">{uploading ? "جارٍ الرفع…" : "رفع صورة"}</span>
            <span className="text-[10px] text-subtle">{hint}</span>
          </button>
        )}
        {uploading && value ? <div className="absolute inset-0 flex items-center justify-center bg-overlay"><Loader2 className="h-6 w-6 animate-spin text-white" /></div> : null}
      </div>
      {error ? <div className="text-[11px] text-danger">{error}</div> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="أو ألصق رابط الصورة"
        className="input-control h-9 text-[11px]"
      />
    </div>
  );
}

export function MultiImageUploader({
  value,
  onChange,
  max = 8,
  label = "صور المنتج",
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (files: FileList) => {
    const remaining = max - value.length;
    if (remaining <= 0) return;
    setError("");
    setUploading(true);
    const next = [...value];
    try {
      for (const file of Array.from(files).slice(0, remaining)) {
        const invalid = validate(file);
        if (invalid) {
          setError(invalid);
          continue;
        }
        const dataBase64 = await readAsBase64(file);
        const result = await api.media.upload({ fileName: file.name, mimeType: file.type, dataBase64 });
        next.push(result.media.url);
      }
      onChange(next);
    } catch (err: any) {
      setError(safeError(err) || "تعذر رفع الصور.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-ink-soft">{label}</div>
        <div className="text-[11px] text-subtle">{value.length}/{max}</div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((url, index) => (
          <div key={`${url}-${index}`} className="group relative aspect-square overflow-hidden rounded-brand border border-line bg-surface">
            <img src={mediaUrl(url)} alt={`صورة ${index + 1}`} className="h-full w-full object-cover" />
            {index === 0 ? <span className="absolute start-1 top-1 rounded-brand-sm bg-brand px-1.5 py-0.5 text-[9px] font-bold text-on-brand">رئيسية</span> : null}
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-overlay opacity-0 transition group-hover:opacity-100">
              {index > 0 ? (
                <button
                  type="button"
                  className="rounded-brand-sm bg-card px-2 py-1 text-[10px] font-bold text-ink"
                  onClick={() => {
                    const next = [...value];
                    [next[0], next[index]] = [next[index], next[0]];
                    onChange(next);
                  }}
                >
                  اجعلها رئيسية
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-brand-sm bg-danger p-1.5 text-on-danger"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {value.length < max ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-brand border-2 border-dashed border-line bg-surface text-subtle transition hover:border-brand-line hover:text-brand"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="text-[10px] font-semibold">{uploading ? "جارٍ الرفع" : "إضافة صور"}</span>
          </button>
        ) : null}
      </div>
      {error ? <div className="text-[11px] text-danger">{error}</div> : null}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
        }}
      />
    </div>
  );
}
