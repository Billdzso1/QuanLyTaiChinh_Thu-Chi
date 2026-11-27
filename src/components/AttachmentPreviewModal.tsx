"use client";

import React from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";

interface AttachmentPreviewModalProps {
  url: string | null;
  title?: string;
  onClose: () => void;
}

export function isImageUrl(url: string): boolean {
  const clean = url.split("?")[0].toLowerCase();
  const fileParam = new URLSearchParams(url.split("?")[1] || "").get("file")?.toLowerCase() || "";
  const target = fileParam || clean;
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(target);
}

export function isPdfUrl(url: string): boolean {
  const clean = url.split("?")[0].toLowerCase();
  const fileParam = new URLSearchParams(url.split("?")[1] || "").get("file")?.toLowerCase() || "";
  const target = fileParam || clean;
  return /\.pdf$/i.test(target);
}

export function AttachmentPreviewModal({ url, title = "Xem chứng từ / Tệp đính kèm", onClose }: AttachmentPreviewModalProps) {
  if (!url) return null;

  const isImg = isImageUrl(url);
  const isPdf = isPdfUrl(url);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-3xl w-full p-4 space-y-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="font-bold text-sm text-neutral-900">{title}</div>
          <div className="flex items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-neutral-300 hover:bg-neutral-100 text-xs font-medium text-neutral-700"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Mở tab mới
            </a>
            <a
              href={url}
              download
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" /> Tải xuống
            </a>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-neutral-100 cursor-pointer" title="Đóng">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isImg ? (
          <img src={url} alt={title} className="w-full max-h-[72vh] object-contain rounded-lg border border-neutral-200 bg-neutral-50" />
        ) : isPdf ? (
          <iframe
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            title={title}
            className="w-full h-[75vh] rounded-lg border border-neutral-200 bg-white"
          />
        ) : (
          <div className="py-12 text-center border border-dashed border-neutral-300 rounded-xl bg-neutral-50 space-y-3">
            <FileText className="w-10 h-10 text-amber-600 mx-auto" />
            <div className="text-sm font-medium text-neutral-700">
              Tệp đính kèm không hỗ trợ xem trực tiếp trên trình duyệt
            </div>
            <a
              href={url}
              download
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-950 text-amber-400 border border-amber-500 text-xs font-medium"
            >
              <Download className="w-4 h-4" /> Tải tệp về máy
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
