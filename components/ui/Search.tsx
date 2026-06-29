"use client";

import React from "react";
import Input from "./Input";

type SearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function Search({
  value,
  onChange,
  placeholder = "Ara...",
}: SearchProps) {
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          left: 14,
          top: 13,
          color: "#64748b",
          fontSize: 16,
        }}
      >
        ⌘
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: 42 }}
      />
    </div>
  );
}
