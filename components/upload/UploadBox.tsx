// components/upload/UploadBox.tsx

"use client";

import { useRef, useState } from "react";

import { supabase } from "@/services/supabase";

export default function UploadBox({
  selectedCase,
}: any) {
  const fileInputRef =
    useRef<any>(null);

  const [uploading, setUploading] =
    useState(false);

  const [uploadedFile, setUploadedFile] =
    useState("");

  async function handleUpload(
    e: any
  ) {
    try {
      const file =
        e.target.files?.[0];

      if (!file) return;

      if (!selectedCase) {
        alert(
          "Önce dava seç."
        );

        return;
      }

      setUploading(true);

      const fileName = `${Date.now()}-${
        file.name
      }`;

      const { error } =
        await supabase.storage
          .from("case-files")
          .upload(
            fileName,
            file
          );

      if (error) {
        console.log(error);

        alert(
          "Dosya yüklenemedi."
        );

        return;
      }

      const { data } =
        supabase.storage
          .from("case-files")
          .getPublicUrl(
            fileName
          );

      await supabase
        .from("case_files")
        .insert([
          {
            case_id:
              selectedCase.id,

            file_name:
              file.name,

            file_url:
              data.publicUrl,
          },
        ]);

      setUploadedFile(
        file.name
      );

      alert(
        "Dosya başarıyla yüklendi."
      );
    } catch (error) {
      console.log(error);

      alert("Upload hatası.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      style={{
        background:
          "rgba(15,23,42,0.78)",

        border:
          "1px solid rgba(255,255,255,0.05)",

        borderRadius: 18,

        padding: 16,
      }}
    >
      <h2
        style={{
          color: "white",

          marginTop: 0,

          marginBottom: 8,

          fontSize: 18,
        }}
      >
        📂 Dava Dosyası
      </h2>

      <p
        style={{
          color: "#94a3b8",

          fontSize: 12,

          marginBottom: 16,
        }}
      >
        PDF, DOCX, XLSX,
        PNG, JPG, ZIP, UDF
      </p>

      <button
        onClick={() =>
          fileInputRef.current.click()
        }
        disabled={uploading}
        style={{
          width: "100%",

          background:
            "linear-gradient(to right,#2563eb,#3b82f6)",

          border: "none",

          color: "white",

          padding: "13px",

          borderRadius: 12,

          fontWeight: 700,

          cursor: "pointer",

          fontSize: 14,
        }}
      >
        {uploading
          ? "Yükleniyor..."
          : "📤 Dosya Yükle"}
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleUpload}
        hidden
      />

      {uploadedFile && (
        <div
          style={{
            marginTop: 14,

            background:
              "#020617",

            border:
              "1px solid rgba(255,255,255,0.05)",

            borderRadius: 12,

            padding: 12,

            color: "white",

            fontSize: 13,
          }}
        >
          ✅ {uploadedFile}
        </div>
      )}
    </div>
  );
}