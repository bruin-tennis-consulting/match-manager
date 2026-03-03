d3.json("../../../data/json/winners.json").then(function(winners) {

    const width = 1000;
    const height = 800;

    const svg = d3.select("#winner-placement svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");


    const xScale = d3.scaleLinear()
                        .domain([-350, 350])
                        .range([0, width]);

    const yScale = d3.scaleLinear()
                        .domain([-150, 600])
                        .range([height, 0]);

    // Arrowhead marker
    svg.append("defs")
    .append("marker")
    .attr("id", "arrowhead-outline")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 5)
    .attr("refY", 5)
    .attr("markerWidth", 5)
    .attr("markerHeight", 5)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 Z")
    .attr("fill", "black");

    svg.append("defs")
    .append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 0 8 8")
    .attr("refX", 4)
    .attr("refY", 4)
    .attr("markerWidth", 4)
    .attr("markerHeight", 4)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 8 4 L 0 8 Z")
    .attr("fill", "black");

    svg.append("text")
    .attr("class", "title")
    .attr("x", width / 2)
    .attr("y", yScale(-115))
    .text("Winner Placement");

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
    .attr("x1", function(d) { return xScale(d.x1); })
    .attr("y1", function(d) { return yScale(d.y1); })
    .attr("x2", function(d) { return xScale(d.x2); })
    .attr("y2", function(d) { return yScale(d.y2); })
    .attr("stroke", "white")
    .attr("stroke-width", function(d) {
        return d.width ? d.width : 4;
    });

    const courtLabels = [
    { label: "Ad", x: 78.25, y: 20 },
    { label: "Deuce", x: -78.25, y: 20 },
    ];

    courtLabels.forEach(function(d) {
    svg.append("text")
    .attr("class", "label")
    .attr("x", xScale(d.x))
    .attr("y", yScale(d.y) + 5)
    .attr("text-anchor", "middle")
    .attr("fill", "white")
    .style("font-weight", "550")
    .text(d.label);
    });

    const fixedLength = 30;  // Fixed length for the arrows

    // Trajectory lines
    svg.selectAll(".trajectory-line-outline")
    .data(winners)
    .enter()
    .append("line")
    .attr("class", "trajectory-line-outline")
    .attr("x1", function(d) { return xScale(d.shotLocationX); })
    .attr("y1", function(d) { return yScale(d.shotLocationY); })
    .attr("x2", function(d) {
        const dx = d.shotLocationX - d.shotContactX;
        const dy = d.shotLocationY - d.shotContactY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / length;
        return xScale(d.shotLocationX + fixedLength * unitX);
    })
    .attr("y2", function(d) {
        const dx = d.shotLocationX - d.shotContactX;
        const dy = d.shotLocationY - d.shotContactY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unitY = dy / length;
        return yScale(d.shotLocationY + fixedLength * unitY);
    })
    .attr("stroke", "black")

    svg.selectAll(".trajectory-line")
    .data(winners)
    .enter()
    .append("line")
    .attr("class", "trajectory-line")
    .attr("x1", function(d) { return xScale(d.shotLocationX); })
    .attr("y1", function(d) { return yScale(d.shotLocationY); })
    .attr("x2", function(d) {
        const dx = d.shotLocationX - d.shotContactX;
        const dy = d.shotLocationY - d.shotContactY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / length;
        return xScale(d.shotLocationX + fixedLength * unitX);
    })
    .attr("y2", function(d) {
        const dx = d.shotLocationX - d.shotContactX;
        const dy = d.shotLocationY - d.shotContactY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const unitY = dy / length;
        return yScale(d.shotLocationY + fixedLength * unitY);
    })
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .attr("marker-end", "url(#arrowhead)");

    // Plot winners
    // Helper function to plot stars
    function createStarPoints(outerRadius, innerRadius, numPoints) {
    let points = [];
    let angle = Math.PI / numPoints;
    let rotationOffset = -Math.PI / 2;

    for (let i = 0; i < 2 * numPoints; i++) {
        let r = i % 2 === 0 ? outerRadius : innerRadius;
        let x = Math.cos(i * angle + rotationOffset) * r;
        let y = Math.sin(i * angle + rotationOffset) * r;
        points.push([x, y]);
    }

    return points.map(function(d) {
        return d.join(",");
    }).join(" ");
    }

    // Tool tip
    const tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

    svg.selectAll(".winner-shape")
    .data(winners)
    .enter()
    .append(function(d) {
        if (d.isVolley == 1.0) {
            return document.createElementNS(d3.namespaces.svg, 'polygon');
        } else {
            return document.createElementNS(d3.namespaces.svg, 'circle');
        }
    })
    .attr("class", "winner-shape")
    .attr("transform", function(d) {
        if (d.isVolley == 1.0) {
            return "translate(" + xScale(d.shotLocationX) + "," + yScale(d.shotLocationY) + ")";
        }
    })
    .attr("points", function(d) {
        if (d.isVolley == 1.0) {
            let outerRadius = 8;
            let innerRadius = 4;
            let numPoints = 5;
            return createStarPoints(outerRadius, innerRadius, numPoints);
        }
    })
    .attr("fill", function(d) {
        if (d.isVolley == 1.0) {
            return "#fcd404";
        } else if (d.shotFhBh === "Forehand") {
            return "#00cc00";
        } else if (d.shotFhBh === "Backhand") {
            return "#4DA3FF";
        }
    })
    .attr("stroke", "black")
    .attr("stroke-width", 1)
    .attr("r", function(d) {
        if (d.isVolley != 1.0) {
            return 6; 
        }
    })
    .attr("cx", function(d) {
        if (d.isVolley != 1.0) {
            return xScale(d.shotLocationX);
        }
    })
    .attr("cy", function(d) {
        if (d.isVolley != 1.0) {
            return yScale(d.shotLocationY);
        }
    })
    // Tooltip event handlers
    .on("mouseover", function(event, d) {
        tooltip.transition().duration(200).style("opacity", 0.9);

        // Convert milliseconds to hours:minutes:seconds
        const totalSeconds = Math.floor(d.pointStartTime / 1000); // Convert to seconds
        const hours = Math.floor(totalSeconds / 3600); // Extract hours
        const minutes = Math.floor((totalSeconds % 3600) / 60); // Extract remaining minutes
        const seconds = totalSeconds % 60; // Extract remaining seconds

        // Format as hh:mm:ss
        const formattedTime = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Set tooltip content
        tooltip.html(`pointStartTime: ${d.pointStartTime}<br>Timestamp: ${formattedTime}`) 
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", function() {
        tooltip.transition().duration(500).style("opacity", 0);
    });


    // Legend
    const legendData = [
        { label: "Forehand", color: "#00cc00", shape: "circle", x: -150 },
        { label: "Backhand", color: "#4DA3FF", shape: "circle", x: 0 },
        { label: "Volley", color: "#fcd404", shape: "star", x: 150 }
    ];

    const legendX = xScale(0) - 50;
    const legendY = yScale(-60);

    svg.append("rect")
        .attr("x", legendX - 180)
        .attr("y", legendY - 20)
        .attr("width", 435)
        .attr("height", 40)
        .attr("rx", 12)
        .attr("ry", 12)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 2);

    svg.selectAll(".legend-shape")
        .data(legendData)
        .enter()
        .append(function(d) {
            if (d.shape === "circle") {
                return document.createElementNS(d3.namespaces.svg, "circle");
            } else {
                return document.createElementNS(d3.namespaces.svg, "polygon");
            }
        })
        .attr("cx", function(d) { return legendX + d.x + 10; })
        .attr("cy", legendY)
        .attr("r", function(d) {
            return d.shape === "circle" ? 6 : null;
        })
        .attr("points", function(d) {
            if (d.shape === "star") {
                let outerRadius = 8.5;
                let innerRadius = 4;
                let numPoints = 5;
                return createStarPoints(outerRadius, innerRadius, numPoints);
            }
        })
        .attr("transform", function(d) {
            return d.shape === "star" ? `translate(${legendX + d.x + 10},${legendY})` : null;
        })
        .attr("fill", function(d) { return d.color; })
        .attr("stroke", "black")
        .attr("stroke-width", 1);


    svg.selectAll(".legend-label")
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", function(d) { return legendX + d.x + 30; })
        .attr("y", legendY + 5)
        .attr("text-anchor", "start")
        .attr("class", "legend-text")
        .attr("fill", "white")
        .attr("font-weight", "500")
        .text(function(d) { return d.label; });
});
