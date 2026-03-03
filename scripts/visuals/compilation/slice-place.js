function drawSlicePlace(data_location, svgSelector = "#slice-place svg") {
    const width = 1000;
    const height = 800;

    const svg = d3.select(svgSelector)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Unified scale for both court and shots
    const xScale = d3.scaleLinear().domain([-350, 350]).range([0, width]);
    const yScale = d3.scaleLinear().domain([-150, 600]).range([height, 0]);

    // Arrowhead marker
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

    // Tooltip
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    // Load data and draw everything
    d3.json(data_location).then(function(data) {
        // Court title
        svg.append("text")
            .attr("class", "title")
            .attr("x", width / 2)
            .attr("y", yScale(-120))
            .text(function() {
                if (data[0].fhBhFiltered) {
                    return `Slice Placement- ${data[0].shotFhBh}`
                }
                else {
                    return 'Slice Placement'
                }
            });

        // Court background
        svg.append("rect")
            .attr("x", xScale(-210))
            .attr("y", yScale(455))
            .attr("width", xScale(210) - xScale(-210))
            .attr("height", yScale(-25) - yScale(455))
            .attr("fill", "#6092ce");

        // Court lines
        const courtLines = [
            { x1: -240, y1: 0, x2: 240, y2: 0, width: 7 },
            { x1: -210, y1: -25, x2: -210, y2: 455 },
            { x1: 210,  y1: -25, x2: 210,  y2: 455 },
            { x1: -210, y1: 455, x2: 210, y2: 455 },
            { x1: 157.5, y1: -25, x2: 157.5, y2: 455 },
            { x1: -157.5, y1: -25, x2: -157.5, y2: 455 },
            { x1: -157.5, y1: 245, x2: 157.5, y2: 245 },
            { x1: 0, y1: -25, x2: 0, y2: 245 },
            { x1: 0, y1: 445, x2: 0, y2: 455 }
        ];

        svg.selectAll(".court-line")
            .data(courtLines)
            .enter()
            .append("line")
            .attr("x1", d => xScale(d.x1))
            .attr("y1", d => yScale(d.y1))
            .attr("x2", d => xScale(d.x2))
            .attr("y2", d => yScale(d.y2))
            .attr("stroke", "white")
            .attr("stroke-width", d => d.width || 4);
        
        // Arrow constants
        const fixedLength = 30;

        // Draw trajectories
        svg.selectAll(".trajectory-line-outline")
            .data(data)
            .enter()
            .append("line")
            .attr("class", "trajectory-line-outline")
            .attr("x1", d => xScale(d.shotLocationX))
            .attr("y1", d => yScale(d.shotLocationY))
            .attr("x2", d => {
                const dx = d.shotLocationX - d.shotContactX;
                const dy = d.shotLocationY - d.shotContactY;
                const len = Math.sqrt(dx * dx + dy * dy);
                return xScale(d.shotLocationX + fixedLength * dx / len);
            })
            .attr("y2", d => {
                const dx = d.shotLocationX - d.shotContactX;
                const dy = d.shotLocationY - d.shotContactY;
                const len = Math.sqrt(dx * dx + dy * dy);
                return yScale(d.shotLocationY + fixedLength * dy / len);
            })
            .attr("stroke", "black");

        svg.selectAll(".trajectory-line")
            .data(data)
            .enter()
            .append("line")
            .attr("class", "trajectory-line")
            .attr("x1", d => xScale(d.shotLocationX))
            .attr("y1", d => yScale(d.shotLocationY))
            .attr("x2", d => {
                const dx = d.shotLocationX - d.shotContactX;
                const dy = d.shotLocationY - d.shotContactY;
                const len = Math.sqrt(dx * dx + dy * dy);
                return xScale(d.shotLocationX + fixedLength * dx / len);
            })
            .attr("y2", d => {
                const dx = d.shotLocationX - d.shotContactX;
                const dy = d.shotLocationY - d.shotContactY;
                const len = Math.sqrt(dx * dx + dy * dy);
                return yScale(d.shotLocationY + fixedLength * dy / len );
            })
            .attr("stroke", "black")
            .attr("stroke-width", 2)
            .attr("marker-end", "url(#arrowhead)");

        // Landing points
        //the below segment had three points missing
        /*svg.selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.shotLocationX))
            .attr("cy", d => yScale(d.shotLocationY))
            .attr("r", 5)
            .attr("stroke", "black")
            .attr("stroke-width", 0.5)
            .attr("fill", d => {
                if (d.isError) return "grey";
                if (d.pointWonBy === d.shotHitBy) return "#00cc00";
                return "red";
            })*/
            const circles = svg.selectAll(".landing-point").data(data);

            circles.enter()
            .append("circle")
            .attr("class", "landing-point")
            .merge(circles)  // ensures all points are drawn/updated
            .attr("cx", d => xScale(d.shotLocationX))
            .attr("cy", d => yScale(d.shotLocationY))
            .attr("r", 5)
            .attr("stroke", "black")
            .attr("stroke-width", 0.5)
            .attr("fill", d => {
                if (d.isError) return "grey";
                if (d.pointWonBy === d.shotHitBy) return "#00cc00";
                return "red";
            })
            .on("mouseover", function(event, d) {
                const totalSeconds = Math.floor(d.pointStartTime / 1000);
                const h = Math.floor(totalSeconds / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = totalSeconds % 60;
                const formatted = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

                tooltip.transition().duration(200).style("opacity", 0.9);
                tooltip.html(`pointStartTime: ${d.pointStartTime}<br>Timestamp: ${formatted}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 20) + "px");
            })
            .on("mouseout", () => tooltip.transition().duration(500).style("opacity", 0));

    });
    // Legend (clean style from return chart, using slice logic)
    const legendY = yScale(-65);
    const legendX = width / 2 - 280;
    const legendGroup = svg.append("g");

    legendGroup.append("rect")
        .attr("x", legendX + 110)
        .attr("y", legendY - 22.5)
        .attr("width", 350)
        .attr("height", 35)
        .attr("rx", 15)
        .attr("ry", 15)
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 2);

    legendGroup.append("circle")
        .attr("cx", legendX + 145)
        .attr("cy", legendY - 5)
        .attr("r", 5)
        .attr("fill", "#00cc00")
        .attr("stroke", "black");

    // Text for Win
    legendGroup.append("text")
        .attr("x", legendX + 155)
        .attr("y", legendY)
        .attr("text-anchor", "start")
        .attr("fill", "white")
        .style("font-family", "'DM Sans', sans-serif")
        .text("- Won");

    legendGroup.append("circle")
        .attr("cx", legendX + 250)
        .attr("cy", legendY - 5)
        .attr("r", 5)
        .attr("fill", "red")
        .attr("stroke", "black");

    // Text for Lost
    legendGroup.append("text")
        .attr("x", legendX + 260)
        .attr("y", legendY)
        .attr("text-anchor", "start")
        .attr("fill", "white")
        .style("font-family", "'DM Sans', sans-serif")
        .text("- Lost");

    // Circle for Forehand with grey (error)
    legendGroup.append("circle")
        .attr("cx", legendX + 355)
        .attr("cy", legendY - 5)
        .attr("r", 5)
        .attr("fill", "grey")
        .attr("stroke", "black");

    // Text for Out/Net
    legendGroup.append("text")
        .attr("x", legendX + 365)
        .attr("y", legendY)
        .attr("text-anchor", "start")
        .attr("fill", "white")
        .style("font-family", "'DM Sans', sans-serif")
        .text("- Out/Net");
}