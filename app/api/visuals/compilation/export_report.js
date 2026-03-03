document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("export-report");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Exporting...";
    console.log("Export started...");

    const reportSections = [];

    // --- 1️⃣ Create dynamic SVG header ---
    try {
      const p1El = document.getElementById("player1");
      const p2El = document.getElementById("player2");
      const player1 = p1El?.textContent || "Player 1";
      const player2 = p2El?.textContent || "Player 2";
      const setScores = document.getElementById("setScores")?.textContent || "0 - 0";
      const eventName = document.getElementById("eventName")?.textContent || "Event Name";
      const eventDate = document.getElementById("eventDate")?.textContent || "Date";

      const p1Winner = p1El?.classList.contains("winner");
      const p2Winner = p2El?.classList.contains("winner");

      // Measure text width for dynamic SVG sizing
      function getTextWidth(text, font) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.font = font;
        return ctx.measureText(text).width;
      }

      const padding = 40;
      const fontPlayers = "36px 'DM Sans'";
      const fontSet = "24px 'DM Sans'";
      const fontEvent = "20px 'DM Sans'";

      const widthPlayers = getTextWidth(`${player1} vs ${player2}`, fontPlayers);
      const widthSet = getTextWidth(setScores, fontSet);
      const widthEvent = getTextWidth(`${eventName} • ${eventDate}`, fontEvent);
      const headerSvgWidth = Math.max(widthPlayers, widthSet, widthEvent) + padding * 2;
      const headerSvgHeight = 36 + 24 + 20 + padding + 30;

      // --- Use same class names as your CSS ---
      const headerSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${headerSvgWidth}" height="${headerSvgHeight}">
  <style>
    /* Inherit your live page CSS classes */
    .players { font-family: 'DM Sans', sans-serif; font-size: 36px; fill: black; }
    .player.winner { font-weight: 700; fill: black; }
    .player { font-weight: 400; fill: black; }
    .vs { font-weight: 400; fill: gray; font-family: 'DM Sans', sans-serif; font-size: 28px; }
    .set-scores { font-family: 'DM Sans', sans-serif; font-size: 24px; fill: black; font-weight: 600; }
    .event-info { font-family: 'DM Sans', sans-serif; font-size: 20px; fill: #555; font-weight: 400; }
  </style>

  <text x="50%" y="40" text-anchor="middle" class="players">
    <tspan class="player ${p1Winner ? 'winner' : ''}">${player1}</tspan>
    <tspan class="vs"> vs </tspan>
    <tspan class="player ${p2Winner ? 'winner' : ''}">${player2}</tspan>
  </text>

  <text x="50%" y="80" text-anchor="middle" class="set-scores">${setScores}</text>
  <text x="50%" y="120" text-anchor="middle" class="event-info">${eventName} • ${eventDate}</text>
</svg>
`;

      // Convert SVG to PNG
      const headerBlob = new Blob([headerSvg], { type: "image/svg+xml;charset=utf-8" });
      const headerUrl = URL.createObjectURL(headerBlob);
      const headerImg = new Image();
      headerImg.src = headerUrl;

      await new Promise(resolve => {
        headerImg.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = headerImg.width;
          canvas.height = headerImg.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(headerImg, 0, 0);
          reportSections.push({ pngData: canvas.toDataURL("image/png") });
          URL.revokeObjectURL(headerUrl);
          resolve();
        };
      });

      console.log("Header exported!");
    } catch (err) {
      console.error("Error exporting header SVG", err);
    }

    // --- 2️⃣ Export chart sections ---
    const sections = document.querySelectorAll("section");
    for (const section of sections) {
      if (section.id === "header") continue;
      const svg = section.querySelector("svg");
      if (!svg) continue;

      try {
        console.log("Exporting section:", section.id);

        const bgColor = window.getComputedStyle(section).backgroundColor || "white";
        const clonedSvg = svg.cloneNode(true);
        clonedSvg.setAttribute(
          "style",
          `background-color: ${bgColor}; width: ${svg.width.baseVal.value}px; height: ${svg.height.baseVal.value}px;`
        );

        const cssRules = Array.from(document.styleSheets)
          .map(sheet => {
            try { return Array.from(sheet.cssRules || []).map(rule => rule.cssText).join(" "); }
            catch { return ""; }
          })
          .join(" ");

        const styleEl = document.createElement("style");
        styleEl.textContent = cssRules;
        clonedSvg.insertBefore(styleEl, clonedSvg.firstChild);

        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.src = url;

        await new Promise(resolve => {
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            reportSections.push({ pngData: canvas.toDataURL("image/png") });
            URL.revokeObjectURL(url);
            resolve();
          };
          img.onerror = e => {
            console.error("Error rendering SVG for section:", section.id, e);
            resolve();
          };
        });

        console.log("Finished section:", section.id);
      } catch (err) {
        console.error("Error exporting section:", section.id, err);
      }
    }

    // --- 3️⃣ Build HTML report ---
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Match Report</title>
  <link rel="stylesheet" href="style.css">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'DM Sans', sans-serif; max-width: 1000px; margin: 2rem auto; }
    section { margin-bottom: 3rem; }
    img { width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  ${reportSections.map(s => `<section><img src="${s.pngData}" /></section>`).join("")}
</body>
</html>
`;
    // Create file name
    const response = await fetch('../../../../data/json/match_summary.json');
    const matchData = await response.json();
    const dateFormatted = matchData.eventDate.replace(/\//g, "_");
    const htmlFilename = `${matchData.player1} vs ${matchData.player2} (${dateFormatted}).html`;

    // --- 4️⃣ Trigger download ---
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = htmlFilename;
    a.click();
    URL.revokeObjectURL(a.href);

    btn.disabled = false;
    btn.textContent = "Export Match Report";
    console.log("Export complete!");
  });
});
