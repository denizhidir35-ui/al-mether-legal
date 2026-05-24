import "./globals.css";

export const metadata = {
  title: "AL Mether Legal",
  description: "AI Hukuk Operasyon Sistemi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "#020617",
          color: "white",
          fontFamily:
            "Arial, Helvetica, sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}