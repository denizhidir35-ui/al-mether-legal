import { ImageResponse } from "next/og";

export const alt = "AL METHER Legal avukat yazılımı";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "74px 82px", background: "radial-gradient(circle at 78% 18%, rgba(200,164,95,0.23), transparent 34%), linear-gradient(135deg, #050811 0%, #0e1521 100%)", color: "#f5f2eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div style={{ width: "58px", height: "58px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(200,164,95,0.55)", borderRadius: "16px", color: "#d9b86e", fontSize: "28px", fontWeight: 800 }}>M</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "25px", fontWeight: 800, letterSpacing: "0.08em" }}>AL METHER</span>
            <span style={{ marginTop: "5px", color: "#c8a45f", fontSize: "15px", letterSpacing: "0.28em" }}>LEGAL</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: "920px" }}>
          <span style={{ color: "#d9b86e", fontSize: "20px", letterSpacing: "0.14em" }}>AVUKATLAR İÇİN DİJİTAL ÇALIŞMA ALANI</span>
          <span style={{ marginTop: "22px", fontSize: "62px", fontWeight: 700, lineHeight: 1.08, letterSpacing: "-0.035em" }}>Dava, süre ve tebligat takibi tek yerde.</span>
        </div>
        <div style={{ display: "flex", gap: "26px", color: "#aab1bd", fontSize: "18px" }}>
          <span>Dava Takibi</span><span>•</span><span>Hukuki Süreler</span><span>•</span><span>UYAP &amp; UETS</span>
        </div>
      </div>
    ),
    size
  );
}
