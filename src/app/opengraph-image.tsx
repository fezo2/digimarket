import { ImageResponse } from "next/og";

export const alt = "Digiegy - ديجي مصر";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default share card. Text is Latin only: the OG renderer can't shape Arabic.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #1a0b38, #6d28d9)",
          color: "white",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800 }}>Digiegy</div>
        <div style={{ fontSize: 40, marginTop: 24, opacity: 0.9 }}>
          Digital products from verified sellers in Egypt
        </div>
        <div style={{ fontSize: 32, marginTop: 48, opacity: 0.8 }}>digiegy.com</div>
      </div>
    ),
    size,
  );
}
