/** Inline script – spustí měření prolnutí při parsování HTML, ještě před Reactem */
export function ProlnutiCasOtevreniScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: "window.__TREBON_PROLNUTI_T0=performance.now();",
      }}
    />
  );
}
