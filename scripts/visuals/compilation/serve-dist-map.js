d3.json("../../../../data/json/serve_dist.json").then(function(data) {

    const width = 1000;
    const height = 800;

    const svg = d3.select("#serve-dist-map svg")
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
        .text("Serve Distribution");

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

    const zones = {
        "Deuce Wide": { x: -155.5, width: 51.5, label: "Wide", side: "Deuce" },
        "Deuce Body": { x: -104, width: 51.5, label: "Body", side: "Deuce" },
        "Deuce T": { x: -52.5, width: 50.5, label: "T", side: "Deuce" },
        "Ad T": { x: 2, width: 50.5, label: "T", side: "Ad" },
        "Ad Body": { x: 52.5, width: 51.5, label: "Body", side: "Ad" },
        "Ad Wide": { x: 104, width: 51.5, label: "Wide", side: "Ad" }
    };

    const sideServeCounts = { "Ad": 0, "Deuce": 0 };

    data.forEach(function(d) {
        const zone = zones[d.Zone];
        sideServeCounts[zone.side] += parseInt(d["Win Proportion"].split('/')[1]);
    });

    let maxPercent = -Infinity;
    let minPercent = Infinity;

    data.forEach(function(d) {
        const proportion = d["Win Proportion"].split('/');
        const winPercent = Math.round((parseInt(proportion[0]) / parseInt(proportion[1])) * 100);
        maxPercent = Math.max(maxPercent, winPercent);
        minPercent = Math.min(minPercent, winPercent);
    });

    data.forEach(function(d) {
        const zone = zones[d.Zone];
        const proportion = d["Win Proportion"].split('/');
        const winPercent = Math.round((parseInt(proportion[0]) / parseInt(proportion[1])) * 100);
        const shotCount = parseInt(proportion[1]);
        const totalShots = `(${proportion[1]} shots)`;

        const sideTotal = sideServeCounts[zone.side];
        const fillRectColor = shotCount / sideTotal >= 0.4 ? "#f0d46c" : "#ece6b4";

        svg.append("rect")
            .attr("x", xScale(zone.x))
            .attr("y", yScale(242))
            .attr("width", xScale(zone.x + zone.width) - xScale(zone.x))
            .attr("height", 253.5)
            .attr("fill", fillRectColor)
            .attr("stroke", "black")
            .attr("stroke-width", 2);
            
        const fillColor = winPercent === maxPercent ? "#32a852" : winPercent === minPercent ? "red" : "black";

        svg.append("text")
            .attr("class", "percent-text")
            .attr("x", xScale(zone.x + zone.width / 2))
            .attr("y", yScale(140))
            .attr("fill", fillColor)
            .text(`${winPercent}%`);
        
        svg.append("text")
            .attr("class", "label-text")
            .attr("x", xScale(zone.x + zone.width / 2))
            .attr("y", yScale(125))
            .attr("fill", fillColor) 
            .text("won");

        svg.append("text")
            .attr("class", "label-text")
            .attr("x", xScale(zone.x + zone.width / 2))
            .attr("y", yScale(107.5))
            .attr("fill", "black")
            .style("font-size", "12px")
            .text(totalShots);

        svg.append("text")
            .attr("class", "label-text")
            .attr("x", xScale(zone.x + zone.width / 2))
            .attr("y", yScale(25))
            .attr("fill", "black")
            .text(zone.label);

        if (zone.side && zone.label === "Body") {
            svg.append("text")
                .attr("class", "zone-label")
                .attr("x", xScale(zone.x + zone.width / 2))
                .attr("y", yScale(255))
                .text(zone.side);
        }
    });

    // Legend
    const legend = svg.append("g")
                    .attr("class", "legend")
                    .attr("transform", `translate(${width / 2 - 110}, ${height - 540})`);

    legend.append("rect")
        .attr("x", -10)
        .attr("y", 20) // Static y-coordinate
        .attr("width", 25)
        .attr("height", 25)
        .attr("fill", "#f0d46c")
        .attr("stroke", "black")
        .attr("stroke-width", 1.2);

    // Legend text
    legend.append("text")
        .attr("x", 25)
        .attr("y", 37.5)
        .text("At least 40% of side's serves") // Static text
        .attr("font-size", "14px")
        .attr("fill", "white")
        .attr("font-weight", "bold");
});