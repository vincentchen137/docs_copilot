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
  const [ingestPassword, setIngestPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState(true);

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

  async function verifyPassword() {
    const password = ingestPassword.trim();

    if (!password) {
      setAuthError("Missing password.");
      return;
    }

    setAuthError(null);

    try {
      const res = await fetch("/api/ingest/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        setIsDisabled(false);
      } else {
        const json = await res.json().catch(() => ({}));
        setAuthError(json.error ?? "Invalid or missing ingest password.");
      }

    } catch {
      setAuthError("Could not verify password.");
    }
  }

  function handleIngestPasswordKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") verifyPassword();
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("password", ingestPassword.trim());

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (res.status === 401) {
        const json = await res.json().catch(() => ({}));
        setAuthError(json.error ?? "Invalid or missing ingest password.");
        return;
      }

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(`Ingest failed: ${json.error ?? res.statusText}`);
      } else {
        setAuthError(null);
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
      <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-4">
        <div className="w-full">
          <label htmlFor="ingest-password" className="block text-left text-sm font-medium text-gray-700">
            Ingest password
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="ingest-password"
              type="password"
              value={ingestPassword}
              onChange={(e) => {
                setIngestPassword(e.target.value);
                setAuthError(null);
              }}
              onKeyDown={handleIngestPasswordKeyDown}
              placeholder="Required to upload documents"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={verifyPassword}
              className="shrink-0 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-1"
            >
              Sign In
            </button>
          </div>
          {authError && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {authError}
            </p>
          )}
        </div>
        {(() => {
          return (
            <label
              className={
                isDisabled
                  ? "cursor-not-allowed pointer-events-none"
                  : "cursor-pointer"
              }
            >
              <span
                className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isDisabled
                    ? "bg-gray-300 text-gray-500"
                    : "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-600"
                }`}
              >
                {uploading ? "Ingesting…" : "Ingest / Input New Documents"}
              </span>
              <input
                type="file"
                accept=".md,text/markdown"
                className="hidden"
                onChange={handleUpload}
                disabled={isDisabled}
              />
            </label>
          );
        })()}
      </div>
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
