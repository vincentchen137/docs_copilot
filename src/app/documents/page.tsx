"use client";

import { useState, useEffect } from "react";

type DocumentItem = {
  key: string;
  name: string;
  viewUrl: string;
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function fetchDocuments() {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (res.ok) setDocuments(data.documents ?? []);
      else setDocuments([]);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDocuments();
  }, []);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(`Ingest failed: ${json.error ?? res.statusText}`);
      } else {
        await fetchDocuments();
      }
    } catch {
      alert("Ingest failed.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center px-4 py-12">
      <h1 className="text-2xl font-semibold text-gray-900">Documents</h1>
      <label className="mt-8 cursor-pointer">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2 disabled:opacity-50">
          {uploading ? "Ingesting…" : "Ingest / Input New Documents"}
        </span>
        <input
          type="file"
          accept=".md,text/markdown"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>

      <div className="mt-10 w-full max-w-xl">
        {loading ? (
          <p className="text-center text-sm text-gray-500">Loading documents…</p>
        ) : documents.length === 0 ? (
          <p className="text-center text-sm text-gray-500">No documents ingested yet.</p>
        ) : (
          <ul className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
            {documents.map((doc) => (
              <li key={doc.key} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 shadow-sm">
                <span className="min-w-0 truncate text-sm text-gray-900" title={doc.name}>
                  {doc.name}
                </span>
                <a
                  href={doc.viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-600/30 focus:ring-offset-1"
                >
                  View
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
