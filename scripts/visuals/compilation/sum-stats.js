d3.json("../../../../data/json/summary_stats.json").then(function(summary_stats) {
    const playerNames = Object.keys(summary_stats[0]).filter(name => name !== "Stat" && name !== "isProp" && name !== "isRallyStat");
    const nonRallyData = summary_stats.filter(d => d.isRallyStat === false);
    const rallyData = summary_stats.filter(d => d.isRallyStat === true && d.Stat !== "Average Rally Length");
    const avgRallyLength = summary_stats.find(d => d.Stat === "Average Rally Length")[playerNames[0]];

    const margin = {top: 0, right: 80, bottom: 0, left: 80},
            width = 870 - margin.left - margin.right,
            barHeight = 70,
            gapHeight = -10,
            nonRallyHeight = nonRallyData.length * barHeight - 25;
            rallyHeight = rallyData.length * barHeight,
            totalHeight = nonRallyHeight + gapHeight + rallyHeight;
        
    const fullWidth = width + margin.left + margin.right;
    const fullHeight = totalHeight + margin.top + margin.bottom;

    const svg = d3.select("#sum-stats svg")
        .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .classed("responsive-svg", true)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const yNonRally = d3.scaleBand()
        .domain(nonRallyData.map(d => d.Stat))
        .range([0, nonRallyHeight])
        .padding(0.5);

    const yRally = d3.scaleBand()
        .domain(rallyData.map(d => d.Stat))
        .range([nonRallyHeight + gapHeight, totalHeight])
        .padding(0.5);

    const x = d3.scaleLinear()
        .domain([0, 100])
        .range([0, width / 3]);

    function parseValue(value, isProp) {
        if (isProp) {
            const [successful, total] = value.split('/').map(Number);
            const percentage = total > 0 ? (successful / total) * 100 : 0;
            return { successful, total, percentage };
        } else {
            return { count: +value };
        }
    }


    // Background bars (non-rally stats)
    svg.selectAll(".barBackgroundUCLA")
        .data(nonRallyData)
        .enter().append("rect")
        .attr("class", "bar-background-UCLA")
        .attr("x", d => width / 2 - x(100) - 1.5)
        .attr("y", d => yNonRally(d.Stat) + yNonRally.bandwidth() / 4)
        .attr("width", x(100))
        .attr("height", yNonRally.bandwidth() / 2);

    svg.selectAll(".barBackgroundOpp")
        .data(nonRallyData)
        .enter().append("rect")
        .attr("class", "bar-background-Opp")
        .attr("x", width / 2 + 1.5)
        .attr("y", d => yNonRally(d.Stat) + yNonRally.bandwidth() / 4)
        .attr("width", x(100))
        .attr("height", yNonRally.bandwidth() / 2);

    // UCLA bars (non-rally stats)
    svg.selectAll(".barUCLA")
        .data(nonRallyData)
        .enter().append("rect")
        .attr("class", "barUCLA")
        .attr("x", d => {
            const value = parseValue(d[playerNames[0]], d.isProp);
            if (d.isProp) {
                return width / 2 - x(value.percentage) - 1.5;
            } else {
                const total = parseValue(d[playerNames[0]], false).count + parseValue(d[playerNames[1]], false).count;
                return width / 2 - x((value.count / total) * 100) - 1.5;
            }
        })
        .attr("y", d => yNonRally(d.Stat) + yNonRally.bandwidth() / 4)
        .attr("width", d => {
            const value = parseValue(d[playerNames[0]], d.isProp);
            if (d.isProp) {
                return x(value.percentage);
            } else {
                const total = parseValue(d[playerNames[0]], false).count + parseValue(d[playerNames[1]], false).count;
                return x((value.count / total) * 100);
            }
        })
        .attr("height", yNonRally.bandwidth() / 2);

    // Opponent bars (non-rally stats)
    svg.selectAll(".barOpp")
        .data(nonRallyData)
        .enter().append("rect")
        .attr("class", "barOpp")
        .attr("x", width / 2 + 1.5)
        .attr("y", d => yNonRally(d.Stat) + yNonRally.bandwidth() / 4)
        .attr("width", d => {
            const value = parseValue(d[playerNames[1]], d.isProp);
            if (d.isProp) {
                return x(value.percentage);
            } else {
                const total = parseValue(d[playerNames[0]], false).count + parseValue(d[playerNames[1]], false).count;
                return x((value.count / total) * 100);
            }
        })
        .attr("height", yNonRally.bandwidth() / 2);
    
    svg.selectAll(".highlightRectUCLA")
        .data(nonRallyData.concat(rallyData))
        .enter().append("rect")
        .filter(d => {
            const uclaValue = parseValue(d[playerNames[0]], d.isProp);
            const oppValue = parseValue(d[playerNames[1]], d.isProp);
            const isAces = d.Stat === "Aces";
            const isDoubleFaults = d.Stat === "Double Faults";
            if (isDoubleFaults) return false;
            if (isAces) return d.isProp ? (uclaValue.percentage >= oppValue.percentage + 5) : (uclaValue.count > oppValue.count && uclaValue.count >= oppValue.count + 5);
            return d.isProp ? (uclaValue.percentage >= oppValue.percentage + 5) : uclaValue.count > oppValue.count;
        })
        .attr("class", "highlight-rect-UCLA")
        .attr("x", d => {
            const uclaValue = parseValue(d[playerNames[0]], d.isProp);
            if (d.isProp) {
                return width / 2 - x(100) - 56;
            } else {
                return width / 2 - x(100) - 43;
            }
        })
        .attr("y", d => {
            const index = nonRallyData.findIndex(stat => stat.Stat === d.Stat);
            if (index !== -1) {
                return yNonRally(d.Stat) + yNonRally.bandwidth() / 4 - 3.5;
            } else {
                return yRally(d.Stat) + yRally.bandwidth() / 4 - 3.5;
            }
        })
        .attr("width", d => {
            if (d.isProp) {
                return 50;
            } else {
                return 27.5;
            }
        })
        .attr("height", d => {
            if (d.isProp) {
                return 22.5;
            } else {
                return 22;
            }
        });

    svg.selectAll(".highlightRectOpp")
        .data(nonRallyData.concat(rallyData))
        .enter().append("rect")
        .filter(d => {
            const uclaValue = parseValue(d[playerNames[0]], d.isProp);
            const oppValue = parseValue(d[playerNames[1]], d.isProp);
            const isAces = d.Stat === "Aces";
            const isDoubleFaults = d.Stat === "Double Faults";
            if (isDoubleFaults) return false;
            if (isAces) return d.isProp ? (oppValue.percentage >= uclaValue.percentage + 5) : (oppValue.count > uclaValue.count && oppValue.count >= uclaValue.count + 5);
            return d.isProp ? (oppValue.percentage >= uclaValue.percentage + 5) : oppValue.count > uclaValue.count;
        })
        .attr("class", "highlight-rect-Opp")
        .attr("x", d => {
            const oppValue = parseValue(d[playerNames[1]], d.isProp);
            if (d.isProp) {
                return width / 2 + x(100) + 6.5;
            } else {
                return width / 2 + x(100) + 16;
            }
        })
        .attr("y", d => {
            const index = nonRallyData.findIndex(stat => stat.Stat === d.Stat);
            if (index !== -1) {
                return yNonRally(d.Stat) + yNonRally.bandwidth() / 4 - 3.5;
            } else {
                return yRally(d.Stat) + yRally.bandwidth() / 4 - 3.5;
            }
        })
        .attr("width", d => {
            if (d.isProp) {
                return 50;
            } else {
                return 27.5;
            }
        })
        .attr("height", d => {
            if (d.isProp) {
                return 22.5;
            } else {
                return 22;
            }
        });

    // Rally stats bars
    svg.append("text")
        .attr("class", "label")
        .attr("x", width / 2)
        .attr("y", nonRallyHeight + gapHeight / 2)
        .attr("text-anchor", "middle")
        .text("Average Rally Length: " + avgRallyLength);

    svg.selectAll(".barBackgroundUCLARally")
        .data(rallyData)
        .enter().append("rect")
        .attr("class", "bar-background-UCLA")
        .attr("x", d => width / 2 - x(100) - 1.5)
        .attr("y", d => yRally(d.Stat) + yRally.bandwidth() / 4)
        .attr("width", x(100))
        .attr("height", yRally.bandwidth() / 2);

    svg.selectAll(".barBackgroundOppRally")
        .data(rallyData)
        .enter().append("rect")
        .attr("class", "bar-background-Opp")
        .attr("x", width / 2 + 1.5)
        .attr("y", d => yRally(d.Stat) + yRally.bandwidth() / 4)
        .attr("width", x(100))
        .attr("height", yRally.bandwidth() / 2);

    svg.selectAll(".barUCLARally")
        .data(rallyData)
        .enter().append("rect")
        .attr("class", "barUCLA")
        .attr("x", d => {
            const value = parseValue(d[playerNames[0]], d.isProp);
            return width / 2 - x(value.percentage) - 1.5;
        })
        .attr("y", d => yRally(d.Stat) + yRally.bandwidth() / 4)
        .attr("width", d => x(parseValue(d[playerNames[0]], d.isProp).percentage))
        .attr("height", yRally.bandwidth() / 2);

    svg.selectAll(".barOppRally")
        .data(rallyData)
        .enter().append("rect")
        .attr("class", "barOpp")
        .attr("x", width / 2 + 1.5)
        .attr("y", d => yRally(d.Stat) + yRally.bandwidth() / 4)
        .attr("width", d => x(parseValue(d[playerNames[1]], d.isProp).percentage))
        .attr("height", yRally.bandwidth() / 2);

    // Stat labels
    svg.selectAll(".statLabel")
        .data(nonRallyData.concat(rallyData))
        .enter().append("text")
        .attr("class", "stat-label")
        .attr("x", width / 2)
        .attr("y", d => {
            const index = nonRallyData.findIndex(stat => stat.Stat === d.Stat);
            if (index !== -1) {
                return yNonRally(d.Stat);
            } else {
                return yRally(d.Stat);
            }
        })
        .attr("text-anchor", "middle")
        .text(d => d.Stat);

    // Percentage and attempts labels for UCLA
    svg.selectAll(".percentageUCLA")
        .data(nonRallyData.concat(rallyData))
        .enter().append("text")
        .filter(d => d.isProp)
        .attr("class", "percentage-label")
        .attr("x", d => width / 2 - x(100) - 30)
        .attr("y", d => {
            const index = nonRallyData.findIndex(stat => stat.Stat === d.Stat);
            if (index !== -1) {
                return yNonRally(d.Stat) + yNonRally.bandwidth() / 2 + 5;
            } else {
                return yRally(d.Stat) + yRally.bandwidth() / 2 + 5;
            }
        })
        .attr("text-anchor", "middle")
        .text(d => `${Math.round(parseValue(d[playerNames[0]], true).percentage)}%`);

    svg.selectAll(".attemptsUCLA")
        .data(nonRallyData.concat(rallyData))
        .enter().append("text")
        .filter(d => d.isProp)
        .attr("class", "attempts-label")
        .attr("x", d => width / 2 - x(100) - 32)
        .attr("y", d => {
            const index = nonRallyData.findIndex(stat => stat.Stat === d.Stat);
            if (index !== -1) {
                return yNonRally(d.Stat) + yNonRally.bandwidth() / 2 + 23;
            } else {
                return yRally(d.Stat) + yRally.bandwidth() / 2 + 23;
            }
        })
        .attr("text-anchor", "middle")
        .text(d => `(${parseValue(d[playerNames[0]], true).successful}/${parseValue(d[playerNames[0]], true).total})`);

    // Percentage and attempts labels for opponent
    svg.selectAll(".percentageOpp")
        .data(nonRallyData.concat(rallyData))
        .enter().append("text")
        .filter(d => d.isProp)
        .attr("class", "percentage-label")
        .attr("x", d => width / 2 + x(100) + 32.5)
        .attr("y", d => {
            const index = nonRallyData.findIndex(stat => stat.Stat === d.Stat);
            if (index !== -1) {
                return yNonRally(d.Stat) + yNonRally.bandwidth() / 2 + 5;
            } else {
                return yRally(d.Stat) + yRally.bandwidth() / 2 + 5;
            }
        })
        .attr("text-anchor", "middle")
        .text(d => `${Math.round(parseValue(d[playerNames[1]], true).percentage)}%`);

    svg.selectAll(".attemptsOpp")
        .data(nonRallyData.concat(rallyData))
        .enter().append("text")
        .filter(d => d.isProp)
        .attr("class", "attempts-label")
        .attr("x", d => width / 2 + x(100) + 31.5)
        .attr("y", d => {
            const index = nonRallyData.findIndex(stat => stat.Stat === d.Stat);
            if (index !== -1) {
                return yNonRally(d.Stat) + yNonRally.bandwidth() / 2 + 23;
            } else {
                return yRally(d.Stat) + yRally.bandwidth() / 2 + 23;
            }
        })
        .attr("text-anchor", "middle")
        .text(d => `(${parseValue(d[playerNames[1]], true).successful}/${parseValue(d[playerNames[1]], true).total})`);

    // Count labels for count stats
    svg.selectAll(".labelUCLA")
        .data(nonRallyData)
        .enter().append("text")
        .filter(d => !d.isProp)
        .attr("class", "label")
        .attr("x", d => width / 2 - x(100) - 30)
        .attr("y", d => yNonRally(d.Stat) + yNonRally.bandwidth() / 2 + 5)
        .attr("text-anchor", "middle")
        .text(d => d[playerNames[0]]);

    svg.selectAll(".labelOpp")
        .data(nonRallyData)
        .enter().append("text")
        .filter(d => !d.isProp)
        .attr("class", "label")
        .attr("x", d => width / 2 + x(100) + 30)
        .attr("y", d => yNonRally(d.Stat) + yNonRally.bandwidth() / 2 + 5)
        .attr("text-anchor", "middle")
        .text(d => d[playerNames[1]]);

    // Player name labels
    svg.append("text")
        .attr("class", "player-label")
        .attr("x", width / 2 - x(85))
        .attr("y", 12.5)
        .attr("text-anchor", "end")
        .text(playerNames[0]);

    svg.append("text")
        .attr("class", "player-label")
        .attr("x", width / 2 + x(125) - 65)
        .attr("y", 12.5)
        .attr("text-anchor", "start")
        .text(playerNames[1]);
});