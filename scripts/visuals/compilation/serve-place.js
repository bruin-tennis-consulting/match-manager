d3.json("../../../../data/json/serve_place.json").then(function(serves_ucla) {
    d3.json("../../../../data/json/serve_place_labels.json").then(function(labels) {

        const width = 1000;
        const height = 800;

        const svg = d3.select("#serve-place svg")
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
            .attr("y", yScale(-125))
            .text("Serve Placement");

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
            { x: 52.5, y1: 245, y2: 0 },
            { x: 105, y1: 245, y2: 0 },
            { x: -52.5, y1: 245, y2: 0 },
            { x: -105, y1: 245, y2: 0 }
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

        const servePlacementLabels = [
            { label: "T", x: 26.25, y: 20 },
            { label: "T", x: -26.25, y: 20 },
            { label: "Body", x: 78.75, y: 20 },
            { label: "Body", x: -78.75, y: 20 },
            { label: "Wide", x: 131.25, y: 20 },
            { label: "Wide", x: -131.25, y: 20 },
            { label: "Ad", x: 78.25, y: 260 },
            { label: "Deuce", x: -78.25, y: 260 },
        ];

        servePlacementLabels.forEach(function(d) {
            svg.append("text")
            .attr("class", "label")
            .attr("x", xScale(d.x))
            .attr("y", yScale(d.y) + 5)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .style("font-weight", "bold")
            .text(d.label);
        });

        const winFreqLabels = [
            { label: "Win %", x: 183.75, y: -47.5 },
            { label: "Freq", x: 183.75, y: -80 }
        ];

        winFreqLabels.forEach(function(d) {
            svg.append("rect")
                .attr("x", xScale(d.x) - 30)
                .attr("y", yScale(d.y) - 12.5)
                .attr("width", 60)
                .attr("height", 25)
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

        svg.selectAll("circle")
            .data(serves_ucla.filter(d => d.serveOutcome !== "Ace"))
            .enter()
            .append("circle")
            .attr("cx", function(d) { return xScale(d.x); })
            .attr("cy", function(d) { return yScale(d.y); })
            .attr("r", 5)
            .attr("stroke", "black")
            .attr("stroke-width", 0.5)
            .attr("fill", function(d) {
                if (d.serveOutcome === "Won") {
                    return "#00cc00";
                } else if (d.serveOutcome === "Lost") {
                    return "red";
                }
            });

        svg.selectAll(".star")
            .data(serves_ucla.filter(d => d.serveOutcome === "Ace"))
            .enter()
            .append("polygon")
            .attr("points", function(d) {
                const cx = xScale(d.x);
                const cy = yScale(d.y);
                const outerRadius = 7;
                const innerRadius = 3.5;
                let starPoints = "";
                for (let i = 0; i < 10; i++) {
                    const angle = i * Math.PI / 5 - Math.PI / 2;
                    const r = i % 2 === 0 ? outerRadius : innerRadius;
                    const x = cx + r * Math.cos(angle);
                    const y = cy + r * Math.sin(angle);
                    starPoints += `${x},${y} `;
                }
                return starPoints.trim();
            })
            .attr("fill", "#f8c84f")
            .attr("stroke", "black")
            .attr("stroke-width", 0.5);

        svg.selectAll(".proportion-rect")
            .data(labels)
            .enter()
            .append("rect")
            .attr("class", "proportion-rect")
            .attr("x", function(d) { return xScale(d.x) - 30; })
            .attr("y", yScale(-47.5) - 12)
            .attr("width", 60)
            .attr("height", 24)
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("fill", function(d) {
                if (d.max_min == "max") return "#32a852";
                if (d.max_min == "min") return "red";
                return "#3395f6";
            })
            .attr("stroke", "white")
            .attr("stroke-width", 1);

        svg.selectAll(".count-rect")
            .data(labels)
            .enter()
            .append("rect")
            .attr("class", "count-rect")
            .attr("x", function(d) { return xScale(d.x) - 20; })
            .attr("y", yScale(-80) - 12)
            .attr("width", 40)
            .attr("height", 24)
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("fill", "#d3d3d3")
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        svg.selectAll(".proportion-label")
            .data(labels)
            .enter()
            .append("text")
            .attr("class", "proportion-label")
            .attr("x", function(d) { return xScale(d.x); })
            .attr("y", yScale(-47.5) + 5)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .text(function(d) { return d.proportion_label; });

        svg.selectAll(".count-label")
            .data(labels)
            .enter()
            .append("text")
            .attr("class", "count-label")
            .attr("x", function(d) { return xScale(d.x); })
            .attr("y", yScale(-80) + 5)
            .attr("text-anchor", "middle")
            .attr("fill", "black")
            .text(function(d) { return d.count_label; });

        const legendData = [
            { label: "Won", color: "#00cc00", x: -60 },
            { label: "Lost", color: "red", x: -10 },
            { label: "Ace", color: "#f8c84f", x: 40, shape: "star" }
        ];

        const legendX = xScale(-25);
        const legendYStart = 275;

        svg.append("rect")
            .attr("x", legendX - 125)
            .attr("y", legendYStart - 20)
            .attr("width", 325)
            .attr("height", 40)
            .attr("rx", 12)
            .attr("ry", 12)
            .attr("fill", "none")
            .attr("stroke", "white")
            .attr("stroke-width", 2);

        svg.selectAll(".legend-circle")
            .data(legendData.filter(d => !d.shape))
            .enter()
            .append("circle")
            .attr("cx", function(d, i) { return legendX + i * 90 - 80; })
            .attr("cy", legendYStart)
            .attr("r", 5)
            .attr("fill", function(d) { return d.color; })
            .attr("stroke", "black")
            .attr("stroke-width", 1);

        svg.selectAll(".legend-star")
            .data(legendData.filter(d => d.shape === "star"))
            .enter()
            .append("polygon")
            .attr("points", function(d) {
                const cx = legendX + 105;
                const cy = legendYStart;
                const outerRadius = 7;
                const innerRadius = 3.5;
                let starPoints = "";
                for (let i = 0; i < 10; i++) {
                    const angle = i * Math.PI / 5 - Math.PI / 2;
                    const r = i % 2 === 0 ? outerRadius : innerRadius;
                    const x = cx + r * Math.cos(angle);
                    const y = cy + r * Math.sin(angle);
                    starPoints += `${x},${y} `;
                }
                return starPoints.trim();
            })
            .attr("fill", "#f8c84f")
            .attr("stroke", "black")
            .attr("stroke-width", 1);
                            
        svg.selectAll(".legend-label")
            .data(legendData)
            .enter()
            .append("text")
            .attr("x", function(d, i) { return legendX + i * 95 - 65; })
            .attr("y", legendYStart + 5)
            .attr("text-anchor", "start")
            .attr("fill", "white")
            .text(function(d) { return d.label; });
    });
});