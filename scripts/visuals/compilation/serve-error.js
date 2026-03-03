d3.json("../../../../data/json/serve_error.json").then(function(serve_errors) {
  d3.json("../../../../data/json/serve_error_dist.json").then(function(serve_errorDist) {

    const width = 1000;
    const height = 800;
    
    const svg = d3.select("#serve-error svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const xScale = d3.scaleLinear()
                        .domain([-350, 350])
                        .range([0, width]);

    const yScale = d3.scaleLinear()
                        .domain([-150, 600])
                        .range([height, 0]);

    svg.append("text")
      .attr("class", "title")
      .attr("x", width / 2)
      .attr("y", yScale(-75)) 
      .text("Serve Error Distribution");

    svg.append("rect")
        .attr("x", xScale(-210))
        .attr("y", yScale(455))
        .attr("width", xScale(210) - xScale(-210))
        .attr("height", yScale(-25) - yScale(455))
        .attr("fill", "#6092ce");

    const courtLines = [
        { x1: 210, y1: -25, x2: 210, y2: 455 },
        { x1: -210, y1: -25, x2: -210, y2: 455 },
        { x1: 157.5, y1: -25, x2: 157.5, y2: 455 },
        { x1: -157.5, y1: -25, x2: -157.5, y2: 455 },
        { x1: 240, y1: 0, x2: -240, y2: 0, width: 7 },
        { x1: 0, y1: -25, x2: 0, y2: 245 },
        { x1: 157.5, y1: 245, x2: -157.5, y2: 245 },
        { x1: 211.25, y1: 455, x2: -211.25, y2: 455 },
        { x1: 0, y1: 445, x2: 0, y2: 455 }
    ];

    svg.selectAll("line")
        .data(courtLines)
        .enter()
        .append("line")
        .attr("x1", d => xScale(d.x1))
        .attr("y1", d => yScale(d.y1))
        .attr("x2", d => xScale(d.x2))
        .attr("y2", d => yScale(d.y2))
        .attr("stroke", "white")
        .attr("stroke-width", d => d.width ? d.width : 4);

        // Serve error distribution labels
        const counts = [
            { label: serve_errorDist.find(d => d.type === "Ad Net")?.count || 0, x: 78.75, y: 135, zone: "Ad Net" },
            { label: serve_errorDist.find(d => d.type === "Ad Wide")?.count || 0, x: 78.75, y: 105, zone: "Ad Wide" },
            { label: serve_errorDist.find(d => d.type === "Ad Long")?.count || 0, x: 78.75, y: 75, zone: "Ad Long" },
            { label: serve_errorDist.find(d => d.type === "Deuce Net")?.count || 0, x: -78.75, y: 135, zone: "Deuce Net" },
            { label: serve_errorDist.find(d => d.type === "Deuce Wide")?.count || 0, x: -78.75, y: 105, zone: "Deuce Wide" },
            { label: serve_errorDist.find(d => d.type === "Deuce Long")?.count || 0, x: -78.75, y: 75, zone: "Deuce Long" }
        ];

        svg.selectAll(".count-rect")
            .data(counts)
            .enter()
            .append("rect")
            .attr("class", "count-rect")
            .attr("x", d => xScale(d.x) - 25.5)
            .attr("y", d => yScale(d.y) - 17.75)
            .attr("width", 50)
            .attr("height", 24)
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("fill", function(d) {
                if (d.zone.includes("Ad")) {
                    return "#1c7ed6";
                } else if (d.zone.includes("Deuce")) {
                    return "#756bb1";
                }
            })
            .attr("stroke", "white")
            .attr("stroke-width", 1.5);
        
        svg.selectAll("count-text")
            .data(counts)
            .enter()
            .append("text")
            .attr("class", "count-text")
            .attr("x", d => xScale(d.x))
            .attr("y", d => yScale(d.y))
            .text(d => d.label);

        // Central count labels
        const centralLabels = [
            { label: "Net", x: 0, y: 135 },
            { label: "Wide", x: 0, y: 105 },
            { label: "Long", x: 0, y: 75 }
        ];

        svg.selectAll(".central-rect")
            .data(centralLabels)
            .enter()
            .append("rect")
            .attr("class", "central-rect")
            .attr("x", d => xScale(d.x) - 25.5)
            .attr("y", d => yScale(d.y) - 16.5)
            .attr("width", 50)
            .attr("height", 24)
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("fill", "#b0b0b0")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5);

        svg.selectAll(".central-label")
            .data(centralLabels)
            .enter()
            .append("text")
            .attr("x", d => xScale(d.x))
            .attr("y", d => yScale(d.y))
            .text(d => d.label)
            .attr("class", "central-text")


        // Plotting density data
        // Ad Deuce
        const adDensityData = d3.contourDensity()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
            .size([width, height])
            .bandwidth(12.5)(serve_errors.filter(d => d.type.includes("Ad")));

        const adMaxDensity = d3.max(adDensityData, d => d.value);

        const adColorScale = d3.scaleLinear()
            .domain([adMaxDensity * 0.05, adMaxDensity * 0.15, adMaxDensity * 0.35, adMaxDensity * 0.6, adMaxDensity])
            .range(["#1c7ed6", "#bcbddc", "#f8f15a", "#f6a63b", "#d84315"]);

        svg.selectAll("path.ad-contour")
            .data(adDensityData)
            .enter()
            .append("path")
            .attr("class", "ad-contour")
            .attr("d", d3.geoPath())
            .attr("fill", d => adColorScale(d.value));

        // Deuce side data
        const deuceDensityData = d3.contourDensity()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
            .size([width, height])
            .bandwidth(12.5)(serve_errors.filter(d => d.type.includes("Deuce")));

        const deuceMaxDensity = d3.max(deuceDensityData, d => d.value);

        const deuceColorScale = d3.scaleLinear()
            .domain([adMaxDensity * 0.05, adMaxDensity * 0.15, adMaxDensity * 0.35, adMaxDensity * 0.6, adMaxDensity])
            .range(["#756bb1", "#bcbddc", "#f8f15a", "#f6a63b", "#d84315"]);

        svg.selectAll("path.deuce-contour")
            .data(deuceDensityData)
            .enter()
            .append("path")
            .attr("class", "deuce-contour")
            .attr("d", d3.geoPath())
            .attr("fill", d => deuceColorScale(d.value));

        // Court side labels
        const labels = [
            { label: "Ad", x: 78.25, y: 162.5 },
            { label: "Deuce", x: -78.25, y: 162.5 }
        ];

        svg.selectAll("text.label-text")
        .data(labels)
        .enter()
        .append("text")
        .attr("class", "label-text")
        .attr("x", d => xScale(d.x))
        .attr("y", d => yScale(d.y))
        .attr("fill", "white")
        .text(d => d.label);
    });
});

