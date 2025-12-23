
export function calculateElo(winnerScore: number, loserScore: number, kFactor: number = 32): { newWinnerScore: number, newLoserScore: number } {
    const expectedScoreWinner = 1 / (1 + Math.pow(10, (loserScore - winnerScore) / 400));
    const expectedScoreLoser = 1 / (1 + Math.pow(10, (winnerScore - loserScore) / 400));

    const newWinnerScore = winnerScore + kFactor * (1 - expectedScoreWinner);
    const newLoserScore = loserScore + kFactor * (0 - expectedScoreLoser);

    return {
        newWinnerScore: Math.round(newWinnerScore),
        newLoserScore: Math.round(newLoserScore)
    };
}
