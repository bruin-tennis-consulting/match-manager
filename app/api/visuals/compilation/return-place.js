function drawReturnPlace(data_location, data_dist_location, svgSelector = "#return-place svg") {
    d3.json(data_location).then(function(returns_ucla) {
        d3.json(data_dist_location).then(function(distribution) {

            const width = 1000;
            const height = 800;

            const svg = d3.select(svgSelector)
                .attr("viewBox", `0 0 ${width} ${height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");

            const xScale = d3.scaleLinear()
                                .domain([-350, 350])
                                .range([0, width]);

            const yScale = d3.scaleLinear()
                                .domain([-220, 600])
                                .range([height, 0]);

            const xPositionMapping = {
                'left': -105,
                'mid': 0,
                'right': 105
            };

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

            const dashedLines = [
                { x: -52.5, y1: -25, y2: 455},
                { x: 52.5, y1: -25, y2: 455}
            ];

            svg.selectAll(".dashed-line")
                .data(dashedLines)
                .enter()
                .append("line")
                .attr("x1", function(d) { return xScale(d.x); })
                .attr("y1", function(d) { return yScale(d.y1); })
                .attr("x2", function(d) { return xScale(d.x); })
                .attr("y2", function(d) { return yScale(d.y2); })
                .attr("class", "dashed-line");

            // Count + Win Pct. Boxes & Labels
            svg.selectAll(".proportion-rect")
                .data(distribution)
                .enter()
                .append("rect")
                .attr("class", "proportion-rect")
                .attr("x", function(d) { return xScale(xPositionMapping[d.width]) - 25; })
                .attr("y", yScale(-50) - 12)
                .attr("width", 50)
                .attr("height", 24)
                .attr("rx", 12)
                .attr("ry", 12)
                .attr("fill", function(d) {
                    if (d.maxMin == "max") return "#32a852";
                    if (d.maxMin == "min") return "red";
                    return "#3395f6";
                })
                .attr("stroke", "white")
                .attr("stroke-width", 1);

            svg.selectAll(".count-rect")
                .data(distribution)
                .enter()
                .append("rect")
                .attr("class", "count-rect")
                .attr("x", function(d) { return xScale(xPositionMapping[d.width]) - 20; })
                .attr("y", yScale(-82.5) - 12)
                .attr("width", 40)
                .attr("height", 24)
                .attr("rx", 12)
                .attr("ry", 12)
                .attr("fill", "#d3d3d3")
                .attr("stroke", "black")
                .attr("stroke-width", 1);

            svg.selectAll(".proportion-label")
                .data(distribution)
                .enter()
                .append("text")
                .attr("class", "proportion-label")
                .attr("x", function(d) { return xScale(xPositionMapping[d.width]); })
                .attr("y", yScale(-55))
                .attr("text-anchor", "middle")
                .attr("fill", "white")
                .text(function(d) { return d.win_percentage; });

            svg.selectAll(".count-label")
                .data(distribution)
                .enter()
                .append("text")
                .attr("class", "count-label")
                .attr("x", function(d) { return xScale(xPositionMapping[d.width]); })
                .attr("y", yScale(-87.5))
                .attr("text-anchor", "middle")
                .attr("fill", "black")
                .text(function(d) { return d.freq; });

            const winFreqLabels = [
                { label: "Win %", x: 185, y: -50 },
                { label: "Freq", x: 185, y: -82.5 }
            ];

            winFreqLabels.forEach(function(d) {
                svg.append("rect")
                    .attr("x", xScale(d.x) - 30)
                    .attr("y", yScale(d.y) - 13.25)
                    .attr("width", 60)
                    .attr("height", 26)
                    .attr("rx", 10)
                    .attr("ry", 10)
                    .attr("fill", "none")
                    .attr("stroke", "white")
                    .attr("stroke-width", 2);

                svg.append("text")
                    .attr("class", "label")
                    .attr("x", xScale(d.x))
                    .attr("y", yScale(d.y) + 5)
                    .attr("text-anchor", "middle")
                    .attr("fill", "white")
                    .style("font-weight", "normal")
                    .text(d.label);
            });

            const fixedLength = 30;  // Length of arrows

            // Trajectory lines
            svg.selectAll(".trajectory-line-outline")
                .data(returns_ucla)
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
                .data(returns_ucla)
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

            // Tool tip
            const tooltip = d3.select("body")
                .append("div")
                .attr("class", "tooltip")
                .style("opacity", 0);

            // Plotting shot placement
            svg.selectAll("circle")
                .data(returns_ucla)
                .enter()
                .append("circle")
                .attr("cx", function(d) { return xScale(d.shotLocationX); })
                .attr("cy", function(d) { return yScale(d.shotLocationY); })
                .attr("r", 5)
                .attr("stroke", "black")
                .attr("stroke-width", 0.5)
                .attr("fill", function(d) {
                    if (d.isError) {
                        return "grey";  // Grey if last shot was an error
                    } else if (d.pointWonBy === d.shotHitBy) {
                        return "#00cc00";  // Green for win
                    } else {
                        return "red";  // Red for loss
                    }
                })
                .on("mouseover", function (event, d) {
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
                .on("mouseout", function(){
                    tooltip.transition().duration(500).style("opacity", 0);
                });

            // Legend
            const legendY = yScale(-135);
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

            svg.append("text")
                .attr("class", "title")
                .attr("x", width / 2)
                .attr("y", yScale(-180))
                .text(function() {
                    if (returns_ucla[0].sideFiltered) {
                        if (returns_ucla[0].fhBhFiltered) {
                            return `1st Return Placement - ${returns_ucla[0].side} ${returns_ucla[0].shotFhBh}`
                        }
                        else {
                            return `1st Return Placement - ${returns_ucla[0].side} Side`
                        }
                    } else {
                        return "1st Return Placement"
                    }
                });
        }); 
    });     
}