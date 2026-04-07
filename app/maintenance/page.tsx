export default function MaintenancePage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#fff",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>
        Coming Soon
      </h1>
      <p style={{ color: "#888", maxWidth: "400px", lineHeight: 1.6 }}>
        We&apos;re putting the finishing touches on something great. Check back soon.
      </p>
    </div>
  );
}
