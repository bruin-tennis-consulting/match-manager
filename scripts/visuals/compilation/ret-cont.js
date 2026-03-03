d3.json("../../../../data/json/ret_contact.json").then(function(returns_ucla) {
    d3.json("../../../../data/json/ret_contact_dist.json").then(function(distribution) {

        const width = 1000;
        const height = 800;

        const svg = d3.select("#ret-cont svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        const xScale = d3.scaleLinear()
                        .domain([-350, 350])
                        .range([0, width]);

        const yScale = d3.scaleLinear()
                        .domain([-600, -275])
                        .range([height, 0]);

        svg.append("text")
            .attr("class", "title")
            .attr("x", width / 2)
            .attr("y", yScale(-292.5))
            .attr("text-anchor", "middle")
            .text("1st Return Contact");

        svg.append("rect")
            .attr("x", xScale(-210))
            .attr("y", yScale(-300))
            .attr("width", xScale(210) - xScale(-210))
            .attr("height", yScale(-455) - yScale(-300))
            .attr("fill", "#6092ce");

        const courtLines = [
            { x1: 210, y1: -300, x2: 210, y2: -455 },
            { x1: -210, y1: -300, x2: -210, y2: -455 },
            { x1: 157.5, y1: -300, x2: 157.5, y2: -455 },
            { x1: -157.5, y1: -300, x2: -157.5, y2: -455 },
            { x1: 0, y1: -300, x2: 0, y2: -300 },
            { x1: 211.25, y1: -455, x2: -211.25, y2: -455 },
            { x1: 0, y1: -445, x2: 0, y2: -455 }
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
            .attr("stroke-width", 4);

        const dashedLines = [
            { x1: -300, x2: 350, y: -455},
            { x1: -300, x2: 350, y: -490}
        ];

        svg.selectAll(".dashed-line")
            .data(dashedLines)
            .enter()
            .append("line")
            .attr("x1", function(d) { return xScale(d.x1); })
            .attr("y1", function(d) { return yScale(d.y); })
            .attr("x2", function(d) { return xScale(d.x2); })
            .attr("y2", function(d) { return yScale(d.y); })
            .attr("class", "dashed-line");

        // Forehand vs. Backhand
        svg.selectAll("circle")
            .data(returns_ucla.filter(d => (d.shotFhBh === "Forehand")))
            .enter()
            .append("circle")
            .attr("cx", function(d) { return xScale(d.shotContactX); })
            .attr("cy", function(d) { return yScale(d.shotContactY); })
            .attr("r", 5)
            .attr("stroke", "black")
            .attr("stroke-width", 0.5)
            .attr("fill", function(d) {
                if (d.pointWonBy === d.shotHitBy) {
                    return "#00cc00";
                } else {
                    return "red";
                }
            });
        
        svg.selectAll("triangle")
            .data(returns_ucla.filter(d => (d.shotFhBh === "Backhand")))
            .enter()
            .append("polygon")
            .attr("points", function(d) {
                const x = xScale(d.shotContactX);
                const y = yScale(d.shotContactY);
                return `${x},${y - 5} ${x - 5},${y + 5} ${x + 5},${y + 5}`;
            })
            .attr("stroke", "black")
            .attr("stroke-width", 0.5)
            .attr("fill", function(d) {
                if (d.pointWonBy === d.shotHitBy) {
                    return "#00cc00";
                } else {
                    return "red";
                }
            });


        // Count + Win Pct. Boxes & Labels
        svg.selectAll(".proportion-rect")
            .data(distribution)
            .enter()
            .append("rect")
            .attr("class", "proportion-rect")
            .attr("x", function(d) { return xScale(270) - 26.5; })
            .attr("y", function(d) { return yScale(d.y) - 17.5; })
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
            .attr("x", function(d) { return xScale(315) - 20; })
            .attr("y", function(d) { return yScale(d.y) - 17.5; })
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
            .attr("x", xScale(270))
            .attr("y", function(d) { return yScale(d.y); })
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .text(function(d) { return d.win_percentage; });

        svg.selectAll(".count-label")
            .data(distribution)
            .enter()
            .append("text")
            .attr("class", "proportion-label")
            .attr("x", xScale(315))
            .attr("y", function(d) { return yScale(d.y); })
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .text(function(d) { return d.freq; });
        
        const winFreqLabels = [
            { label: "Win %", x: 268.5, y: -390 },
            { label: "Freq", x: 315, y: -390 }
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

        // Legend
        const legendX = xScale(-287.5);
        const legendYStart = 250;

        const legendData = [
            { label: "Won", color: "#00cc00"},
            { label: "Lost", color: "red"}
        ];

        svg.append("rect")
            .attr("x", legendX - 25)
            .attr("y", legendYStart - 17.5)
            .attr("width", 117.5)
            .attr("height", 80)
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-width", 2);

        svg.selectAll(".legend-triangle")
            .data(legendData.filter(d => !d.shape))
            .enter()
            .append("polygon")
            .attr("points", function(d, i) {
                const x = legendX + 25;
                const y = legendYStart + i * 25 + 17.5;
                return `${x},${y - 5} ${x - 5},${y + 5} ${x + 5},${y + 5}`;
            })
            .attr("fill", function(d) { return d.color; })
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        svg.selectAll(".legend-circle")
            .data(legendData.filter(d => !d.shape))
            .enter()
            .append("circle")
            .attr("cx", legendX)
            .attr("cy", function(d, i) { return legendYStart + i * 25 + 17.5; })
            .attr("r", 5)
            .attr("fill", function(d) { return d.color; })
            .attr("stroke", "black")
            .attr("stroke-width", 1);     
        
        svg.selectAll(".legend-label")
            .data(legendData)
            .enter()
            .append("text")
            .attr("x", legendX + 45)
            .attr("y", function(d, i) { return legendYStart + i * 25 + 22.5; })
            .attr("text-anchor", "start")
            .attr("fill", "white")
            .text(function(d) { return d.label; });
        
        svg.append("text")
            .attr("x", legendX + 12.75)
            .attr("y", legendYStart + 2.5)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("font-size", "14px")
            .text("FH / BH");

            
        // Distance indication
        svg.append("text")
            .attr("x", xScale(-280))
            .attr("y", yScale(-475))
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("font-size", "16px")
            .text("3 ft");

        // Top arrow
        svg.append("line")
            .attr("x1", xScale(-280))
            .attr("y1", yScale(-475) - 40)
            .attr("x2", xScale(-280))
            .attr("y2", yScale(-475) - 15)
            .attr("stroke", "white")
            .attr("stroke-width", 2);

            svg.append("path")
                .attr("d", d3.line()([[xScale(-280), yScale(-475) - 45], [xScale(-285), yScale(-475) - 35], [xScale(-275), yScale(-475) - 35]]))
                .attr("fill", "white");


        // Bottom arrow
        svg.append("line")
            .attr("x1", xScale(-280))
            .attr("y1", yScale(-475) + 5)
            .attr("x2", xScale(-280))
            .attr("y2", yScale(-475) + 25)
            .attr("stroke", "white")
            .attr("stroke-width", 2);

            svg.append("path")
                .attr("d", d3.line()([[xScale(-280), yScale(-475) + 34], [xScale(-285), yScale(-475) + 24], [xScale(-275), yScale(-475) + 24]]))
                .attr("fill", "white");
    }); 
});     