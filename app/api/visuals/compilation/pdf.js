document.getElementById("save-all-sections").addEventListener("click", async () => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "pt", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pdfMargin = 20;
    const cropPercent = 0.1; // crop 10% from each side

    // Dynamic file name from loaded json
    const response = await fetch('../../../../data/json/match_summary.json');
    const matchData = await response.json();
    const dateFormatted = matchData.eventDate.replace(/\//g, "_");
    const pdfFilename = `${matchData.player1} vs ${matchData.player2} (${dateFormatted}).pdf`;

    const sections = Array.from(document.querySelectorAll("section"));
    let yOffset = pdfMargin;

    for (let i = 0; i < sections.length; i++) {
        const canvas = await html2canvas(sections[i], { scale: 2 });

        const cropX = canvas.width * cropPercent;
        const cropWidth = canvas.width * (1 - 2 * cropPercent);
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = cropWidth;
        croppedCanvas.height = canvas.height;
        const ctx = croppedCanvas.getContext("2d");
        ctx.drawImage(canvas, cropX, 0, cropWidth, canvas.height, 0, 0, cropWidth, canvas.height);

        // Fit width to page
        const imgWidth = pageWidth - 2 * pdfMargin;
        const imgHeight = (croppedCanvas.height * imgWidth) / croppedCanvas.width;

        // New page if visuals don't fit
        if (yOffset + imgHeight + pdfMargin > pageHeight) {
            pdf.addPage();
            yOffset = pdfMargin;
        }

        pdf.addImage(croppedCanvas.toDataURL("image/png"), "PNG", pdfMargin, yOffset, imgWidth, imgHeight);
        yOffset += imgHeight + pdfMargin;
    }

    pdf.save(pdfFilename);
});
