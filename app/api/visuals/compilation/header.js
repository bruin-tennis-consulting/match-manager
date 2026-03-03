d3.json("../../../../data/json/match_summary.json").then(function(data) {
    const { player1, player2, setScores, eventDate, eventName, clientTeam, opponentTeam } = data;

    const setPairs = setScores.split(" ").map(s => s.split("-").map(Number));
    
    let setsWon1 = 0;
    let setsWon2 = 0;
    for (const [p1, p2] of setPairs) {
        if (p1 > p2) {
            setsWon1 += 1;
        } else {
            setsWon2 += 1;
        }
    }

    d3.select("#player1")
        .html(`${player1} <span class="team-name">(${clientTeam})</span>`)
        .classed("winner", setsWon1 > setsWon2);

    d3.select("#player2")
        .html(`${player2} <span class="team-name">(${opponentTeam})</span>`)
        .classed("winner", setsWon2 > setsWon1);

    d3.select("#setScores")
        .selectAll("span")
        .data(setScores)
        .join("span")
        .attr("class", "set-scores")
        .text(d => d);

    d3.select("#eventName").text(eventName);
    d3.select("#eventDate").text(eventDate);
});
