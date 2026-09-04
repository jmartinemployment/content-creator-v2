import { ImageResponse } from "next/og";

/** App Router metadata icon — satisfies /favicon.ico requests on Vercel. */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f8fafc",
          fontSize: 20,
          fontWeight: 700,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        Φ
      </div>
    ),
    { ...size },
  );
}
